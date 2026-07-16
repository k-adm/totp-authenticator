const CAPTURE_KEY = "pendingCapture";

/**
 * Capture the currently visible tab as a PNG data URL. Must be called from an
 * extension context that holds `activeTab` (e.g. the popup, right after the user
 * opened it over the page that shows the QR code).
 */
export async function captureVisibleTabPng(): Promise<string> {
  return chrome.tabs.captureVisibleTab({ format: "png" });
}

/** Stash the screenshot in in-memory session storage (never written to disk). */
export async function storePendingCapture(dataUrl: string): Promise<void> {
  await chrome.storage.session.set({ [CAPTURE_KEY]: dataUrl });
}

export async function readPendingCapture(): Promise<string | undefined> {
  const res = await chrome.storage.session.get(CAPTURE_KEY);
  return res[CAPTURE_KEY] as string | undefined;
}

export async function clearPendingCapture(): Promise<void> {
  await chrome.storage.session.remove(CAPTURE_KEY);
}

/** Open the full-tab region selector page. */
export async function openCapturePage(): Promise<void> {
  await chrome.tabs.create({ url: chrome.runtime.getURL("capture.html") });
}
