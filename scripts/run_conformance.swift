import Foundation
import CryptoKit
import CoreFoundation

struct ValidationIssue {
    let code: String
    let path: String
    let message: String
}

struct ValidationResult {
    let valid: Bool
    let issues: [ValidationIssue]
    let profiles: [String: Bool]
    let trustStates: [String: String]
}

let knownExtensionIDs = Set<String>()
let rootURL = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let fixtureRoot = rootURL.appending(path: "test-fixtures/conformance")
let canonicalizationRoot = rootURL.appending(path: "test-fixtures/canonicalization")

func isObject(_ value: Any?) -> [String: Any]? {
    value as? [String: Any]
}

func isNonEmptyString(_ value: Any?) -> Bool {
    guard let string = value as? String else { return false }
    return !string.isEmpty
}

func issue(_ code: String, _ path: String, _ message: String) -> ValidationIssue {
    ValidationIssue(code: code, path: path, message: message)
}

func canonicalizeScalar(_ value: Any) throws -> String {
    if value is NSNull {
        return "null"
    }

    if let number = value as? NSNumber {
        if CFGetTypeID(number) == CFBooleanGetTypeID() {
            return number.boolValue ? "true" : "false"
        }

        let doubleValue = number.doubleValue
        if doubleValue.rounded(.towardZero) == doubleValue,
           abs(doubleValue) <= Double(Int64.max) {
            return String(Int64(doubleValue))
        }

        return String(doubleValue)
    }

    if let string = value as? String {
        var output = "\""
        for scalar in string.unicodeScalars {
            switch scalar.value {
            case 0x22:
                output += "\\\""
            case 0x5C:
                output += "\\\\"
            case 0x08:
                output += "\\b"
            case 0x0C:
                output += "\\f"
            case 0x0A:
                output += "\\n"
            case 0x0D:
                output += "\\r"
            case 0x09:
                output += "\\t"
            case 0x00...0x1F:
                output += String(format: "\\u%04x", scalar.value)
            default:
                output.append(String(scalar))
            }
        }
        output += "\""
        return output
    }

    throw NSError(domain: "VVMP", code: 1)
}

func canonicalizeJSON(_ value: Any) throws -> String {
    if value is NSNull || value is Bool || value is NSNumber || value is String {
        return try canonicalizeScalar(value)
    }

    if let array = value as? [Any] {
        return "[" + (try array.map { try canonicalizeJSON($0) }).joined(separator: ",") + "]"
    }

    if let object = value as? [String: Any] {
        let keys = object.keys.sorted()
        let parts = try keys.map { key in
            let keyJSON = try canonicalizeScalar(key)
            let valueJSON = try canonicalizeJSON(object[key]!)
            return "\(keyJSON):\(valueJSON)"
        }
        return "{" + parts.joined(separator: ",") + "}"
    }

    throw NSError(domain: "VVMP", code: 2)
}

