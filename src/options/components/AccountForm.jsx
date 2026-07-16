import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Controlled account fields editor. `value` is an AccountFormValue. */
export function AccountForm({ value, onChange }) {
  const [advanced, setAdvanced] = useState(
    value.type !== "totp" ||
      value.algorithm !== "SHA1" ||
      value.digits !== 6 ||
      value.period !== 30,
  );
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Issuer">
          <Input
            value={value.issuer}
            onChange={(e) => set({ issuer: e.target.value })}
            placeholder="GitHub"
          />
        </Field>
        <Field label="Account">
          <Input
            value={value.account}
            onChange={(e) => set({ account: e.target.value })}
            placeholder="you@example.com"
          />
        </Field>
      </div>

      <Field label="Secret">
        <Input
          value={value.secret}
          onChange={(e) => set({ secret: e.target.value })}
          placeholder="Base32 secret"
          className="font-mono"
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      <button
        type="button"
        onClick={() => setAdvanced((a) => !a)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronDown
          className={cn(
            "size-3.5 transition-transform",
            advanced && "rotate-180",
          )}
        />
        Advanced
      </button>

      {advanced && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
          <Field label="Type">
            <Select value={value.type} onValueChange={(v) => set({ type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="totp">TOTP (time-based)</SelectItem>
                <SelectItem value="hotp">HOTP (counter-based)</SelectItem>
                <SelectItem value="steam">Steam</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Algorithm">
            <Select
              value={value.algorithm}
              onValueChange={(v) => set({ algorithm: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SHA1">SHA1</SelectItem>
                <SelectItem value="SHA256">SHA256</SelectItem>
                <SelectItem value="SHA512">SHA512</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Digits">
            <Input
              type="number"
              min={4}
              max={10}
              value={value.digits}
              onChange={(e) => set({ digits: Number(e.target.value) })}
            />
          </Field>
          {value.type === "hotp" ? (
            <Field label="Counter">
              <Input
                type="number"
                min={0}
                value={value.counter}
                onChange={(e) => set({ counter: Number(e.target.value) })}
              />
            </Field>
          ) : (
            <Field label="Period (s)">
              <Input
                type="number"
                min={5}
                max={300}
                value={value.period}
                onChange={(e) => set({ period: Number(e.target.value) })}
              />
            </Field>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
