// AES-GCM encryption with a PBKDF2-derived key, used by both the storage vault
// (master password) and password-protected import/export files.

const webcrypto = (globalThis as unknown as { crypto: Crypto }).crypto;
const subtle = webcrypto.subtle;

/** Default KDF cost for our own vault / .json backups (OWASP 2023 for PBKDF2-SHA256).
 *  Stored per-blob, so older vaults created with a lower count still decrypt. */
export const DEFAULT_ITERATIONS = 600000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;

export function randomBytes(n: number): Uint8Array {
  return webcrypto.getRandomValues(new Uint8Array(n));
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export type PbkdfHash = "SHA-256" | "SHA-1" | "SHA-512";

/** Derive an AES-GCM key from a password and salt. */
export async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number = DEFAULT_ITERATIONS,
  hash: PbkdfHash = "SHA-256",
): Promise<CryptoKey> {
  const baseKey = await subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Derive raw 256-bit key material (for stashing in session storage while unlocked). */
export async function deriveRawKey(
  password: string,
  salt: Uint8Array,
  iterations: number = DEFAULT_ITERATIONS,
  hash: PbkdfHash = "SHA-256",
): Promise<Uint8Array> {
  const baseKey = await subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash },
    baseKey,
    256,
  );
  return new Uint8Array(bits);
}

/** Import raw key bytes back into an AES-GCM key. */
export async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return subtle.importKey(
    "raw",
    raw as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypt bytes with a derived key. Returns iv + ciphertext (ciphertext includes the GCM tag). */
export async function encryptBytes(
  key: CryptoKey,
  data: Uint8Array,
  iv: Uint8Array = randomBytes(IV_BYTES),
): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  const buf = await subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    data as BufferSource,
  );
  return { iv, ciphertext: new Uint8Array(buf) };
}

/** Decrypt bytes with a derived key. Throws if the key/tag is wrong. */
export async function decryptBytes(
  key: CryptoKey,
  iv: Uint8Array,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  const buf = await subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ciphertext as BufferSource,
  );
  return new Uint8Array(buf);
}

/** Self-describing encrypted blob for our own .json backups. */
export interface EncryptedBlob {
  v: 1;
  kdf: "PBKDF2";
  hash: PbkdfHash;
  iterations: number;
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
}

/** Encrypt a UTF-8 string into a self-describing blob (password-derived key). */
export async function encryptString(
  plaintext: string,
  password: string,
  iterations: number = DEFAULT_ITERATIONS,
  hash: PbkdfHash = "SHA-256",
): Promise<EncryptedBlob> {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password, salt, iterations, hash);
  const { iv, ciphertext } = await encryptBytes(
    key,
    new TextEncoder().encode(plaintext),
  );
  return {
    v: 1,
    kdf: "PBKDF2",
    hash,
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
  };
}

/** Decrypt a blob produced by {@link encryptString}. Throws on wrong password. */
export async function decryptString(
  blob: EncryptedBlob,
  password: string,
): Promise<string> {
  const key = await deriveKey(
    password,
    base64ToBytes(blob.salt),
    blob.iterations,
    blob.hash,
  );
  const plain = await decryptBytes(
    key,
    base64ToBytes(blob.iv),
    base64ToBytes(blob.ciphertext),
  );
  return new TextDecoder().decode(plain);
}
