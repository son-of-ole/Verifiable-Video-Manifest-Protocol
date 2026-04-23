# C2PA Verification Matrix Fixtures

This directory captures expected verification behavior for the current VVMP
reference C2PA implementation.

Purpose:

- make known-good official ES256 signing behavior explicit
- make self-signed smoke behavior explicit
- prove the difference between default verification and trust-disabled verification
- keep future trust-chain improvements measurable instead of anecdotal

Current matrix cases:

- `official-es256-default`
  Verification for the upstream CAI ES256 test certificate chain with a valid
  signature and untrusted trust state.
- `official-es256-local-profile`
  Verification for that same upstream CAI ES256 signer with a VVMP local
  trust-profile document that marks the signer as locally trusted while the raw
  C2PA trust state remains untrusted.
- `self-signed-default`
  Default verification against a locally generated self-signed signing cert.
- `self-signed-no-trust`
  Verification with trust checks disabled.
- `self-signed-with-anchor`
  Verification with the self-signed cert supplied as a trust anchor.

Important note:

VVMP now tracks two distinct fixture-backed realities:

- the upstream CAI ES256 test chain produces a valid signature with an
  untrusted trust result
- the same upstream signer can also be approved through a VVMP local
  trust-profile lane without altering the raw C2PA trust result
- the local ad hoc self-signed lane still verifies as
  `content_bound_but_signature_invalid`, even when a trust anchor is supplied

These fixtures document current behavior so future upgrades can change the
expectations intentionally rather than silently.