func deriveTrustStates(_ manifest: [String: Any]) -> [String: String] {
    let video = isObject(manifest["video"]) ?? [:]
    let publication = isObject(manifest["publication"]) ?? [:]
    let links = isObject(manifest["links"]) ?? [:]
    let signatures = manifest["signatures"] as? [Any] ?? []
    let tools = manifest["tools"] as? [[String: Any]] ?? []
    let timeline = manifest["timeline"] as? [[String: Any]] ?? []
    let guardrails = manifest["guardrails"] as? [[String: Any]] ?? []
    let sources = manifest["sources"] as? [[String: Any]] ?? []
    let redactions = manifest["redactions"] as? [Any] ?? []
    let creation = isObject(manifest["creation"]) ?? [:]

    let hasRegistry =
        isNonEmptyString(video["trust_code"]) ||
        isNonEmptyString(publication["registry_url"]) ||
        isNonEmptyString(links["trust_page"])

    let fileTrustState: String
    if !signatures.isEmpty {
        fileTrustState = "valid_embedded_manifest"
    } else if hasRegistry {
        fileTrustState = "remote_manifest_found"
    } else {
        fileTrustState = "embedded_manifest_missing"
    }

    let hasRedactions = !redactions.isEmpty || sources.contains { source in
        (source["visibility"] as? String) != "public"
    }

    let provenanceCoverageState: String
    if hasRedactions {
        provenanceCoverageState = "private_redacted_source"
    } else if timeline.isEmpty {
        provenanceCoverageState = tools.isEmpty ? "unknown_ingredient" : "unsourced_ai_generation"
    } else {
        let sourcedCount = timeline.filter { segment in
            let sourceIDs = segment["source_ids"] as? [Any] ?? []
            return !sourceIDs.isEmpty
        }.count

        if sourcedCount == timeline.count {
            provenanceCoverageState = "source_mapped"
        } else if sourcedCount > 0 {
            provenanceCoverageState = "partially_source_mapped"
        } else {
            provenanceCoverageState = tools.isEmpty ? "user_authored" : "unsourced_ai_generation"
        }
    }

    let guardrailState: String
    if guardrails.isEmpty {
        guardrailState = "not_checked"
    } else if guardrails.contains(where: { ($0["verdict"] as? String) == "blocked" }) {
        guardrailState = "blocked_before_publish"
    } else if guardrails.contains(where: { ($0["verdict"] as? String) == "warning" }) {
        guardrailState = "warning"
    } else if guardrails.contains(where: { ($0["review_mode"] as? String) == "human" }) {
        guardrailState = "passed_human_review"
    } else if guardrails.allSatisfy({ ($0["verdict"] as? String) == "approved" }) {
        guardrailState = "passed_automated_review"
    } else {
        guardrailState = "not_checked"
    }

    let toolTypes = Set(tools.compactMap { $0["tool_type"] as? String })
    let aiInvolvementState: String
    if toolTypes.isEmpty {
        aiInvolvementState = "no_ai"
    } else if toolTypes.contains("language_model") && (creation["human_oversight_level"] as? String) == "human_validated" {
        aiInvolvementState = "ai_generated_with_human_approval"
    } else if toolTypes.contains("language_model") {
        aiInvolvementState = "ai_generated_script"
    } else if toolTypes.contains("image_generator") || toolTypes.contains("video_generator") {
        aiInvolvementState = "ai_generated_visuals"
    } else {
        aiInvolvementState = "ai_assisted"
    }

    return [
        "file_trust_state": fileTrustState,
        "provenance_coverage_state": provenanceCoverageState,
        "guardrail_state": guardrailState,
        "ai_involvement_state": aiInvolvementState
    ]
}

