import { useRef, useState } from "react";
import { toast } from "sonner";
import { Image, Link2, Pencil } from "lucide-react";

import { addAccount } from "@/lib/vault";
import { isValidSecret, parseOtpUri } from "@/lib/totp";
import { emptyFormValue, formFromParsed, formToFields } from "@/lib/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountForm } from "./AccountForm";

export function AddAccountDialog({ open, onOpenChange, onSaved }) {
  const [mode, setMode] = useState("manual");
  const [form, setForm] = useState(emptyFormValue);
  const [saving, setSaving] = useState(false);
  const [pasted, setPasted] = useState("");
  const fileRef = useRef(null);

  function reset() {
    setForm(emptyFormValue());
    setPasted("");
    setMode("manual");
  }

  function applyUri(uri) {
    try {
      const parsed = parseOtpUri(uri);
      setForm(formFromParsed(parsed));
      setMode("manual");
      toast.success("Parsed - review the fields and save");
    } catch {
      toast.error("Could not read an otpauth:// code");
    }
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    try {
      // Lazy-load the QR decoder (zxing ~455KB) only when actually scanning,
      // so it stays out of the options bundle's initial load.
      const { decodeQrFromFile } = await import("@/lib/qr");
      const uri = await decodeQrFromFile(file);
      applyUri(uri);
    } catch {
      toast.error("No QR code found in that image");
    }
  }

  async function save() {
    if (!isValidSecret(form.secret)) {
      toast.error("Enter a valid base32 secret");
      return;
    }
    setSaving(true);
    try {
      await addAccount(formToFields(form));
      toast.success("Account added");
      onOpenChange(false);
      reset();
      onSaved?.();
    } catch (err) {
      toast.error(err?.message || "Could not save account");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add account</DialogTitle>
          <DialogDescription>
            Enter details manually, scan a QR image, or paste an otpauth://
            link.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={setMode}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manual">
              <Pencil className="mr-1 size-3.5" /> Manual
            </TabsTrigger>
            <TabsTrigger value="image">
              <Image className="mr-1 size-3.5" /> QR image
            </TabsTrigger>
            <TabsTrigger value="link">
              <Link2 className="mr-1 size-3.5" /> Link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="pt-1">
            <AccountForm value={form} onChange={setForm} />
          </TabsContent>

          <TabsContent value="image" className="pt-1">
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center">
              <Image className="size-8 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                Upload a screenshot or image containing the 2FA QR code.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFile}
              />
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
              >
                Choose image
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="link" className="space-y-2 pt-1">
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="otpauth://totp/Issuer:you@example.com?secret=..."
              rows={3}
              className="w-full resize-none rounded-md border bg-transparent px-3 py-2 font-mono text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!pasted.trim()}
              onClick={() => applyUri(pasted)}
            >
              Parse link
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
