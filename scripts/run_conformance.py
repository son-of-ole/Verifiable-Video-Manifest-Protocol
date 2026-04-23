import json
import hashlib
from pathlib import Path
from typing import Any, Dict, List


ROOT = Path(__file__).resolve().parent.parent
FIXTURE_ROOT = ROOT / "test-fixtures" / "conformance"
CANONICALIZATION_ROOT = ROOT / "test-fixtures" / "canonicalization"
KNOWN_EXTENSION_IDS = set()


def is_object(value: Any) -> bool:
    return isinstance(value, dict)


def is_non_empty_string(value: Any) -> bool:
    return isinstance(value, str) and len(value) > 0


def issue(code: str, path: str, message: str) -> Dict[str, str]:
    return {"code": code, "path": path, "message": message}


def canonicalize_json(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    if isinstance(value, list):
        return "[" + ",".join(canonicalize_json(item) for item in value) + "]"
    if isinstance(value, dict):
        parts = []
        for key in sorted(value.keys()):
            parts.append(
                json.dumps(key, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
                + ":"
                + canonicalize_json(value[key])
            )
        return "{" + ",".join(parts) + "}"
    raise TypeError(f"Unsupported canonical JSON value type: {type(value)!r}")


def validate_manifest(manifest: Any) -> Dict[str, Any]:
    issues: List[Dict[str, str]] = []

    required_fields = [
        "manifest_version",
        "manifest_id",
        "video",
        "creation",
        "sources",
        "prompts",
        "tools",
        "assets",
        "timeline",
        "edits",
        "guardrails",
        "rights",
        "render",
        "publication",
        "redactions",
        "signatures",
        "links",
        "extensions",
    ]

    if not is_object(manifest):
        issues.append(issue("VVMP_SCHEMA_TYPE", "$", "Manifest must be a JSON object."))
        return {
            "valid": False,
            "issues": issues,
            "profiles": {
                "core_manifest": False,
                "registry_backed": False,
                "embedded_provenance": False,
                "recovery_capable": False,
            },
            "trustStates": {
                "file_trust_state": "embedded_manifest_missing",
                "provenance_coverage_state": "unknown_ingredient",
                "guardrail_state": "not_checked",
                "ai_involvement_state": "no_ai",
            },
        }

    for field in required_fields:
        if field not in manifest:
            issues.append(
                issue(
                    "VVMP_SCHEMA_REQUIRED_FIELD",
                    field,
                    f"The field {field} is required.",
                )
            )

    video = manifest.get("video")
    if not is_object(video):
        issues.append(issue("VVMP_SCHEMA_TYPE", "video", "video must be an object."))
    else:
        for field in ["video_id", "title", "created_at", "creator_type", "visibility"]:
            if not is_non_empty_string(video.get(field)):
                issues.append(
                    issue(
                        "VVMP_SCHEMA_REQUIRED_FIELD",
                        f"video.{field}",
                        f"The field video.{field} is required.",
                    )
                )

        final_asset = video.get("final_asset")
        if not is_object(final_asset):
            issues.append(
                issue(
                    "VVMP_SCHEMA_REQUIRED_FIELD",
                    "video.final_asset",
                    "The field video.final_asset is required.",
                )
            )
        else:
            if not is_non_empty_string(final_asset.get("format")):
                issues.append(
                    issue(
                        "VVMP_SCHEMA_REQUIRED_FIELD",
                        "video.final_asset.format",
                        "The field video.final_asset.format is required.",
                    )
                )
            if not isinstance(final_asset.get("duration_seconds"), (int, float)):
                issues.append(
                    issue(
                        "VVMP_SCHEMA_REQUIRED_FIELD",
                        "video.final_asset.duration_seconds",
                        "The field video.final_asset.duration_seconds is required.",
                    )
                )
            if not is_non_empty_string(final_asset.get("sha256")):
                issues.append(
                    issue(
                        "VVMP_SCHEMA_REQUIRED_FIELD",
                        "video.final_asset.sha256",
                        "The field video.final_asset.sha256 is required.",
                    )
                )

    creation = manifest.get("creation")
    if not is_object(creation):
        issues.append(issue("VVMP_SCHEMA_TYPE", "creation", "creation must be an object."))
    else:
        for field in ["workflow", "human_oversight_level"]:
            if not is_non_empty_string(creation.get(field)):
                issues.append(
                    issue(
                        "VVMP_SCHEMA_REQUIRED_FIELD",
                        f"creation.{field}",
                        f"The field creation.{field} is required.",
                    )
                )

    def validate_array_objects(name: str, required: List[str]) -> None:
        values = manifest.get(name)
        if not isinstance(values, list):
            issues.append(issue("VVMP_SCHEMA_TYPE", name, f"{name} must be an array."))
            return
        for index, entry in enumerate(values):
            if not is_object(entry):
                issues.append(
                    issue(
                        "VVMP_SCHEMA_TYPE",
                        f"{name}[{index}]",
                        f"{name}[{index}] must be an object.",
                    )
                )
                continue
            for field in required:
                if not is_non_empty_string(entry.get(field)):
                    issues.append(
                        issue(
                            "VVMP_SCHEMA_REQUIRED_FIELD",
                            f"{name}[{index}].{field}",
                            f"The field {name}[{index}].{field} is required.",
                        )
                    )

    validate_array_objects("sources", ["source_id", "source_type", "visibility"])
    validate_array_objects("prompts", ["prompt_id", "prompt_type", "visibility"])
    validate_array_objects("tools", ["tool_id", "tool_type", "purpose"])

    signatures = manifest.get("signatures")
    if not isinstance(signatures, list):
        issues.append(issue("VVMP_SCHEMA_TYPE", "signatures", "signatures must be an array."))
    else:
        for index, signature in enumerate(signatures):
            path = f"signatures[{index}]"
            if not is_object(signature):
                issues.append(issue("VVMP_SCHEMA_TYPE", path, f"{path} must be an object."))
                continue
            for field in ["signature_id", "type", "signer"]:
                if not is_non_empty_string(signature.get(field)):
                    issues.append(
                        issue(
                            "VVMP_SIGNATURE_MISSING_FIELD",
                            f"{path}.{field}",
                            f"The field {path}.{field} is required for signature records.",
                        )
                    )

    timeline = manifest.get("timeline")
    if not isinstance(timeline, list):
        issues.append(issue("VVMP_SCHEMA_TYPE", "timeline", "timeline must be an array."))
    else:
        for index, segment in enumerate(timeline):
            path = f"timeline[{index}]"
            if not is_object(segment):
                issues.append(issue("VVMP_SCHEMA_TYPE", path, f"{path} must be an object."))
                continue

            for field in ["segment_id", "claim_type"]:
                if not is_non_empty_string(segment.get(field)):
                    issues.append(
                        issue(
                            "VVMP_SCHEMA_REQUIRED_FIELD",
                            f"{path}.{field}",
                            f"The field {path}.{field} is required.",
                        )
                    )

            time_range = segment.get("time_range")
            if not is_object(time_range):
                issues.append(
                    issue(
                        "VVMP_SCHEMA_REQUIRED_FIELD",
                        f"{path}.time_range",
                        f"The field {path}.time_range is required.",
                    )
                )
                continue

            start = time_range.get("start")
            end = time_range.get("end")
            if not isinstance(start, (int, float)):
                issues.append(
                    issue(
                        "VVMP_SCHEMA_REQUIRED_FIELD",
                        f"{path}.time_range.start",
                        f"The field {path}.time_range.start is required.",
                    )
                )
            if not isinstance(end, (int, float)):
                issues.append(
                    issue(
                        "VVMP_SCHEMA_REQUIRED_FIELD",
                        f"{path}.time_range.end",
                        f"The field {path}.time_range.end is required.",
                    )
                )
            if isinstance(start, (int, float)) and start < 0:
                issues.append(
                    issue(
                        "VVMP_TIMELINE_NEGATIVE_START",
                        f"{path}.time_range.start",
                        f"The timeline start for {path} must be greater than or equal to 0.",
                    )
                )
            if isinstance(start, (int, float)) and isinstance(end, (int, float)) and end <= start:
                issues.append(
                    issue(
                        "VVMP_TIMELINE_REVERSED_RANGE",
                        f"{path}.time_range",
                        f"The timeline range for {path} must have end > start.",
                    )
                )

            provenance_refs = [
                isinstance(segment.get("source_ids"), list) and len(segment["source_ids"]) > 0,
                isinstance(segment.get("prompt_ids"), list) and len(segment["prompt_ids"]) > 0,
                isinstance(segment.get("generation_event_ids"), list)
                and len(segment["generation_event_ids"]) > 0,
            ]
            if not any(provenance_refs):
                issues.append(
                    issue(
                        "VVMP_TIMELINE_MISSING_PROVENANCE_REF",
                        path,
                        f"The segment {path} must reference at least one provenance source.",
                    )
                )

    extensions = manifest.get("extensions")
    if not isinstance(extensions, list):
        issues.append(issue("VVMP_SCHEMA_TYPE", "extensions", "extensions must be an array."))
    else:
        for index, extension in enumerate(extensions):
            path = f"extensions[{index}]"
            if not is_object(extension):
                issues.append(issue("VVMP_SCHEMA_TYPE", path, f"{path} must be an object."))
                continue
            if not is_non_empty_string(extension.get("extension_id")):
                issues.append(
                    issue(
                        "VVMP_SCHEMA_REQUIRED_FIELD",
                        f"{path}.extension_id",
                        f"The field {path}.extension_id is required.",
                    )
                )
                continue
            if not is_non_empty_string(extension.get("version")):
                issues.append(
                    issue(
                        "VVMP_SCHEMA_REQUIRED_FIELD",
                        f"{path}.version",
                        f"The field {path}.version is required.",
                    )
                )
            if not isinstance(extension.get("critical"), bool):
                issues.append(
                    issue(
                        "VVMP_SCHEMA_REQUIRED_FIELD",
                        f"{path}.critical",
                        f"The field {path}.critical is required.",
                    )
                )
                continue
            if extension.get("critical") and extension.get("extension_id") not in KNOWN_EXTENSION_IDS:
                issues.append(
                    issue(
                        "VVMP_EXTENSION_UNKNOWN_CRITICAL",
                        f"{path}.extension_id",
                        f"The critical extension {extension.get('extension_id')} is not supported.",
                    )
                )

    publication = manifest.get("publication") if is_object(manifest.get("publication")) else {}
    links = manifest.get("links") if is_object(manifest.get("links")) else {}
    wants_registry_backed = (
        publication.get("profile_claim") == "registry_backed"
        or publication.get("profile_claim") == "embedded_provenance"
        or is_non_empty_string(video.get("trust_code") if is_object(video) else None)
        or is_non_empty_string(publication.get("registry_url"))
        or is_non_empty_string(links.get("trust_page"))
    )

    if wants_registry_backed and not is_non_empty_string(video.get("trust_code") if is_object(video) else None):
        issues.append(
            issue(
                "VVMP_PROFILE_MISSING_TRUST_CODE",
                "video.trust_code",
                "Registry-backed manifests require video.trust_code.",
            )
        )

    if publication.get("profile_claim") == "embedded_provenance" and len(signatures if isinstance(signatures, list) else []) == 0:
        issues.append(
            issue(
                "VVMP_SIGNATURE_REQUIRED",
                "signatures",
                "Embedded provenance manifests require at least one signature record.",
            )
        )

    profiles = {
        "core_manifest": len(issues) == 0,
        "registry_backed": len(issues) == 0 and is_non_empty_string(video.get("trust_code") if is_object(video) else None),
        "embedded_provenance": len(issues) == 0
        and is_non_empty_string(video.get("trust_code") if is_object(video) else None)
        and isinstance(manifest.get("signatures"), list)
        and len(manifest["signatures"]) > 0,
        "recovery_capable": False,
    }
    profiles["recovery_capable"] = profiles["embedded_provenance"] and (
        is_non_empty_string(video.get("trust_code") if is_object(video) else None)
        or is_non_empty_string(links.get("trust_page"))
    )

    trust_states = derive_trust_states(manifest)

    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "profiles": profiles,
        "trustStates": trust_states,
    }


def derive_trust_states(manifest: Dict[str, Any]) -> Dict[str, str]:
    video = manifest.get("video", {})
    publication = manifest.get("publication", {})
    links = manifest.get("links", {})
    signatures = manifest.get("signatures", [])
    tools = manifest.get("tools", [])
    timeline = manifest.get("timeline", [])
    guardrails = manifest.get("guardrails", [])
    sources = manifest.get("sources", [])
    redactions = manifest.get("redactions", [])
    creation = manifest.get("creation", {})

    has_registry = (
        is_non_empty_string(video.get("trust_code"))
        or (is_object(publication) and is_non_empty_string(publication.get("registry_url")))
        or (is_object(links) and is_non_empty_string(links.get("trust_page")))
    )

    if isinstance(signatures, list) and len(signatures) > 0:
        file_trust_state = "valid_embedded_manifest"
    elif has_registry:
        file_trust_state = "remote_manifest_found"
    else:
        file_trust_state = "embedded_manifest_missing"

    has_redactions = bool(redactions) or any(source.get("visibility") != "public" for source in sources if is_object(source))
    if has_redactions:
        provenance_coverage_state = "private_redacted_source"
    elif len(timeline) == 0:
        provenance_coverage_state = "unsourced_ai_generation" if len(tools) > 0 else "unknown_ingredient"
    else:
        sourced_count = 0
        for segment in timeline:
            if is_object(segment) and isinstance(segment.get("source_ids"), list) and len(segment["source_ids"]) > 0:
                sourced_count += 1
        if sourced_count == len(timeline):
            provenance_coverage_state = "source_mapped"
        elif sourced_count > 0:
            provenance_coverage_state = "partially_source_mapped"
        else:
            provenance_coverage_state = "unsourced_ai_generation" if len(tools) > 0 else "user_authored"

    if len(guardrails) == 0:
        guardrail_state = "not_checked"
    elif any(is_object(guard) and guard.get("verdict") == "blocked" for guard in guardrails):
        guardrail_state = "blocked_before_publish"
    elif any(is_object(guard) and guard.get("verdict") == "warning" for guard in guardrails):
        guardrail_state = "warning"
    elif any(is_object(guard) and guard.get("review_mode") == "human" for guard in guardrails):
        guardrail_state = "passed_human_review"
    elif all(is_object(guard) and guard.get("verdict") == "approved" for guard in guardrails):
        guardrail_state = "passed_automated_review"
    else:
        guardrail_state = "not_checked"

    tool_types = {tool.get("tool_type") for tool in tools if is_object(tool)}
    if len(tool_types) == 0:
        ai_involvement_state = "no_ai"
    elif "language_model" in tool_types and creation.get("human_oversight_level") == "human_validated":
        ai_involvement_state = "ai_generated_with_human_approval"
    elif "language_model" in tool_types:
        ai_involvement_state = "ai_generated_script"
    elif "image_generator" in tool_types or "video_generator" in tool_types:
        ai_involvement_state = "ai_generated_visuals"
    else:
        ai_involvement_state = "ai_assisted"

    return {
        "file_trust_state": file_trust_state,
        "provenance_coverage_state": provenance_coverage_state,
        "guardrail_state": guardrail_state,
        "ai_involvement_state": ai_involvement_state,
    }


def compare_arrays(actual: List[str], expected: List[str]) -> bool:
    return sorted(actual) == sorted(expected)


def compare_result(actual: Dict[str, Any], expected: Dict[str, Any]) -> str:
    actual_codes = [entry["code"] for entry in actual["issues"]]
    expected_codes = expected.get("error_codes", [])

    if actual["valid"] != expected["valid"]:
        return f"expected valid={expected['valid']} but got {actual['valid']}"

    if not compare_arrays(actual_codes, expected_codes):
        return f"expected error codes {expected_codes} but got {actual_codes}"

    for key, value in expected.get("profiles", {}).items():
        if actual["profiles"].get(key) != value:
            return f"expected profile {key}={value} but got {actual['profiles'].get(key)}"

    for key, value in expected.get("trust_states", {}).items():
        if actual["trustStates"].get(key) != value:
            return f"expected trust state {key}={value} but got {actual['trustStates'].get(key)}"

    return ""


def compare_canonical_result(actual_canonical: str, actual_sha: str, expected: Dict[str, Any]) -> str:
    if actual_canonical != expected.get("canonical_json"):
        return "canonical JSON mismatch"
    if actual_sha != expected.get("sha256"):
        return f"expected sha256 {expected.get('sha256')} but got {actual_sha}"
    return ""


def main() -> int:
    fixtures = sorted(
        path
        for path in FIXTURE_ROOT.rglob("*.json")
        if not path.name.endswith(".expected.json")
    )
    canonical_fixtures = sorted(CANONICALIZATION_ROOT.rglob("*.input.json"))

    passed = 0
    failed = False

    for fixture_path in fixtures:
        expected_path = fixture_path.with_name(fixture_path.stem + ".expected.json")
        manifest = json.loads(fixture_path.read_text())
        expected = json.loads(expected_path.read_text())
        result = validate_manifest(manifest)
        mismatch = compare_result(result, expected)
        if mismatch:
            print(f"FAIL {fixture_path.relative_to(ROOT)}: {mismatch}")
            failed = True
            continue
        print(f"PASS {fixture_path.relative_to(ROOT)}")
        passed += 1

    for fixture_path in canonical_fixtures:
        expected_path = fixture_path.with_name(fixture_path.name.replace(".input.json", ".expected.json"))
        value = json.loads(fixture_path.read_text())
        expected = json.loads(expected_path.read_text())
        canonical = canonicalize_json(value)
        sha = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        mismatch = compare_canonical_result(canonical, sha, expected)
        if mismatch:
            print(f"FAIL {fixture_path.relative_to(ROOT)}: {mismatch}")
            failed = True
            continue
        print(f"PASS {fixture_path.relative_to(ROOT)}")
        passed += 1

    if failed:
        return 1

    print(f"Python conformance passed: {passed}/{len(fixtures) + len(canonical_fixtures)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
