export type OtpType = "totp" | "hotp" | "steam";
export type OtpAlgorithm = "SHA1" | "SHA256" | "SHA512";

/** A single 2FA account stored in the vault. */
export interface Account {
  id: string;
  type: OtpType;
  issuer: string;
  label: string;
  account?: string;
  secret: string; // base32
  algorithm: OtpAlgorithm;
  digits: number;
  period: number;
  counter?: number; // HOTP only
  order: number;
  createdAt: number;
  updatedAt: number;
  iconLabel?: string;
  iconColor?: string;
}

export type SortMode = "name" | "custom" | "recent";

// Theme is owned entirely by next-themes (its own localStorage key), so it is
// intentionally not part of Settings.
export interface Settings {
  autoLockMinutes: number; // 0 = never
  sortMode: SortMode;
}

/** KDF parameters persisted alongside an encrypted payload. */
export interface KdfParams {
  salt: string; // base64
  iterations: number;
  hash: "SHA-256";
}

/** Persisted vault. When encryption is "password", `accounts` is absent and the
 *  account array lives (encrypted) inside `ciphertext`. */
export interface VaultData {
  version: number;
  encryption: "none" | "password";
  accounts?: Account[];
  kdf?: KdfParams;
  iv?: string; // base64
  ciphertext?: string; // base64, AES-GCM(JSON.stringify(accounts))
}

export const DEFAULT_SETTINGS: Settings = {
  autoLockMinutes: 5,
  sortMode: "name",
};

export const EMPTY_VAULT: VaultData = {
  version: 1,
  encryption: "none",
  accounts: [],
};
