// Service worker for TOTP Authenticator.
// Proactively purges the unlocked session key once its idle timeout elapses,
// even when no extension page is open (the page-side check in vault.ts only
// runs on access). Keeps the raw AES key from lingering in session memory.

const SESSION_KEY = "vaultSession";
const ALARM = "idle-lock-check";

function ensureAlarm() {
  chrome.alarms.create(ALARM, { periodInMinutes: 1 });
}

chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(ensureAlarm);
ensureAlarm();

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM) return;
  const res = await chrome.storage.session.get(SESSION_KEY);
  const s = res[SESSION_KEY];
  if (s && s.lockAt && Date.now() > s.lockAt) {
    await chrome.storage.session.remove(SESSION_KEY);
  }
});
