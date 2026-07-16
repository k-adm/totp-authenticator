import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

import { removeAccount, updateAccount } from "@/lib/vault";
import { isValidSecret } from "@/lib/totp";
import { formToFields } from "@/lib/form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ServiceIcon } from "@/components/ServiceIcon";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AccountForm } from "./AccountForm";

export function AccountList({ accounts, onChanged }) {
  const [editing, setEditing] = useState(null); // { account, form }

  async function handleDelete(account) {
    await removeAccount(account.id);
    toast.success("Account removed");
    onChanged?.();
  }

  function startEdit(account) {
    setEditing({
      account,
      form: {
        type: account.type,
        issuer: account.issuer || "",
        account: account.account || account.label || "",
        secret: account.secret,
        algorithm: account.algorithm,
        digits: account.digits,
        period: account.period,
        counter: account.counter ?? 0,
      },
    });
  }

  async function saveEdit() {
    if (!editing) return;
    if (!isValidSecret(editing.form.secret)) {
      toast.error("Enter a valid base32 secret");
      return;
    }
    await updateAccount(editing.account.id, formToFields(editing.form));
    toast.success("Account updated");
    setEditing(null);
    onChanged?.();
  }

  if (accounts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No accounts yet. Add one to get started.
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y rounded-lg border">
        {accounts.map((a) => (
          <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
            <ServiceIcon account={a} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {a.issuer || a.label || "OTP"}
              </div>
              {a.account && (
                <div className="truncate text-xs text-muted-foreground">
                  {a.account}
                </div>
              )}
            </div>
            <Badge variant="secondary" className="uppercase">
              {a.type}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => startEdit(a)}
              title="Edit"
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-destructive"
              onClick={() => handleDelete(a)}
              title="Delete"
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit account</DialogTitle>
          </DialogHeader>
          {editing && (
            <AccountForm
              value={editing.form}
              onChange={(form) => setEditing((e) => ({ ...e, form }))}
            />
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
