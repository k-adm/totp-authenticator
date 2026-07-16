import { base32Encode } from "../base32";
import { base64ToBytes } from "../crypto";
import type { OtpAlgorithm } from "../types";
import { AccountFields, ImportError } from "./types";

// Minimal protobuf reader for Google Authenticator's MigrationPayload.
// Schema: repeated OtpParameters otp_parameters = 1; each has
//   secret=1 (bytes), name=2 (string), issuer=3 (string),
//   algorithm=4 (enum), digits=5 (enum), type=6 (enum), counter=7 (int64).

class Reader {
  private pos = 0;
  constructor(private buf: Uint8Array) {}
  get done(): boolean {
    return this.pos >= this.buf.length;
  }
  varint(): number {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = this.buf[this.pos++];
      result += (byte & 0x7f) * Math.pow(2, shift);
      shift += 7;
    } while (byte & 0x80);
    return result;
  }
  bytes(): Uint8Array {
    const len = this.varint();
    const out = this.buf.subarray(this.pos, this.pos + len);
    this.pos += len;
    return out;
  }
  skip(wireType: number): void {
    if (wireType === 0) this.varint();
    else if (wireType === 2) this.bytes();
    else if (wireType === 5) this.pos += 4;
    else if (wireType === 1) this.pos += 8;
    else throw new ImportError("Unsupported protobuf wire type");
  }
}

const ALGO: Record<number, OtpAlgorithm> = {
  1: "SHA1",
  2: "SHA256",
  3: "SHA512",
};

function parseOtpParameters(bytes: Uint8Array): AccountFields | null {
  const r = new Reader(bytes);
  let secret = new Uint8Array();
  let name = "";
  let issuer = "";
  let algorithm: OtpAlgorithm = "SHA1";
  let digits = 6;
  let type: "totp" | "hotp" = "totp";
  let counter = 0;

  while (!r.done) {
    const tag = r.varint();
    const field = tag >>> 3;
    const wire = tag & 7;
    switch (field) {
      case 1:
        secret = r.bytes().slice();
        break;
      case 2:
        name = new TextDecoder().decode(r.bytes());
        break;
      case 3:
        issuer = new TextDecoder().decode(r.bytes());
        break;
      case 4:
        algorithm = ALGO[r.varint()] || "SHA1";
        break;
      case 5:
        digits = r.varint() === 2 ? 8 : 6;
        break;
      case 6:
        type = r.varint() === 1 ? "hotp" : "totp";
        break;
      case 7:
        // HOTP counter is a protobuf int64. Account.counter is a JS number, so
        // values above 2^53 lose precision; in practice Google Authenticator
        // only exports TOTP, so this is an accepted limitation.
        counter = r.varint();
        break;
      default:
        r.skip(wire);
    }
  }

  if (secret.length === 0) return null;
  const label = name || issuer || "OTP";
  return {
    type,
    issuer: issuer || "",
    label,
    account: name || undefined,
    secret: base32Encode(secret),
    algorithm,
    digits,
    period: 30,
    counter: type === "hotp" ? counter : undefined,
  };
}

/** Parse an `otpauth-migration://offline?data=...` URI into account fields. */
export function parseGoogleMigration(uri: string): AccountFields[] {
  const trimmed = uri.trim();
  const marker = "data=";
  const idx = trimmed.indexOf(marker);
  if (!trimmed.startsWith("otpauth-migration://") || idx === -1) {
    throw new ImportError("Not a Google Authenticator export link");
  }
  let payload: Uint8Array;
  try {
    const raw = decodeURIComponent(
      trimmed.slice(idx + marker.length).split("&")[0],
    );
    const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
    payload = base64ToBytes(normalized);
  } catch {
    throw new ImportError("Malformed Google Authenticator data");
  }

  const r = new Reader(payload);
  const accounts: AccountFields[] = [];
  while (!r.done) {
    const tag = r.varint();
    const field = tag >>> 3;
    const wire = tag & 7;
    if (field === 1 && wire === 2) {
      const parsed = parseOtpParameters(r.bytes());
      if (parsed) accounts.push(parsed);
    } else {
      r.skip(wire);
    }
  }
  if (accounts.length === 0) {
    throw new ImportError("No accounts found in the export");
  }
  return accounts;
}
