import { useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Lock, LockKeyhole, ShieldOff } from "lucide-react";

import {
  lock,
  removeMasterPassword,
  saveSettings,
  setMasterPassword,
} from "@/lib/vault";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const AUTO_LOCK_OPTIONS = [
  { value: 0, label: "Never" },
  { value: 1, label: "1 minute" },
  { value: 5, label: "5 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
];

const SORT_OPTIONS = [
  { value: "name", label: "Name (A-Z)" },
  { value: "custom", label: "Custom order" },
  { value: "recent", label: "Recently added" },
];

export function SecuritySettings({ encrypted, settings, onChanged }) {
  const { theme, setTheme } = useTheme();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function applyPassword(isChange) {
    if (pw.length < 8) {
      toast.error("Use at least 8 characters");
      return;
    }
    if (pw !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      await setMasterPassword(pw);
      setPw("");
      setConfirm("");
      toast.success(isChange ? "Password changed" : "Master password enabled");
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || "Could not set password");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      await removeMasterPassword();
      toast.success("Master password removed");
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || "Could not remove password");
    } finally {
      setBusy(false);
    }
  }

  async function lockNow() {
    await lock();
    onChanged?.();
  }

  async function setAutoLock(value) {
    await saveSettings({ autoLockMinutes: Number(value) });
    toast.success("Auto-lock updated");
    onChanged?.();
  }

  async function setSort(value) {
    await saveSettings({ sortMode: value });
    onChanged?.();
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LockKeyhole className="size-4" /> Master password
          </CardTitle>
          <CardDescription>
            {encrypted
              ? "Your accounts are encrypted at rest with AES-256-GCM."
              : "Optional. Encrypts all accounts; you'll unlock with this password."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">
              {encrypted ? "New password" : "Password"}
            </Label>
            <Input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Confirm password</Label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            At-rest security depends on password length - use a long, unique
            passphrase (8+ characters, more is better).
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => applyPassword(encrypted)}>
              {encrypted ? "Change password" : "Enable master password"}
            </Button>
            {encrypted && (
              <>
                <Button variant="outline" disabled={busy} onClick={lockNow}>
                  <Lock /> Lock now
                </Button>
                <Button
                  variant="ghost"
                  className="text-destructive"
                  disabled={busy}
                  onClick={disable}
                >
                  <ShieldOff /> Remove
                </Button>
              </>
            )}
          </div>
          <div className="space-y-1.5 border-t pt-3">
            <Label className="text-xs">Auto-lock after inactivity</Label>
            <Select
              value={String(settings.autoLockMinutes)}
              onValueChange={setAutoLock}
              disabled={!encrypted}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTO_LOCK_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!encrypted && (
              <p className="text-xs text-muted-foreground">
                Enable a master password to use auto-lock.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>Theme and how accounts are ordered.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Theme</Label>
            <Select value={theme ?? "system"} onValueChange={setTheme}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sort accounts by</Label>
            <Select value={settings.sortMode} onValueChange={setSort}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
