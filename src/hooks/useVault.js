import { useCallback, useEffect, useState } from "react";
import { getAccounts, loadSettings, VaultLockedError } from "@/lib/vault";
import { sortAccounts } from "@/lib/sort";

/**
 * Loads accounts (sorted per the current sort mode), keeps a 1s ticking clock
 * for countdowns, and reloads whenever the vault or settings change in storage.
 */
export function useVault() {
  const [accounts, setAccounts] = useState([]);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  const reload = useCallback(async () => {
    try {
      const list = await getAccounts();
      const { sortMode } = await loadSettings();
      setLocked(false);
      setAccounts(sortAccounts(list, sortMode));
    } catch (err) {
      if (err instanceof VaultLockedError) {
        setLocked(true);
        setAccounts([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Async initial load; state updates happen after awaits, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;
    const listener = (changes, area) => {
      if (area === "local" && (changes.vault || changes.settings)) reload();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [reload]);

  return { accounts, locked, loading, now, reload };
}
