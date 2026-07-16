import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, ScanLine, X } from "lucide-react";

import { clearPendingCapture, readPendingCapture } from "@/lib/screenshot";
import { decodeQrFromCanvas } from "@/lib/qr";
import { parseOtpUri } from "@/lib/totp";
import { formFromParsed, formToFields } from "@/lib/form";
import { addAccount, unlock, VaultLockedError } from "@/lib/vault";
import { WrongPasswordError } from "@/lib/importers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";

export default function App() {
  const [src, setSrc] = useState(null);
  const [missing, setMissing] = useState(false);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(null); // {x,y,w,h} in display px
  const [pendingFields, setPendingFields] = useState(null); // decoded account awaiting unlock
  const [password, setPassword] = useState("");
  const dragRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    readPendingCapture().then((dataUrl) => {
      if (dataUrl) {
        setSrc(dataUrl);
        // The screenshot (a plaintext QR of the secret) is now held in memory
        // via `src`; drop the session copy immediately so it never outlives this
        // page even if the tab is closed with the browser's X.
        clearPendingCapture();
      } else {
        setMissing(true);
      }
    });
    const onHide = () => clearPendingCapture();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  const saveFields = useCallback(async (fields) => {
    try {
      const account = await addAccount(fields);
      await clearPendingCapture();
      setSaved(account);
      toast.success("Account added");
    } catch (err) {
      if (err instanceof VaultLockedError) {
        setPendingFields(fields); // ask to unlock, keep the decoded secret
      } else {
        toast.error("Could not save account");
      }
    }
  }, []);

  const decodeCanvas = useCallback(
    async (canvas) => {
      setBusy(true);
      try {
        const uri = await decodeQrFromCanvas(canvas);
        let parsed;
        try {
          parsed = parseOtpUri(uri);
        } catch {
          toast.error("That QR code is not a 2FA account");
          return;
        }
        await saveFields(formToFields(formFromParsed(parsed)));
      } catch {
        toast.error("No 2FA QR code found in that area");
      } finally {
        setBusy(false);
      }
    },
    [saveFields],
  );

  async function submitUnlock(e) {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    try {
      await unlock(password);
      setPassword("");
      const fields = pendingFields;
      setPendingFields(null);
      await saveFields(fields);
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

  function selectionCanvas(selection) {
    const img = imgRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(selection.w * scaleX));
    canvas.height = Math.max(1, Math.round(selection.h * scaleY));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      img,
      selection.x * scaleX,
      selection.y * scaleY,
      selection.w * scaleX,
      selection.h * scaleY,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return canvas;
  }

  function pointFromEvent(e) {
    const rect = imgRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - rect.left, rect.width)),
      y: Math.max(0, Math.min(e.clientY - rect.top, rect.height)),
    };
  }

  function onPointerDown(e) {
    if (busy || saved) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointFromEvent(e);
    dragRef.current = p;
    setSel({ x: p.x, y: p.y, w: 0, h: 0 });
  }

  function onPointerMove(e) {
    if (!dragRef.current) return;
    const p = pointFromEvent(e);
    const s = dragRef.current;
    setSel({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    });
  }

  function onPointerUp() {
    const selection = sel;
    dragRef.current = null;
    if (!selection || selection.w < 12 || selection.h < 12) {
      setSel(null);
      return;
    }
    const canvas = selectionCanvas(selection);
    if (canvas) decodeCanvas(canvas);
    setSel(null);
  }

  function scanWhole() {
    const img = imgRef.current;
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d").drawImage(img, 0, 0);
    decodeCanvas(canvas);
  }

  async function close() {
    await clearPendingCapture();
    window.close();
  }

  if (missing) {
    return (
      <Centered>
        <p className="text-sm text-muted-foreground">
          Nothing to scan. Open the popup on a page showing a 2FA QR code and
          choose "Scan QR on screen".
        </p>
        <Button variant="outline" onClick={() => window.close()}>
          Close
        </Button>
      </Centered>
    );
  }

  if (saved) {
    return (
      <Centered>
        <CheckCircle2 className="size-12 text-primary" />
        <p className="text-sm">
          Added <strong>{saved.issuer || saved.label}</strong>. The code now
          appears in your authenticator.
        </p>
        <Button onClick={close}>Done</Button>
      </Centered>
    );
  }

  if (pendingFields) {
    return (
      <Centered>
        <KeyRound className="size-10 text-primary" />
        <p className="text-sm text-muted-foreground">
          QR decoded. Unlock your vault to save this account.
        </p>
        <form
          onSubmit={submitUnlock}
          className="flex w-full max-w-64 flex-col gap-2"
        >
          <Input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Master password"
          />
          <Button type="submit" disabled={busy || !password}>
            Unlock & save
          </Button>
        </form>
      </Centered>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <ScanLine className="size-5 text-primary" />
        <h1 className="flex-1 text-sm font-semibold">
          Drag a box around the QR code
        </h1>
        <Button variant="outline" size="sm" onClick={scanWhole} disabled={busy}>
          Scan whole image
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={close}>
          <X />
        </Button>
      </header>

      <div className="flex flex-1 items-start justify-center overflow-auto p-4">
        {src && (
          <div
            className="relative select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <img
              ref={imgRef}
              src={src}
              alt="Screenshot"
              draggable={false}
              className="max-w-full cursor-crosshair rounded-md border shadow-sm"
            />
            {sel && (
              <div
                className="pointer-events-none absolute border-2 border-primary bg-primary/10"
                style={{
                  left: sel.x,
                  top: sel.y,
                  width: sel.w,
                  height: sel.h,
                }}
              />
            )}
            {busy && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-black/40 text-sm text-white">
                Decoding…
              </div>
            )}
          </div>
        )}
      </div>
      <Toaster position="bottom-center" />
    </div>
  );
}

function Centered({ children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center text-foreground">
      {children}
      <Toaster position="bottom-center" />
    </div>
  );
}
