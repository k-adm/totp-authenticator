import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, MoreVertical, RefreshCw, Trash2 } from "lucide-react";

import {
  elapsedFraction,
  formatCode,
  generateCode,
  remainingMs,
} from "@/lib/totp";
import { copyToClipboard, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ServiceIcon } from "@/components/ServiceIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CountdownBar } from "./CountdownBar";

export function AccountRow({ account, now, onDelete, onIncrement }) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);
  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const isHotp = account.type === "hotp";
  const periodMs = (account.period || 30) * 1000;
  // Recompute the code only once per period (or per HOTP counter), not every
  // second; `now` still drives the cheap countdown bar below.
  const bucket = isHotp ? (account.counter ?? 0) : Math.floor(now / periodMs);
  const codeTs = isHotp ? 0 : bucket * periodMs;
  const code = useMemo(() => generateCode(account, codeTs), [account, codeTs]);
  const seconds = Math.max(0, Math.ceil(remainingMs(account, now) / 1000));
  const fraction = 1 - elapsedFraction(account, now);
  const urgent = seconds <= 5;

  const title = account.issuer || account.label || "OTP";
  const subtitle =
    account.account && account.account !== title
      ? account.account
      : account.label && account.label !== title
        ? account.label
        : "";

  async function handleCopy() {
    if (!code) return;
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopied(true);
      toast.success("Code copied");
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1200);
    } else {
      toast.error("Could not copy");
    }
  }

  return (
    <div className="group rounded-lg px-2 py-2 hover:bg-accent/50">
      <div className="flex items-center gap-3">
        <ServiceIcon account={account} size={36} />

        <button
          type="button"
          onClick={handleCopy}
          className="min-w-0 flex-1 text-left"
          title="Click to copy"
        >
          <div className="truncate text-xs font-medium text-muted-foreground">
            {title}
            {subtitle ? (
              <span className="ml-1 opacity-70">· {subtitle}</span>
            ) : null}
          </div>
          <div
            className={cn(
              "font-mono text-xl font-semibold tabular-nums tracking-wider",
              !code && "text-destructive",
            )}
          >
            {code ? formatCode(code) : "invalid"}
          </div>
        </button>

        <div className="flex items-center gap-1">
          {isHotp && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              title="Next code"
              onClick={() => onIncrement?.(account)}
            >
              <RefreshCw />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="size-8 opacity-0 group-hover:opacity-100"
            title="Copy"
            onClick={handleCopy}
          >
            {copied ? <Check className="text-primary" /> : <Copy />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 opacity-0 group-hover:opacity-100"
              >
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopy}>
                <Copy /> Copy code
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete?.(account)}
              >
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {!isHotp && (
        <div className="mt-1.5 pl-12 pr-2">
          <CountdownBar fraction={fraction} urgent={urgent} />
        </div>
      )}
    </div>
  );
}
