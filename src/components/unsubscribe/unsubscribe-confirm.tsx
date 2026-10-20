"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { confirmUnsubscribeAction } from "@/app/unsubscribe/actions";

type UnsubscribeConfirmProps = {
  token: string;
  maskedEmail: string;
  alreadyUnsubscribed: boolean;
};

export function UnsubscribeConfirm({ token, maskedEmail, alreadyUnsubscribed }: UnsubscribeConfirmProps) {
  const [done, setDone] = useState(alreadyUnsubscribed);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleConfirm() {
    setIsPending(true);
    setError(null);
    try {
      const result = await confirmUnsubscribeAction(token);
      if (result.success) {
        setDone(true);
      } else {
        setError(result.error);
      }
    } finally {
      setIsPending(false);
    }
  }

  if (done) {
    return (
      <>
        <h1 className="text-xl font-semibold">You&apos;re unsubscribed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {maskedEmail} will no longer receive marketing emails from us.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-xl font-semibold">Unsubscribe</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Stop receiving marketing emails at {maskedEmail}?
      </p>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      <Button className="mt-6 w-full" onClick={handleConfirm} disabled={isPending}>
        {isPending ? "Please wait..." : "Confirm unsubscribe"}
      </Button>
    </>
  );
}