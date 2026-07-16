import type { Account } from "../types";

/** Account data without vault-managed fields, produced by every importer. */
export type AccountFields = Omit<
  Account,
  "id" | "order" | "createdAt" | "updatedAt"
>;

export type BackupFormat = "totp-json" | "2fas" | "google" | "otpauth-uri";

export interface DetectResult {
  format: BackupFormat;
  encrypted: boolean;
}

/** Thrown when a file is encrypted and no (or a wrong) password was supplied. */
export class PasswordRequiredError extends Error {
  constructor(message = "This file is password-protected") {
    super(message);
    this.name = "PasswordRequiredError";
  }
}

export class WrongPasswordError extends Error {
  constructor(message = "Wrong password") {
    super(message);
    this.name = "WrongPasswordError";
  }
}

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}
