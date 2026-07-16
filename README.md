# TOTP Authenticator

A local, offline Chrome extension (Manifest V3) - a 2FA authenticator in the
spirit of Google Authenticator. It stores TOTP / HOTP / Steam accounts, generates
one-time codes with a live countdown, and works entirely on-device (no cloud, no
access to page content).

[![build](https://github.com/k-adm/totp-authenticator/actions/workflows/build.yml/badge.svg)](https://github.com/k-adm/totp-authenticator/actions/workflows/build.yml)
[![Download](https://img.shields.io/badge/download-latest%20build-2ea44f.svg)](https://github.com/k-adm/totp-authenticator/releases/latest)
![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-1a73e8.svg)
![Network: none](https://img.shields.io/badge/network-none-success.svg)

## Features

- **Codes in the popup** - TOTP / HOTP / Steam, a live validity timer (shrinking
  bar + seconds), search, and click-to-copy. Accounts are sorted by service name
  by default (`Name` / `Custom` / `Recently added` in settings).
- **Service icons** - automatic brand icons for popular services (GitHub, Google,
  Steam, ...) from `simple-icons`; unknown services get a colored letter avatar.
- **Adding accounts** - manual entry, QR from a file, interactive on-screen QR
  capture (`captureVisibleTab` + region selection), pasting an `otpauth://` URI,
  and import from Google Authenticator (`otpauth-migration://`).
- **Import / export** - `.json` (own schema) and `.2fas` (2FAS app format), both
  **plaintext and password-protected**, in both directions. Encrypted `.2fas` is
  cross-compatible with the 2FAS app (PBKDF2-HMAC-SHA256, 10000 iterations,
  AES-256-GCM).
- **Optional master password** - accounts are stored as plaintext in
  `chrome.storage.local` by default; enabling a master password encrypts them
  (Web Crypto: PBKDF2-SHA256 -> AES-256-GCM) and adds a lock screen with idle
  auto-lock.
- **Themes** - light / dark / system.

## Privacy & security

- **100% offline.** No network requests, no analytics, no telemetry. Codes and
  secrets never leave your browser.
- **Two permissions only:** `storage` and `activeTab` (the latter solely to
  capture a screenshot of the current tab when you scan a QR from the screen).
  No content scripts, no host access to page content.
- **At-rest encryption (optional):** when a master password is set, the vault is
  AES-256-GCM encrypted; the derived key lives only in `chrome.storage.session`
  (in-memory) while unlocked and is dropped on idle auto-lock.

> **Note:** without a master password, accounts are stored unencrypted in
> `chrome.storage.local` - the same default as most authenticator apps. Enable a
> master password for at-rest protection.

## Download (prebuilt)

A ready-to-use build is attached to the
[**latest release**](https://github.com/k-adm/totp-authenticator/releases/latest)
- direct link:
[`totp-authenticator.zip`](https://github.com/k-adm/totp-authenticator/releases/latest/download/totp-authenticator.zip).
Download the zip, unzip it, then in Chrome open `chrome://extensions/`, enable
**Developer mode**, click **Load unpacked**, and select the unzipped folder.

The download is rebuilt automatically on every push to `main`, so the link always
points at the current build.

## Install (from source)

```bash
npm install
npm run build        # -> dist/
```

Then load it in Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` folder

Not published to the Chrome Web Store - build and load it yourself.

## Backup formats

- **`.json`** (own schema): `{ app: "totp-authenticator", schemaVersion: 1, accounts: [...] }`;
  the encrypted variant stores an AES-GCM blob (PBKDF2-SHA256 -> AES-256-GCM).
- **`.2fas`** (2FAS app format): plaintext or encrypted (`servicesEncrypted`,
  PBKDF2-HMAC-SHA256 10000 iterations, AES-256-GCM). Round-trips with the 2FAS app.
- **Google Authenticator:** `otpauth-migration://` export URIs are decoded in-app.

## Tech stack

Vite 7 + React 19 + TypeScript + Tailwind 4 + shadcn/ui. Core:
[`otpauth`](https://github.com/hectorm/otpauth) (code generation/parsing),
[`@zxing/browser`](https://github.com/zxing-js/browser) (QR decoding),
[`simple-icons`](https://github.com/simple-icons/simple-icons) (brand icons,
tree-shaken).

## Development

```bash
npm run dev          # Vite dev server (UI only, no chrome.* APIs)
npm run build        # tsc + eslint (--max-warnings 0) + prettier + vite build
```

Entry points: `popup.html` (codes), `options.html` (accounts / import-export /
security), `capture.html` (screenshot region selection). Core logic is in
`src/lib/` (`totp`, `vault`, `crypto`, `qr`, `screenshot`, `importers/`).

## License

[MIT](LICENSE) (c) k-adm.
