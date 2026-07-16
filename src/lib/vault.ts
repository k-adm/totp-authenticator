import {
  type Account,
  type Settings,
  type VaultData,
  DEFAULT_SETTINGS,
  EMPTY_VAULT,
} from "./types";
import {
  DEFAULT_ITERATIONS,
  SALT_BYTES,
  base64ToBytes,
  bytesToBase64,
  decryptBytes,
  deriveRawKey,
  encryptBytes,
  importAesKey,
  randomBytes,
} from "./crypto";
import { uuid } from "./utils";
import { normalizeBase32 } from "./totp";
import { WrongPasswordError } from "./importers/types";

const VAULT_KEY = "vault";
const SETTINGS_KEY = "settings";
const SESSION_KEY = "vaultSession";

const isExtension =
  typeof chrome !== "undefined" && !!chrome.storage && !!chrome.storage.local;
const hasSession =
  typeof chrome !== "undefined" && !!chrome.storage && !!chrome.storage.session;

async function getRaw<T>(key: string): Promise<T | undefined> {
  if (isExtension) {
    const res = await chrome.storage.local.get(key);
    return res[key] as T | undefined;
  }
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : undefined;
}

async function setRaw(key: string, value: unknown): Promise<void> {
  if (isExtension) {
    await chrome.storage.local.set({ [key]: value });
  } else {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

// ---- Settings -------------------------------------------------------------

export async function loadSettings(): Promise<Settings> {
  const stored = await getRaw<Partial<Settings>>(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

export async function saveSettings(
  patch: Partial<Settings>,
): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await setRaw(SETTINGS_KEY, next);
  return next;
}

// ---- Vault metadata -------------------------------------------------------

export async function loadVault(): Promise<VaultData> {
  const stored = await getRaw<VaultData>(VAULT_KEY);
  return stored ?? { ...EMPTY_VAULT };
}

async function saveVault(vault: VaultData): Promise<void> {
  await setRaw(VAULT_KEY, vault);
}

export async function isEncrypted(): Promise<boolean> {
  return (await loadVault()).encryption === "password";
}

// ---- Unlocked session -----------------------------------------------------
//
// While unlocked, the raw AES key is kept in chrome.storage.session (in-memory,
// extension-only, never written to disk, cleared when the browser closes) so
// that the popup, options and capture pages share one unlock. `lockAt` gives an
// idle timeout without needing the alarms permission.

interface SessionState {
  key: string; // base64 raw AES key
  lockAt: number; // epoch ms; 0 = never
}

let memSession: SessionState | null = null;

async function getSession(): Promise<SessionState | null> {
  if (hasSession) {
    const res = await chrome.storage.session.get(SESSION_KEY);
    return (res[SESSION_KEY] as SessionState | undefined) ?? null;
  }
  return memSession;
}

async function setSession(state: SessionState): Promise<void> {
  if (hasSession) await chrome.storage.session.set({ [SESSION_KEY]: state });
  else memSession = state;
}

async function clearSession(): Promise<void> {
  if (hasSession) await chrome.storage.session.remove(SESSION_KEY);
  else memSession = null;
}

export class VaultLockedError extends Error {
  constructor() {
    super("Vault is locked");
    this.name = "VaultLockedError";
  }
}

async function currentKey(): Promise<CryptoKey | null> {
  const st = await getSession();
  if (!st) return null;
  if (st.lockAt && Date.now() > st.lockAt) {
    await clearSession();
    return null;
  }
  return importAesKey(base64ToBytes(st.key));
}

async function bumpIdleTimer(): Promise<void> {
  const st = await getSession();
  if (!st) return;
  const { autoLockMinutes } = await loadSettings();
  // Re-check after the await: a concurrent lock()/expiry must not be resurrected
  // by re-persisting the previously-read key.
  const still = await getSession();
  if (!still) return;
  const lockAt = autoLockMinutes > 0 ? Date.now() + autoLockMinutes * 60000 : 0;
  await setSession({ key: still.key, lockAt });
}

async function startSession(rawKey: Uint8Array): Promise<void> {
  const { autoLockMinutes } = await loadSettings();
  await setSession({
    key: bytesToBase64(rawKey),
    lockAt: autoLockMinutes > 0 ? Date.now() + autoLockMinutes * 60000 : 0,
  });
}

export async function isLocked(): Promise<boolean> {
  if ((await loadVault()).encryption !== "password") return false;
  return (await currentKey()) === null;
}

export async function lock(): Promise<void> {
  await clearSession();
}

/** Unlock a password-protected vault. Throws WrongPasswordError on failure. */
export async function unlock(password: string): Promise<void> {
  const vault = await loadVault();
  if (vault.encryption !== "password" || !vault.kdf) return;
  const rawKey = await deriveRawKey(
    password,
    base64ToBytes(vault.kdf.salt),
    vault.kdf.iterations,
    vault.kdf.hash,
  );
  const key = await importAesKey(rawKey);
  try {
    await decryptBytes(
      key,
      base64ToBytes(vault.iv ?? ""),
      base64ToBytes(vault.ciphertext ?? ""),
    );
  } catch {
    throw new WrongPasswordError();
  }
  await startSession(rawKey);
}

// ---- Accounts -------------------------------------------------------------

async function decryptAccounts(
  key: CryptoKey,
  vault: VaultData,
): Promise<Account[]> {
  const plain = await decryptBytes(
    key,
    base64ToBytes(vault.iv ?? ""),
    base64ToBytes(vault.ciphertext ?? ""),
  );
  return JSON.parse(new TextDecoder().decode(plain)) as Account[];
}

async function encryptAccounts(
  key: CryptoKey,
  accounts: Account[],
): Promise<{ iv: string; ciphertext: string }> {
  const { iv, ciphertext } = await encryptBytes(
    key,
    new TextEncoder().encode(JSON.stringify(accounts)),
  );
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext) };
}

export async function getAccounts(): Promise<Account[]> {
  const vault = await loadVault();
  if (vault.encryption === "none") {
    return sortByOrder(vault.accounts ?? []);
  }
  const key = await currentKey();
  if (!key) throw new VaultLockedError();
  const accounts = await decryptAccounts(key, vault);
  await bumpIdleTimer();
  return sortByOrder(accounts);
}

export async function persistAccounts(accounts: Account[]): Promise<void> {
  const vault = await loadVault();
  if (vault.encryption === "none") {
    await saveVault({
      version: vault.version,
      encryption: "none",
      accounts,
    });
    return;
  }
  const key = await currentKey();
  if (!key) throw new VaultLockedError();
  const { iv, ciphertext } = await encryptAccounts(key, accounts);
  await saveVault({
    version: vault.version,
    encryption: "password",
    kdf: vault.kdf,
    iv,
    ciphertext,
  });
  await bumpIdleTimer();
}

export async function addAccount(
  fields: Omit<Account, "id" | "order" | "createdAt" | "updatedAt">,
): Promise<Account> {
  const accounts = await getAccounts();
  const now = Date.now();
  const account: Account = {
    ...fields,
    id: uuid(),
    order: accounts.length,
    createdAt: now,
    updatedAt: now,
  };
  await persistAccounts([...accounts, account]);
  return account;
}

export async function addAccounts(
  list: Omit<Account, "id" | "order" | "createdAt" | "updatedAt">[],
): Promise<Account[]> {
  const accounts = await getAccounts();
  const seen = new Set(accounts.map(dedupKey));
  const now = Date.now();
  const created: Account[] = [];
  for (const fields of list) {
    const key = dedupKey(fields);
    if (seen.has(key)) continue; // skip duplicates (existing or within the batch)
    seen.add(key);
    created.push({
      ...fields,
      id: uuid(),
      order: accounts.length + created.length,
      createdAt: now,
      updatedAt: now,
    });
  }
  if (created.length) await persistAccounts([...accounts, ...created]);
  return created;
}

export async function updateAccount(
  id: string,
  patch: Partial<Account>,
): Promise<void> {
  const accounts = await getAccounts();
  const next = accounts.map((a) =>
    a.id === id ? { ...a, ...patch, id: a.id, updatedAt: Date.now() } : a,
  );
  await persistAccounts(next);
}

export async function removeAccount(id: string): Promise<void> {
  const accounts = await getAccounts();
  await persistAccounts(reindex(accounts.filter((a) => a.id !== id)));
}

export async function reorderAccounts(ids: string[]): Promise<void> {
  const accounts = await getAccounts();
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const next = ids
    .map((id) => byId.get(id))
    .filter((a): a is Account => Boolean(a));
  await persistAccounts(reindex(next));
}

// ---- Master password lifecycle -------------------------------------------

/** Enable (or re-key) a master password. Requires the vault to be unlocked if
 *  it is already password-protected. */
export async function setMasterPassword(password: string): Promise<void> {
  const accounts = await getAccounts(); // throws if currently locked
  const salt = randomBytes(SALT_BYTES);
  const rawKey = await deriveRawKey(password, salt, DEFAULT_ITERATIONS);
  const key = await importAesKey(rawKey);
  const { iv, ciphertext } = await encryptAccounts(key, accounts);
  await saveVault({
    version: 1,
    encryption: "password",
    kdf: {
      salt: bytesToBase64(salt),
      iterations: DEFAULT_ITERATIONS,
      hash: "SHA-256",
    },
    iv,
    ciphertext,
  });
  await startSession(rawKey);
}

/** Remove the master password, storing accounts as plaintext again. Requires unlock. */
export async function removeMasterPassword(): Promise<void> {
  const accounts = await getAccounts(); // throws if locked
  await saveVault({ version: 1, encryption: "none", accounts });
  await clearSession();
}

// ---- helpers --------------------------------------------------------------

function sortByOrder(accounts: Account[]): Account[] {
  return [...accounts].sort((a, b) => a.order - b.order);
}

function reindex(accounts: Account[]): Account[] {
  return accounts.map((a, i) => ({ ...a, order: i }));
}

/** Identity used for import de-duplication: same secret + issuer = same account. */
function dedupKey(a: { secret: string; issuer?: string }): string {
  return `${normalizeBase32(a.secret)}|${(a.issuer ?? "").toLowerCase()}`;
}
