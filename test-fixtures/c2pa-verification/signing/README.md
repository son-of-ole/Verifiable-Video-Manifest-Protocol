# Official C2PA Signing Fixtures

These files are upstream public test fixtures from the Content Authenticity
Initiative test suite.

Purpose:

- provide a known-good ES256 certificate chain and private key for VVMP smoke tests
- prove a valid signature path separately from local self-signed negative cases
- keep CI deterministic without network fetches during signing tests

Source:

- `https://raw.githubusercontent.com/contentauth/c2pa-rs/main/sdk/tests/fixtures/certs/es256.pub`
- `https://raw.githubusercontent.com/contentauth/c2pa-rs/main/sdk/tests/fixtures/certs/es256.pem`

Important note:

These are public testing credentials only. They are intentionally not production
credentials and must never be reused for real trust assertions outside test and
fixture coverage.
