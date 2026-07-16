import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// `globalThis.crypto` is always present in extension pages and the service
// worker; typed explicitly to avoid the DOM vs @types/node `crypto` conflict.
const webcrypto = (globalThis as unknown as { crypto: Crypto }).crypto;

/** Unique id for new accounts. */
export function uuid(): string {
  return webcrypto.randomUUID();
}

/** Best-effort clipboard clear after a delay. Read-guarded so it never wipes
 *  content the user copied afterwards; a no-op where clipboard read is not
 *  permitted (we don't request clipboardRead) or the page has already closed. */
function scheduleClipboardClear(text: string, delayMs = 30000): void {
  setTimeout(() => {
    navigator.clipboard
      .readText()
      .then((current) => {
        if (current === text) return navigator.clipboard.writeText("");
      })
      .catch(() => {});
  }, delayMs);
}

/** Copy text to the clipboard from an extension page (must run on a user gesture). */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    scheduleClipboardClear(text);
    return true;
  } catch {
    return false;
  }
}
