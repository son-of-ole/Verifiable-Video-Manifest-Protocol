# VVMP C2PA Trust-Program Fixtures

This directory holds bundled trust-program artifacts used by the VVMP reference
implementation.

Included:

- `official-c2pa/C2PA-TRUST-LIST.pem`
- `official-c2pa/C2PA-TSA-TRUST-LIST.pem`
- `interim/anchors.pem`
- `interim/allowed.sha256.txt`
- `interim/store.cfg`
- `public-assets/adobe-20220124-C.jpg`
- `examples/trusted-signing-profile.example.json`

Purpose:

- keep the trust-program verification presets usable offline in CI
- avoid making the base repository verification contract depend on live trust-list
  downloads
- provide a public asset for exercising trust-program-aware verification
- provide an example signing-profile shape for real trust-program-backed signing

Important limitation:

- the bundled public Adobe asset is useful for exercising trust-program-aware
  verification, but it is not a guaranteed `trusted` case under current trust
  lists
- a truly trusted lane still requires a real trust-program-issued signing
  certificate chain and private key, which are not vendored in this repository

Practical trusted-lane setup:

- use `trust materialize-signing-profile --out-dir <dir>` to write
  `signing-profile.json`, `certificate.pem`, and `private-key.pem`
- use `trust doctor-trusted-lane` to validate that the resulting profile or
  secret-backed material actually produces a trusted verification result
- for local or CI secret-driven setup, the CLI can read:
  - `VVMP_TRUSTED_C2PA_CERTIFICATE_PEM`
  - `VVMP_TRUSTED_C2PA_CERTIFICATE_PEM_B64`
  - `VVMP_TRUSTED_C2PA_PRIVATE_KEY_PEM`
  - `VVMP_TRUSTED_C2PA_PRIVATE_KEY_PEM_B64`
  - optional `VVMP_TRUSTED_C2PA_TRUST_PROGRAM`
  - optional `VVMP_TRUSTED_C2PA_ALGORITHM`
  - optional `VVMP_TRUSTED_C2PA_TSA_URL`
  - optional `VVMP_TRUSTED_C2PA_PROFILE_ID`
