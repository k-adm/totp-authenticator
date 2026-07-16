import type { Account, OtpAlgorithm, OtpType } from "../types";
import { type EncryptedBlob, decryptString, encryptString } from "../crypto";
import { clampDigits, clampPeriod, normalizeBase32 } from "../totp";
import {
  AccountFields,
  ImportError,
  PasswordRequiredError,
  WrongPasswordError,
} from "./types";

export const APP_MARKER = "totp-authenticator";

interface OurBackup {
  app: string;
  schemaVersion: number;
  accounts?: unknown[];
  encrypted?: EncryptedBlob;
}

function toFields(a: Account): AccountFields {
  return {
    type: a.type,
    issuer: a.issuer,
    label: a.label,
    account: a.account,
    secret: a.secret,
    algorithm: a.algorithm,
    digits: a.digits,
    period: a.period,
    counter: a.counter,
    iconLabel: a.iconLabel,
    iconColor: a.iconColor,
  };
}

const ALGORITHMS: OtpAlgorithm[] = ["SHA1", "SHA256", "SHA512"];
const TYPES: OtpType[] = ["totp", "hotp", "steam"];

/** Validate + coerce a raw account object into clean AccountFields. */
export function coerceAccount(raw: unknown): AccountFields {
  const o = (raw ?? {}) as Record<string, unknown>;
  const secret = normalizeBase32(String(o.secret ?? ""));
  if (!secret) throw new ImportError("Account is missing a secret");
  const type = TYPES.includes(o.type as OtpType) ? (o.type as OtpType) : "totp";
  const issuer = String(o.issuer ?? "");
  const label = String(o.label ?? o.account ?? issuer ?? "OTP");
  return {
    type,
    issuer,
    label,
    account: o.account ? String(o.account) : undefined,
    secret,
    algorithm: ALGORITHMS.includes(o.algorithm as OtpAlgorithm)
      ? (o.algorithm as OtpAlgorithm)
      : "SHA1",
    digits: clampDigits(o.digits),
    period: clampPeriod(o.period),
    counter: type === "hotp" ? Number(o.counter) || 0 : undefined,
    iconLabel: o.iconLabel ? String(o.iconLabel) : undefined,
    iconColor: o.iconColor ? String(o.iconColor) : undefined,
  };
}

/** Serialize accounts to our JSON format; encrypts when a password is given. */
export async function exportOurJson(
  accounts: Account[],
  password?: string,
): Promise<string> {
  const inner = { accounts: accounts.map(toFields) };
  if (password) {
    const encrypted = await encryptString(JSON.stringify(inner), password);
    return JSON.stringify(
      { app: APP_MARKER, schemaVersion: 1, encrypted },
      null,
      2,
    );
  }
  return JSON.stringify(
    { app: APP_MARKER, schemaVersion: 1, accounts: inner.accounts },
    null,
    2,
  );
}

/** Parse our JSON backup (object already JSON-parsed). */
export async function parseOurJson(
  obj: OurBackup,
  password?: string,
): Promise<AccountFields[]> {
  if (obj.encrypted) {
    if (!password) throw new PasswordRequiredError();
    let text: string;
    try {
      text = await decryptString(obj.encrypted, password);
    } catch {
      throw new WrongPasswordError();
    }
    const inner = JSON.parse(text) as { accounts?: unknown[] };
    return (inner.accounts ?? []).map(coerceAccount);
  }
  return (obj.accounts ?? []).map(coerceAccount);
}
