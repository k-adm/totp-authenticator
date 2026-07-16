import type { Account, OtpAlgorithm } from "../types";
import {
  base64ToBytes,
  bytesToBase64,
  decryptBytes,
  deriveKey,
  encryptBytes,
  randomBytes,
} from "../crypto";
import { clampDigits, clampPeriod, normalizeBase32 } from "../totp";
import {
  AccountFields,
  ImportError,
  PasswordRequiredError,
  WrongPasswordError,
} from "./types";

// Exact scheme used by the 2FAS Authenticator app:
// PBKDF2-HMAC-SHA256, 10000 iterations, 256-bit key, AES-256-GCM (empty AAD).
// `servicesEncrypted` = base64(ciphertext+tag):base64(salt):base64(iv).
// A `reference` field (a fixed known string, same salt, own iv) lets 2FAS verify
// the password before decrypting the services.
const TWOFAS_ITERATIONS = 10000;
const TWOFAS_SALT_BYTES = 32;
const TWOFAS_IV_BYTES = 12;
const DEFAULT_ICON_COLLECTION = "a5b3fb65-4ec5-43e6-8ec1-49e24ca9e7ad";
const REFERENCE =
  "tRViSsLKzd86Hprh4ceC2OP7xazn4rrt4xhfEUbOjxLX8Rc3mkISXE0lWbmnWfggogbBJhtYgpK6fMl1D6m" +
  "tsy92R3HkdGfwuXbzLebqVFJsR7IZ2w58t938iymwG4824igYy1wi6n2WDpO1Q1P69zwJGs2F5a1qP4MyIiDSD7NCV2OvidX" +
  "QCBnDlGfmz0f1BQySRkkt4ryiJeCjD2o4QsveJ9uDBUn8ELyOrESv5R5DMDkD4iAF8TXU7KyoJujd";

interface TwofasFile {
  services?: TwofasService[];
  servicesEncrypted?: string;
  schemaVersion?: number;
}

interface TwofasService {
  name?: string;
  secret?: string;
  updatedAt?: number;
  otp?: {
    label?: string;
    account?: string;
    issuer?: string;
    digits?: number;
    period?: number;
    algorithm?: string;
    counter?: number;
    tokenType?: string;
    source?: string;
  };
  order?: { position?: number };
}

function coerceAlgorithm(value: string | undefined): OtpAlgorithm {
  const up = (value || "SHA1").toUpperCase();
  return up === "SHA256" || up === "SHA512" ? (up as OtpAlgorithm) : "SHA1";
}

function serviceToFields(s: TwofasService): AccountFields {
  const svc = s && typeof s === "object" ? s : ({} as TwofasService);
  const otp = svc.otp ?? {};
  const tokenType = String(otp.tokenType ?? "TOTP").toUpperCase();
  const type =
    tokenType === "HOTP" ? "hotp" : tokenType === "STEAM" ? "steam" : "totp";
  const secret = normalizeBase32(String(svc.secret ?? ""));
  if (!secret) throw new ImportError("A 2FAS service is missing its secret");
  const issuer = String(otp.issuer ?? svc.name ?? "");
  const account = otp.account ? String(otp.account) : undefined;
  return {
    type,
    issuer,
    label: account || String(otp.label ?? svc.name ?? (issuer || "OTP")),
    account,
    secret,
    algorithm: coerceAlgorithm(otp.algorithm),
    digits: clampDigits(otp.digits),
    period: clampPeriod(otp.period),
    counter: type === "hotp" ? Number(otp.counter) || 0 : undefined,
  };
}

function fieldsToService(
  a: Account,
  index: number,
): TwofasService & {
  icon: unknown;
} {
  const tokenType =
    a.type === "hotp" ? "HOTP" : a.type === "steam" ? "STEAM" : "TOTP";
  const name = a.issuer || a.label || "OTP";
  return {
    name,
    secret: a.secret,
    updatedAt: a.updatedAt || Date.now(),
    otp: {
      label: a.label || undefined,
      account: a.account || undefined,
      issuer: a.issuer || undefined,
      digits: a.digits,
      period: a.period,
      algorithm: a.algorithm,
      counter: a.type === "hotp" ? (a.counter ?? 0) : undefined,
      tokenType,
      source: "Link",
    },
    order: { position: index },
    icon: {
      selected: "Label",
      label: {
        text: name.slice(0, 2).toUpperCase(),
        backgroundColor: "Orange",
      },
      iconCollection: { id: DEFAULT_ICON_COLLECTION },
    },
  };
}

async function decryptServices(
  servicesEncrypted: string,
  password: string,
): Promise<TwofasService[]> {
  const parts = servicesEncrypted.split(":");
  if (parts.length < 3) throw new ImportError("Malformed 2FAS encrypted field");
  const [ctB64, saltB64, ivB64] = parts;
  let key: CryptoKey;
  let iv: Uint8Array;
  let ct: Uint8Array;
  try {
    key = await deriveKey(
      password,
      base64ToBytes(saltB64),
      TWOFAS_ITERATIONS,
      "SHA-256",
    );
    iv = base64ToBytes(ivB64);
    ct = base64ToBytes(ctB64);
  } catch {
    throw new ImportError("Malformed 2FAS encrypted field");
  }
  let plain: Uint8Array;
  try {
    plain = await decryptBytes(key, iv, ct);
  } catch {
    throw new WrongPasswordError();
  }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(plain));
    if (!Array.isArray(parsed)) throw new Error("not an array");
    return parsed as TwofasService[];
  } catch {
    throw new ImportError("Corrupt 2FAS data after decryption");
  }
}

/** Parse a .2fas file (object already JSON-parsed). */
export async function parseTwofas(
  obj: TwofasFile,
  password?: string,
): Promise<AccountFields[]> {
  let services: TwofasService[];
  if (obj.servicesEncrypted) {
    if (!password) throw new PasswordRequiredError();
    services = await decryptServices(obj.servicesEncrypted, password);
  } else {
    services = obj.services ?? [];
  }
  return services.map(serviceToFields);
}

/** Serialize accounts to a .2fas backup; encrypts (2FAS scheme) when a password is given. */
export async function exportTwofas(
  accounts: Account[],
  password?: string,
): Promise<string> {
  const services = accounts.map(fieldsToService);
  const base = {
    services: [] as unknown[],
    groups: [] as unknown[],
    updatedAt: Date.now(),
    schemaVersion: 4,
    appVersionCode: 5000017,
    appVersionName: "5.3.5",
    appOrigin: "browser",
  };

  if (!password) {
    return JSON.stringify({ ...base, services }, null, 2);
  }

  const salt = randomBytes(TWOFAS_SALT_BYTES);
  const key = await deriveKey(password, salt, TWOFAS_ITERATIONS, "SHA-256");
  const enc = new TextEncoder();

  const servicesIv = randomBytes(TWOFAS_IV_BYTES);
  const servicesCt = (
    await encryptBytes(key, enc.encode(JSON.stringify(services)), servicesIv)
  ).ciphertext;

  const referenceIv = randomBytes(TWOFAS_IV_BYTES);
  const referenceCt = (
    await encryptBytes(key, enc.encode(REFERENCE), referenceIv)
  ).ciphertext;

  const saltB64 = bytesToBase64(salt);
  return JSON.stringify(
    {
      ...base,
      servicesEncrypted: `${bytesToBase64(servicesCt)}:${saltB64}:${bytesToBase64(servicesIv)}`,
      reference: `${bytesToBase64(referenceCt)}:${saltB64}:${bytesToBase64(referenceIv)}`,
    },
    null,
    2,
  );
}
