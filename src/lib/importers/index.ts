import type { Account } from "../types";
import { exportOurJson } from "./json";
import { exportTwofas } from "./twofas";

export { detectFormat, importAny } from "./detect";
export type { ImportResult } from "./detect";
export {
  PasswordRequiredError,
  WrongPasswordError,
  ImportError,
} from "./types";
export type { AccountFields, BackupFormat } from "./types";

export type ExportFormat = "totp-json" | "2fas";

export interface ExportOutput {
  content: string;
  filename: string;
  mime: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Produce a downloadable backup in the requested format, optionally encrypted. */
export async function exportBackup(
  format: ExportFormat,
  accounts: Account[],
  password?: string,
): Promise<ExportOutput> {
  if (format === "2fas") {
    return {
      content: await exportTwofas(accounts, password),
      filename: `2fas-backup-${today()}.2fas`,
      mime: "application/json",
    };
  }
  return {
    content: await exportOurJson(accounts, password),
    filename: `totp-backup-${today()}.json`,
    mime: "application/json",
  };
}
