"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CampaignStatus } from "@prisma/client";
import { Pause, Play, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  pauseCampaignAction,
  processNextBatchAction,
  resumeCampaignAction,
} from "@/app/(app)/campaigns/actions";
import type { CampaignProgress } from "@/services/campaign-send-service";

type CampaignSendingPanelProps = {
  campaignId: string;
  status: CampaignStatus;
  progress: CampaignProgress;
  sendingReady: boolean;
};

export function CampaignSendingPanel({ campaignId, status, progress, sendingReady }: CampaignSendingPanelProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const done = progress.total - progress.pending;
  const percent = progress.total > 0 ? Math.round((done / progress.total) * 100) : 0;

  // Live progress: the background worker/cron sends batches, so refresh the
  // server-rendered counts every few seconds while the campaign is sending.
  useEffect(() => {
    if (status !== "SENDING") return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [status, router]);

  async function run(action: () => Promise<{ success: boolean; error?: string }>, successMessage: string) {
    setIsPending(true);
    try {
      const result = await action();
      if (result.success) {
        toast.success(successMessage);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="grid gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium">
          {done.toLocaleString()} of {progress.total.toLocaleString()} processed ({percent}%)
        </span>
        <span className="text-muted-foreground">
          {progress.sent.toLocaleString()} sent / {progress.failed.toLocaleString()} failed /{" "}
          {progress.skipped.toLocaleString()} skipped / {progress.pending.toLocaleString()} pending
        </span>
      </div>
      <Progress value={percent} />
      {status === "SENDING" && (
        <p className="text-xs text-muted-foreground">
          Sending continues automatically in the background (cron or worker). This view refreshes every 5 seconds.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {status === "SENDING" && (
          <>
            <Button
              onClick={() => run(() => processNextBatchAction(campaignId), "Batch processed")}
              disabled={isPending || !sendingReady || progress.pending === 0}
            >
              <SendHorizontal />
              {isPending ? "Working..." : "Send next batch now"}
            </Button>
            <Button variant="outline" onClick={() => run(() => pauseCampaignAction(campaignId), "Campaign paused")} disabled={isPending}>
              <Pause />
              Pause
            </Button>
          </>
        )}
        {status === "PAUSED" && (
          <Button onClick={() => run(() => resumeCampaignAction(campaignId), "Campaign resumed")} disabled={isPending}>
            <Play />
            Resume
          </Button>
        )}
      </div>
    </div>
  );
}