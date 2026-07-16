import { useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

import { unlock } from "@/lib/vault";
import { WrongPasswordError } from "@/lib/importers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function UnlockScreen({ onUnlocked }) {
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
    <div className="mx-auto flex max-w-sm justify-center pt-16">
      <Card className="w-full">
        <CardHeader className="items-center text-center">
          <KeyRound className="size-8 text-primary" />
          <CardTitle>Vault locked</CardTitle>
          <CardDescription>
            Enter your master password to unlock your accounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <Input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Master password"
            />
            <Button
              type="submit"
              className="w-full"
              disabled={busy || !password}
            >
              Unlock
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
