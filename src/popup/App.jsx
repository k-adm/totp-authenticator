import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  KeyRound,
  Monitor,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
} from "lucide-react";

import { useVault } from "@/hooks/useVault";
import { removeAccount, unlock, updateAccount } from "@/lib/vault";
import { WrongPasswordError } from "@/lib/importers";
import {
  captureVisibleTabPng,
  openCapturePage,
  storePendingCapture,
} from "@/lib/screenshot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import { AccountRow } from "./components/AccountRow";

function openOptions(hash = "") {
  const isExt = typeof chrome !== "undefined" && chrome.runtime?.getURL;
  if (isExt) {
    chrome.tabs.create({ url: chrome.runtime.getURL("options.html" + hash) });
  } else {
    window.open("options.html" + hash, "_blank");
  }
}

export default function App() {
  const { accounts, locked, loading, now, reload } = useVault();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) =>
      [a.issuer, a.label, a.account]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q)),
    );
  }, [accounts, query]);

  async function handleDelete(account) {
    await removeAccount(account.id);
    await reload();
    toast.success(`Removed ${account.issuer || account.label || "account"}`);
  }

  async function handleIncrement(account) {
    await updateAccount(account.id, { counter: (account.counter ?? 0) + 1 });
    await reload();
  }

  async function scanScreen() {
    try {
      const dataUrl = await captureVisibleTabPng();
      await storePendingCapture(dataUrl);
      await openCapturePage();
      window.close();
    } catch {
      toast.error("Could not capture this tab");
    }
  }

  return (
    <div className="flex h-[520px] flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 border-b px-3 py-2.5">
        <ShieldCheck className="size-5 text-primary" />
        <h1 className="flex-1 text-sm font-semibold">Authenticator</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              title="Add account"
            >
              <Plus />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={scanScreen}>
              <Monitor /> Scan QR on screen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openOptions("#add")}>
              <Pencil /> Add manually / import
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          title="Settings"
          onClick={() => openOptions()}
        >
          <Settings />
        </Button>
      </header>

      {!locked && accounts.length > 0 && (
        <div className="relative border-b px-3 py-2">
          <Search className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-8 pl-8"
          />
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <CenteredHint>Loading…</CenteredHint>
        ) : locked ? (
          <UnlockView onUnlocked={reload} />
        ) : accounts.length === 0 ? (
          <EmptyView onAdd={() => openOptions("#add")} />
        ) : filtered.length === 0 ? (
          <CenteredHint>No matches</CenteredHint>
        ) : (
          <div className="h-full overflow-y-auto overflow-x-hidden">
            <div className="flex flex-col gap-0.5 p-2">
              {filtered.map((a) => (
                <AccountRow
                  key={a.id}
                  account={a}
                  now={now}
                  onDelete={handleDelete}
                  onIncrement={handleIncrement}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <Toaster position="bottom-center" />
    </div>
  );
}

function CenteredHint({ children }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function EmptyView({ onAdd }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <ShieldCheck className="size-10 text-muted-foreground/50" />
      <div className="text-sm text-muted-foreground">
        No accounts yet. Add your first 2FA account to start generating codes.
      </div>
      <Button size="sm" onClick={onAdd}>
        <Plus /> Add account
      </Button>
    </div>
  );
}

function UnlockView({ onUnlocked }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    try {
      await unlock(password);
      setPassword("");
      await onUnlocked();
    } catch (err) {
      toast.error(
        err instanceof WrongPasswordError
          ? "Wrong password"
          : "Could not unlock",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <KeyRound className="size-10 text-muted-foreground/50" />
      <div className="text-sm text-muted-foreground">
        The vault is locked. Enter your master password.
      </div>
      <Input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Master password"
        className="max-w-56"
      />
      <Button type="submit" size="sm" disabled={busy || !password}>
        Unlock
      </Button>
    </form>
  );
}
