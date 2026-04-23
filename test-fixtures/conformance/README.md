# VVMP Conformance Fixtures

This directory contains the first draft conformance corpus for VVMP.

Each fixture has a corresponding `.expected.json` file that describes the expected validation outcome.

Directory layout:

- `valid/`
- `invalid/`

The first release is intentionally small. It exists to seed the fixture model and give the Next.js reference viewer a real manifest to render.

Current fixture categories:

- valid core manifests
- valid registry-backed manifests
- valid embedded provenance manifests
- valid signed manifests
- valid redacted manifests
- invalid schema cases
- invalid semantic cases
- invalid profile cases
- invalid signature cases
- invalid extension cases
