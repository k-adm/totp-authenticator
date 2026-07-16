import * as OTPAuth from "otpauth";
import type { Account, OtpAlgorithm, OtpType } from "./types";

/** Normalize a user- or import-provided base32 secret: strip spaces/padding, uppercase. */
export function normalizeBase32(secret: string): string {
  return (secret || "").replace(/[\s-]/g, "").replace(/=+$/, "").toUpperCase();
}

/** True if the string is a usable base32 secret. */
export function isValidSecret(secret: string): boolean {
  const s = normalizeBase32(secret);
  if (!s) return false;
  try {
    return OTPAuth.Secret.fromBase32(s).bytes.length > 0;
  } catch {
    return false;
  }
}

/** Clamp OTP digit count to a sane range, defaulting on invalid/out-of-range input. */
export function clampDigits(value: unknown): number {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n >= 4 && n <= 10 ? n : 6;
}

/** Clamp OTP period (seconds) to a sane range, defaulting on invalid/out-of-range input. */
export function clampPeriod(value: unknown): number {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n >= 5 && n <= 300 ? n : 30;
}

/** Build an otpauth instance from a stored account. */
export function buildOtp(a: Account): OTPAuth.TOTP | OTPAuth.HOTP {
  const common = {
    issuer: a.issuer || undefined,
    label: a.label || a.account || "OTP",
    algorithm: a.algorithm,
    digits: a.digits,
    secret: OTPAuth.Secret.fromBase32(normalizeBase32(a.secret)),
  };
  if (a.type === "hotp") {
    return new OTPAuth.HOTP({ ...common, counter: a.counter ?? 0 });
  }
  return new OTPAuth.TOTP({ ...common, period: a.period });
}

const STEAM_ALPHABET = "23456789BCDFGHJKMNPQRTVWXY";

/** Steam Guard code: standard TOTP dynamic truncation mapped to base-26 (5 chars). */
function steamCode(a: Account, timestamp: number): string {
  const totp = new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 10, // full 31-bit truncated value fits in 10 digits
    period: a.period || 30,
    secret: OTPAuth.Secret.fromBase32(normalizeBase32(a.secret)),
  });
  let n = parseInt(totp.generate({ timestamp }), 10);
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += STEAM_ALPHABET[n % 26];
    n = Math.floor(n / 26);
  }
  return out;
}

/** Current one-time code for an account. Returns null if the secret is invalid. */
export function generateCode(
  a: Account,
  timestamp = Date.now(),
): string | null {
  try {
    if (a.type === "steam") return steamCode(a, timestamp);
    const otp = buildOtp(a);
    if (otp instanceof OTPAuth.HOTP) return otp.generate();
    return otp.generate({ timestamp });
  } catch {
    return null;
  }
}

/** Milliseconds until the current TOTP code rolls over. HOTP returns 0. */
export function remainingMs(a: Account, now = Date.now()): number {
  if (a.type === "hotp") return 0;
  const periodMs = (a.period || 30) * 1000;
  return periodMs - (now % periodMs);
}

/** Fraction (0..1) of the current period already elapsed. */
export function elapsedFraction(a: Account, now = Date.now()): number {
  if (a.type === "hotp") return 0;
  const periodMs = (a.period || 30) * 1000;
  return (now % periodMs) / periodMs;
}

/** Group a code into two halves for readability, e.g. "123 456". */
export function formatCode(code: string): string {
  if (code.length % 2 === 0) {
    const half = code.length / 2;
    return `${code.slice(0, half)} ${code.slice(half)}`;
  }
  return code;
}

const ALGORITHMS: OtpAlgorithm[] = ["SHA1", "SHA256", "SHA512"];

function coerceAlgorithm(value: string | undefined): OtpAlgorithm {
  const up = (value || "SHA1").toUpperCase().replace("-", "");
  return (ALGORITHMS.find((a) => a === up) ?? "SHA1") as OtpAlgorithm;
}

/** Parsed otpauth:// fields, ready to merge into a new Account (no id/order/timestamps). */
export type ParsedOtp = Omit<
  Account,
  "id" | "order" | "createdAt" | "updatedAt"
>;

/** Parse an otpauth:// URI into account fields. Throws on malformed input. */
export function parseOtpUri(uri: string): ParsedOtp {
  const otp = OTPAuth.URI.parse(uri.trim());
  const type: OtpType = otp instanceof OTPAuth.HOTP ? "hotp" : "totp";
  const label = otp.label || "";
  return {
    type,
    issuer: otp.issuer || "",
    label,
    account: label,
    secret: otp.secret.base32,
    algorithm: coerceAlgorithm(otp.algorithm),
    digits: otp.digits,
    period: otp instanceof OTPAuth.TOTP ? otp.period : 30,
    counter: otp instanceof OTPAuth.HOTP ? otp.counter : undefined,
  };
}

/** Serialize an account back to an otpauth:// URI (for QR export / migration).
 *  Steam has no standard otpauth form, so we refuse rather than emit a plain
 *  TOTP URI that other apps would generate wrong codes from. */
export function buildOtpUri(a: Account): string {
  if (a.type === "steam") {
    throw new Error("Steam accounts have no standard otpauth:// URI");
  }
  return OTPAuth.URI.stringify(buildOtp(a));
}
