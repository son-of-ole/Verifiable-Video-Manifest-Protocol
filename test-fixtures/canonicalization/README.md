# VVMP Canonicalization Fixtures

These fixtures verify two cross-stack invariants:

1. the canonical JSON byte representation
2. the SHA-256 digest of that canonical UTF-8 string

Each fixture has:

- `*.input.json`
- `*.expected.json`

The current canonicalization rule for this draft corpus is:

- object keys sorted lexicographically
- arrays preserve order
- no insignificant whitespace
- UTF-8 encoding
- standard JSON scalar rendering

