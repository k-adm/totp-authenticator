import { parseOtpUri } from "../totp";
import { APP_MARKER, parseOurJson } from "./json";
import { parseTwofas } from "./twofas";
import { parseGoogleMigration } from "./google-auth";
import {
  AccountFields,
  BackupFormat,
  DetectResult,
  ImportError,
} from "./types";

/** Identify the backup format and whether it is encrypted, from raw file text. */
export function detectFormat(text: string): DetectResult {
  const t = text.trim();
  if (t.startsWith("otpauth-migration://")) {
    return { format: "google", encrypted: false };
  }
  if (t.startsWith("otpauth://")) {
    return { format: "otpauth-uri", encrypted: false };
  }
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(t);
  } catch {
    throw new ImportError(
      "Unrecognized file - expected .json, .2fas or an otpauth link",
    );
  }
  if (obj.app === APP_MARKER || obj.encrypted || Array.isArray(obj.accounts)) {
    return { format: "totp-json", encrypted: Boolean(obj.encrypted) };
  }
  if (
    obj.servicesEncrypted ||
    Array.isArray(obj.services) ||
    obj.schemaVersion !== undefined
  ) {
    return { format: "2fas", encrypted: Boolean(obj.servicesEncrypted) };
  }
  throw new ImportError("Unrecognized backup format");
}

export interface ImportResult {
  accounts: AccountFields[];
  format: BackupFormat;
}

/** Parse any supported backup/link into account fields. */
export async function importAny(
  text: string,
  password?: string,
): Promise<ImportResult> {
  const t = text.trim();
  const { format } = detectFormat(t);
  switch (format) {
    case "google":
      return { accounts: parseGoogleMigration(t), format };
    case "otpauth-uri":
      return { accounts: [parseOtpUri(t)], format };
    case "totp-json":
      return { accounts: await parseOurJson(JSON.parse(t), password), format };
    case "2fas":
      return { accounts: await parseTwofas(JSON.parse(t), password), format };
  }
}
