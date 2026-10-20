"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SendingReadiness } from "@/services/email/provider";

const CONFIRM_WORD = "SEND";

type SendNowDialogProps = {
  readiness: SendingReadiness;
  recipientCount: number | null;
  // Return true when sending started (closes the dialog).
  onConfirm: () => Promise<boolean>;
  disabled?: boolean;
};

export function SendNowDialog({ readiness, recipientCount, onConfirm, disabled }: SendNowDialogProps) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [isPending, setIsPending] = useState(false);

  if (!readiness.ready) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Wrapper keeps the tooltip working on a disabled button. */}
          <span tabIndex={0}>
            <Button disabled>
              <Send />
              Send Now
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Sending is disabled. Missing setting(s): {readiness.missing.join(", ")}</TooltipContent>
      </Tooltip>
    );
  }

  async function handleConfirm() {
    setIsPending(true);
    try {
      if (await onConfirm()) {
        setOpen(false);
        setTyped("");
      }
    } finally {
      setIsPending(false);
    }
  }

  const count = recipientCount ?? 0;

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={disabled || count === 0}>
        <Send />
        Send Now
      </Button>
      <Dialog open={open} onOpenChange={(value) => !isPending && setOpen(value)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this campaign now?</DialogTitle>
            <DialogDescription>
              This sends real emails to {count.toLocaleString()} eligible recipient{count === 1 ? "" : "s"}. It
              can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="send-confirm">Type {CONFIRM_WORD} to confirm</Label>
            <Input
              id="send-confirm"
              value={typed}
              autoComplete="off"
              onChange={(event) => setTyped(event.target.value)}
              disabled={isPending}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={typed !== CONFIRM_WORD || isPending}>
              {isPending ? "Sending..." : `Send to ${count.toLocaleString()}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}