func validateManifest(_ manifestAny: Any) -> ValidationResult {
    var issues: [ValidationIssue] = []

    guard let manifest = manifestAny as? [String: Any] else {
        return ValidationResult(
            valid: false,
            issues: [issue("VVMP_SCHEMA_TYPE", "$", "Manifest must be a JSON object.")],
            profiles: [
                "core_manifest": false,
                "registry_backed": false,
                "embedded_provenance": false,
                "recovery_capable": false
            ],
            trustStates: [
                "file_trust_state": "embedded_manifest_missing",
                "provenance_coverage_state": "unknown_ingredient",
                "guardrail_state": "not_checked",
                "ai_involvement_state": "no_ai"
            ]
        )
    }

    let requiredFields = [
        "manifest_version", "manifest_id", "video", "creation", "sources", "prompts", "tools",
        "assets", "timeline", "edits", "guardrails", "rights", "render", "publication",
        "redactions", "signatures", "links", "extensions"
    ]

    for field in requiredFields where manifest[field] == nil {
        issues.append(issue("VVMP_SCHEMA_REQUIRED_FIELD", field, "The field \(field) is required."))
    }

    if let video = isObject(manifest["video"]) {
        for field in ["video_id", "title", "created_at", "creator_type", "visibility"] {
            if !isNonEmptyString(video[field]) {
                issues.append(issue("VVMP_SCHEMA_REQUIRED_FIELD", "video.\(field)", "The field video.\(field) is required."))
            }
        }

        if let finalAsset = isObject(video["final_asset"]) {
            if !isNonEmptyString(finalAsset["format"]) {
                issues.append(issue("VVMP_SCHEMA_REQUIRED_FIELD", "video.final_asset.format", "The field video.final_asset.format is required."))
            }
            if !(finalAsset["duration_seconds"] is NSNumber) {
                issues.append(issue("VVMP_SCHEMA_REQUIRED_FIELD", "video.final_asset.duration_seconds", "The field video.final_asset.duration_seconds is required."))
            }
            if !isNonEmptyString(finalAsset["sha256"]) {
                issues.append(issue("VVMP_SCHEMA_REQUIRED_FIELD", "video.final_asset.sha256", "The field video.final_asset.sha256 is required."))
            }
        } else {
            issues.append(issue("VVMP_SCHEMA_REQUIRED_FIELD", "video.final_asset", "The field video.final_asset is required."))
        }
    } else {
        issues.append(issue("VVMP_SCHEMA_TYPE", "video", "video must be an object."))
    }

    if let creation = isObject(manifest["creation"]) {
        for field in ["workflow", "human_oversight_level"] {
            if !isNonEmptyString(creation[field]) {
                issues.append(issue("VVMP_SCHEMA_REQUIRED_FIELD", "creation.\(field)", "The field creation.\(field) is required."))
            }
        }
    } else {
        issues.append(issue("VVMP_SCHEMA_TYPE", "creation", "creation must be an object."))
    }

    func validateArrayObjects(name: String, requiredFields: [String]) {
        guard let values = manifest[name] as? [Any] else {
            issues.append(issue("VVMP_SCHEMA_TYPE", name, "\(name) must be an array."))
            return
        }

        for (index, entry) in values.enumerated() {
            guard let object = entry as? [String: Any] else {
                issues.append(issue("VVMP_SCHEMA_TYPE", "\(name)[\(index)]", "\(name)[\(index)] must be an object."))
                continue
            }

            for field in requiredFields where !isNonEmptyString(object[field]) {
                issues.append(issue("VVMP_SCHEMA_REQUIRED_FIELD", "\(name)[\(index)].\(field)", "The field \(name)[\(index)].\(field) is required."))
            }
        }
    }

    validateArrayObjects(name: "sources", requiredFields: ["source_id", "source_type", "visibility"])
    validateArrayObjects(name: "prompts", requiredFields: ["prompt_id", "prompt_type", "visibility"])
    validateArrayObjects(name: "tools", requiredFields: ["tool_id", "tool_type", "purpose"])

    if let signatures = manifest["signatures"] as? [Any] {
        for (index, entry) in signatures.enumerated() {
            let path = "signatures[\(index)]"
            guard let signature = entry as? [String: Any] else {
                issues.append(issue("VVMP_SCHEMA_TYPE", path, "\(path) must be an object."))
                continue
            }

            for field in ["signature_id", "type", "signer"] where !isNonEmptyString(signature[field]) {
                issues.append(issue("VVMP_SIGNATURE_MISSING_FIELD", "\(path).\(field)", "The field \(path).\(field) is required for signature records."))
            }
        }
    } else {
        issues.append(issue("VVMP_SCHEMA_TYPE", "signatures", "signatures must be an array."))
    }

    if let timeline = manifest["timeline"] as? [Any] {
        for (index, entry) in timeline.enumerated() {
            let path = "timeline[\(index)]"
            guard let segment = entry as? [String: Any] else {
                issues.append(issue("VVMP_SCHEMA_TYPE", path, "\(path) must be an object."))
                continue
            }

            for field in ["segment_id", "claim_type"] where !isNonEmptyString(segment[field]) {
                issues.append(issue("VVMP_SCHEMA_REQUIRED_FIELD", "\(path).\(field)", "The field \(path).\(field) is required."))
            }

            guard let timeRange = segment["time_range"] as? [String: Any] else {
                issues.append(issue("VVMP_SCHEMA_REQUIRED_FIELD", "\(path).time_range", "The field \(path).time_range is required."))
                continue
            }

            let start = timeRange["start"] as? NSNumber
            let end = timeRange["end"] as? NSNumber

            if start == nil {
                issues.append(issue("VVMP_SCHEMA_REQUIRED_FIELD", "\(path).time_range.start", "The field \(path).time_range.start is required."))
            }
            if end == nil {
                issues.append(issue("VVMP_SCHEMA_REQUIRED_FIELD", "\(path).time_range.end", "The field \(path).time_range.end is required."))
            }
            if let start, start.doubleValue < 0 {
                issues.append(issue("VVMP_TIMELINE_NEGATIVE_START", "\(path).time_range.start", "The timeline start for \(path) must be greater than or equal to 0."))
            }
            if let start, let end, end.doubleValue <= start.doubleValue {
                issues.append(issue("VVMP_TIMELINE_REVERSED_RANGE", "\(path).time_range", "The timeline range for \(path) must have end > start."))
            }

            let hasSourceIDs = !(segment["source_ids"] as? [Any] ?? []).isEmpty
            let hasPromptIDs = !(segment["prompt_ids"] as? [Any] ?? []).isEmpty
            let hasGenerationIDs = !(segment["generation_event_ids"] as? [Any] ?? []).isEmpty

            if !(hasSourceIDs || hasPromptIDs || hasGenerationIDs) {
                issues.append(issue("VVMP_TIMELINE_MISSING_PROVENANCE_REF", path, "The segment \(path) must reference at least one provenance source."))
            }
        }
    } else {
        issues.append(issue("VVMP_SCHEMA_TYPE", "timeline", "timeline must be an array."))
    }

    if let extensions = manifest["extensions"] as? [Any] {
        for (index, entry) in extensions.enumerated() {
            let path = "extensions[\(index)]"
            guard let ext = entry as? [String: Any] else {
                issues.append(issue("VVMP_SCHEMA_TYPE", path, "\(path) must be an object."))
                continue
            }
            guard let extensionID = ext["extension_id"] as? String, !extensionID.isEmpty else {
                issues.append(issue("VVMP_SCHEMA_REQUIRED_FIELD", "\(path).extension_id", "The field \(path).extension_id is required."))
                continue
            }
            if !isNonEmptyString(ext["version"]) {
                issues.append(issue("VVMP_SCHEMA_REQUIRED_FIELD", "\(path).version", "The field \(path).version is required."))
            }
            guard let critical = ext["critical"] as? Bool else {
                issues.append(issue("VVMP_SCHEMA_REQUIRED_FIELD", "\(path).critical", "The field \(path).critical is required."))
                continue
            }
            if critical && !knownExtensionIDs.contains(extensionID) {
                issues.append(issue("VVMP_EXTENSION_UNKNOWN_CRITICAL", "\(path).extension_id", "The critical extension \(extensionID) is not supported."))
            }
        }
    } else {
        issues.append(issue("VVMP_SCHEMA_TYPE", "extensions", "extensions must be an array."))
    }

    let video = isObject(manifest["video"]) ?? [:]
    let publication = isObject(manifest["publication"]) ?? [:]
    let links = isObject(manifest["links"]) ?? [:]
    let signatures = manifest["signatures"] as? [Any] ?? []

    let wantsRegistryBacked =
        (publication["profile_claim"] as? String) == "registry_backed" ||
        (publication["profile_claim"] as? String) == "embedded_provenance" ||
        isNonEmptyString(video["trust_code"]) ||
        isNonEmptyString(publication["registry_url"]) ||
        isNonEmptyString(links["trust_page"])

    if wantsRegistryBacked && !isNonEmptyString(video["trust_code"]) {
        issues.append(issue("VVMP_PROFILE_MISSING_TRUST_CODE", "video.trust_code", "Registry-backed manifests require video.trust_code."))
    }

    if (publication["profile_claim"] as? String) == "embedded_provenance" && signatures.isEmpty {
        issues.append(issue("VVMP_SIGNATURE_REQUIRED", "signatures", "Embedded provenance manifests require at least one signature record."))
    }

    let coreManifest = issues.isEmpty
    let registryBacked = coreManifest && isNonEmptyString(video["trust_code"])
    let embeddedProvenance = registryBacked && !signatures.isEmpty
    let recoveryCapable = embeddedProvenance && (isNonEmptyString(video["trust_code"]) || isNonEmptyString(links["trust_page"]))

    return ValidationResult(
        valid: issues.isEmpty,
        issues: issues,
        profiles: [
            "core_manifest": issues.isEmpty,
            "registry_backed": registryBacked,
            "embedded_provenance": embeddedProvenance,
            "recovery_capable": recoveryCapable
        ],
        trustStates: deriveTrustStates(manifest)
    )
}

