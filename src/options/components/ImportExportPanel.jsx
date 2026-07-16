import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";

import { addAccounts } from "@/lib/vault";
import {
  PasswordRequiredError,
  WrongPasswordError,
  detectFormat,
  exportBackup,
  importAny,
} from "@/lib/importers";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function download(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportExportPanel({ accounts, onChanged }) {
  const fileRef = useRef(null);
  const [pending, setPending] = useState(null); // { text, password }
  const [exportFormat, setExportFormat] = useState("totp-json");
  const [exportPassword, setExportPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function runImport(text, password) {
    const { accounts: fields, format } = await importAny(text, password);
    const created = await addAccounts(fields);
    const skipped = fields.length - created.length;
    toast.success(
      `Imported ${created.length} account${created.length === 1 ? "" : "s"} from ${format}` +
        (skipped > 0
          ? ` (${skipped} duplicate${skipped === 1 ? "" : "s"} skipped)`
          : ""),
    );
    onChanged?.();
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    const text = await file.text();
    try {
      const det = detectFormat(text);
      if (det.encrypted) {
        setPending({ text, password: "" });
        return;
      }
      await runImport(text);
    } catch (err) {
      toast.error(err?.message || "Could not import file");
    }
  }

  async function submitPassword() {
    if (!pending) return;
    setBusy(true);
    try {
      await runImport(pending.text, pending.password);
      setPending(null);
    } catch (err) {
      if (err instanceof WrongPasswordError) toast.error("Wrong password");
      else if (err instanceof PasswordRequiredError)
        toast.error("Password required");
      else toast.error(err?.message || "Could not import file");
    } finally {
      setBusy(false);
    }
  }

  async function doExport() {
    if (accounts.length === 0) {
      toast.error("No accounts to export");
      return;
    }
    setBusy(true);
    try {
      const out = await exportBackup(
        exportFormat,
        accounts,
        exportPassword || undefined,
      );
      download(out.content, out.filename, out.mime);
      toast.success(`Exported ${accounts.length} accounts`);
      setExportPassword("");
    } catch (err) {
      toast.error(err?.message || "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="size-4" /> Import
          </CardTitle>
          <CardDescription>
            Load accounts from a .json / .2fas backup or a Google Authenticator
            export link. Password-protected files are detected automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept=".json,.2fas,.txt,application/json,text/plain"
            className="hidden"
            onChange={onFile}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            Choose backup file
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="size-4" /> Export
          </CardTitle>
          <CardDescription>
            Save all accounts to a file. Set a password to encrypt it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Format</Label>
            <Select value={exportFormat} onValueChange={setExportFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="totp-json">
                  TOTP Authenticator (.json)
                </SelectItem>
                <SelectItem value="2fas">2FAS (.2fas)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Password (optional)</Label>
            <Input
              type="password"
              value={exportPassword}
              onChange={(e) => setExportPassword(e.target.value)}
              placeholder="Leave empty for an unencrypted file"
              autoComplete="new-password"
            />
          </div>
          <Button onClick={doExport} disabled={busy}>
            Export {accounts.length} account{accounts.length === 1 ? "" : "s"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={!!pending} onOpenChange={(v) => !v && setPending(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Encrypted backup</DialogTitle>
            <DialogDescription>
              Enter the password to decrypt this file.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            autoFocus
            value={pending?.password ?? ""}
            onChange={(e) =>
              setPending((p) => ({ ...p, password: e.target.value }))
            }
            onKeyDown={(e) => e.key === "Enter" && submitPassword()}
            placeholder="Backup password"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              onClick={submitPassword}
              disabled={busy || !pending?.password}
            >
              Decrypt & import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
