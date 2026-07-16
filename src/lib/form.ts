import type { Account, OtpAlgorithm, OtpType } from "./types";
import { clampDigits, clampPeriod, normalizeBase32 } from "./totp";

/** Editable shape used by the account form (strings for inputs). */
export interface AccountFormValue {
  type: OtpType;
  issuer: string;
  account: string;
  secret: string;
  algorithm: OtpAlgorithm;
  digits: number;
  period: number;
  counter: number;
}

export function emptyFormValue(): AccountFormValue {
  return {
    type: "totp",
    issuer: "",
    account: "",
    secret: "",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    counter: 0,
  };
}

/** Prefill the form from parsed otpauth fields. */
export function formFromParsed(
  parsed: Omit<Account, "id" | "order" | "createdAt" | "updatedAt">,
): AccountFormValue {
  return {
    type: parsed.type,
    issuer: parsed.issuer || "",
    account: parsed.account || parsed.label || "",
    secret: parsed.secret || "",
    algorithm: parsed.algorithm || "SHA1",
    digits: parsed.digits || 6,
    period: parsed.period || 30,
    counter: parsed.counter ?? 0,
  };
}

/** Convert form input into account fields ready for the vault. */
export function formToFields(
  v: AccountFormValue,
): Omit<Account, "id" | "order" | "createdAt" | "updatedAt"> {
  const issuer = v.issuer.trim();
  const account = v.account.trim();
  return {
    type: v.type,
    issuer,
    label: account || issuer || "OTP",
    account: account || undefined,
    secret: normalizeBase32(v.secret),
    algorithm: v.algorithm,
    digits: clampDigits(v.digits),
    period: clampPeriod(v.period),
    counter: v.type === "hotp" ? Number(v.counter) || 0 : undefined,
  };
}