func compareArrays(_ actual: [String], _ expected: [String]) -> Bool {
    actual.sorted() == expected.sorted()
}

func compareResult(actual: ValidationResult, expected: [String: Any]) -> String? {
    let actualCodes = actual.issues.map(\.code)
    let expectedCodes = expected["error_codes"] as? [String] ?? []

    if let expectedValid = expected["valid"] as? Bool, actual.valid != expectedValid {
        return "expected valid=\(expectedValid) but got \(actual.valid)"
    }

    if !compareArrays(actualCodes, expectedCodes) {
        return "expected error codes \(expectedCodes) but got \(actualCodes)"
    }

    if let expectedProfiles = expected["profiles"] as? [String: Bool] {
        for (key, value) in expectedProfiles where actual.profiles[key] != value {
            return "expected profile \(key)=\(value) but got \(String(describing: actual.profiles[key]))"
        }
    }

    if let expectedTrustStates = expected["trust_states"] as? [String: String] {
        for (key, value) in expectedTrustStates where actual.trustStates[key] != value {
            return "expected trust state \(key)=\(value) but got \(String(describing: actual.trustStates[key]))"
        }
    }

    return nil
}

func compareCanonicalResult(actualCanonical: String, actualSha: String, expected: [String: Any]) -> String? {
    if actualCanonical != (expected["canonical_json"] as? String ?? "") {
        return "canonical JSON mismatch"
    }

    if actualSha != (expected["sha256"] as? String ?? "") {
        return "expected sha256 \(expected["sha256"] as? String ?? "") but got \(actualSha)"
    }

    return nil
}

