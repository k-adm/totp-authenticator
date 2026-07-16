# Security Policy

This is a fully local, offline browser extension. It makes no network requests,
has no backend, and collects no telemetry. Accounts and one-time-code secrets
stay in your browser's local storage (optionally AES-256-GCM encrypted behind a
master password).

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Instead, open a private
[security advisory](https://github.com/k-adm/totp-authenticator/security/advisories/new),
or contact the maintainer through the GitHub profile.

Include steps to reproduce and the extension version (from `public/manifest.json`).
