import { useCallback, useEffect, useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";

import {
  getAccounts,
  loadSettings,
  loadVault,
  VaultLockedError,
} from "@/lib/vault";
import { sortAccounts } from "@/lib/sort";
import { DEFAULT_SETTINGS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { AccountList } from "./components/AccountList";
import { AddAccountDialog } from "./components/AddAccountDialog";
import { ImportExportPanel } from "./components/ImportExportPanel";
import { SecuritySettings } from "./components/SecuritySettings";
import { UnlockScreen } from "./components/UnlockScreen";

export default function App() {
  const [accounts, setAccounts] = useState([]);
  const [locked, setLocked] = useState(false);
  const [encrypted, setEncrypted] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [addOpen, setAddOpen] = useState(
    () => typeof window !== "undefined" && window.location.hash === "#add",
  );

  const load = useCallback(async () => {
    const vault = await loadVault();
    setEncrypted(vault.encryption === "password");
    setSettings(await loadSettings());
    try {
      const list = await getAccounts();
      setAccounts(list);
      setLocked(false);
    } catch (err) {
      if (err instanceof VaultLockedError) setLocked(true);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (window.location.hash === "#add") {
      history.replaceState(null, "", window.location.pathname);
    }
    // Async initial load; state updates happen after awaits, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-background px-6 py-8 text-foreground">
      <header className="mb-6 flex items-center gap-2">
        <ShieldCheck className="size-6 text-primary" />
        <h1 className="text-xl font-semibold">TOTP Authenticator</h1>
      </header>

      {!ready ? null : locked ? (
        <UnlockScreen onUnlocked={load} />
      ) : (
        <Tabs defaultValue="accounts">
          <TabsList>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="io">Import / Export</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {accounts.length} account{accounts.length === 1 ? "" : "s"}
              </p>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus /> Add account
              </Button>
            </div>
            <AccountList
              accounts={sortAccounts(accounts, settings.sortMode)}
              onChanged={load}
            />
          </TabsContent>

          <TabsContent value="io" className="pt-4">
            <ImportExportPanel accounts={accounts} onChanged={load} />
          </TabsContent>

          <TabsContent value="settings" className="pt-4">
            <SecuritySettings
              encrypted={encrypted}
              settings={settings}
              onChanged={load}
            />
          </TabsContent>
        </Tabs>
      )}

      {!locked && (
        <AddAccountDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onSaved={load}
        />
      )}
      <Toaster position="bottom-center" />
    </div>
  );
}