func collectFixtures(from root: URL) -> [URL] {
    guard let enumerator = FileManager.default.enumerator(at: root, includingPropertiesForKeys: nil) else {
        return []
    }

    var fixtures: [URL] = []

    for case let fileURL as URL in enumerator {
        let path = fileURL.path
        if path.hasSuffix(".json") && !path.hasSuffix(".expected.json") {
            fixtures.append(fileURL)
        }
    }

    return fixtures.sorted { $0.path < $1.path }
}

let fixtures = collectFixtures(from: fixtureRoot)
let canonicalFixtures = collectFixtures(from: canonicalizationRoot).filter { $0.path.hasSuffix(".input.json") }
var failed = false
var passed = 0

for fixture in fixtures {
    let expected = fixture.deletingPathExtension().appendingPathExtension("expected.json")

    do {
        let manifestData = try Data(contentsOf: fixture)
        let expectedData = try Data(contentsOf: expected)
        let manifest = try JSONSerialization.jsonObject(with: manifestData)
        let expectedJSON = try JSONSerialization.jsonObject(with: expectedData) as! [String: Any]
        let result = validateManifest(manifest)

        if let mismatch = compareResult(actual: result, expected: expectedJSON) {
            print("FAIL \(fixture.path.replacingOccurrences(of: rootURL.path + "/", with: "")): \(mismatch)")
            failed = true
        } else {
            print("PASS \(fixture.path.replacingOccurrences(of: rootURL.path + "/", with: ""))")
            passed += 1
        }
    } catch {
        print("FAIL \(fixture.path.replacingOccurrences(of: rootURL.path + "/", with: "")): \(error)")
        failed = true
    }
}

for fixture in canonicalFixtures {
    let expected = fixture.deletingLastPathComponent().appendingPathComponent(
        fixture.lastPathComponent.replacingOccurrences(of: ".input.json", with: ".expected.json")
    )

    do {
        let inputData = try Data(contentsOf: fixture)
        let expectedData = try Data(contentsOf: expected)
        let inputJSON = try JSONSerialization.jsonObject(with: inputData)
        let expectedJSON = try JSONSerialization.jsonObject(with: expectedData) as! [String: Any]
        let canonical = try canonicalizeJSON(inputJSON)
        let digest = SHA256.hash(data: Data(canonical.utf8)).map { String(format: "%02x", $0) }.joined()

        if let mismatch = compareCanonicalResult(actualCanonical: canonical, actualSha: digest, expected: expectedJSON) {
            print("FAIL \(fixture.path.replacingOccurrences(of: rootURL.path + "/", with: "")): \(mismatch)")
            failed = true
        } else {
            print("PASS \(fixture.path.replacingOccurrences(of: rootURL.path + "/", with: ""))")
            passed += 1
        }
    } catch {
        print("FAIL \(fixture.path.replacingOccurrences(of: rootURL.path + "/", with: "")): \(error)")
        failed = true
    }
}

if failed {
    exit(1)
}

print("Swift conformance passed: \(passed)/\(fixtures.count + canonicalFixtures.count)")
