"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CampaignStatus } from "@prisma/client";
import Link from "next/link";
import { BarChart3, Ban, CalendarX, Copy, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  cancelCampaignAction,
  deleteCampaignAction,
  duplicateCampaignAction,
  unscheduleCampaignAction,
  sendCampaignNowAction,
} from "@/app/(app)/campaigns/actions";
import { SendNowDialog } from "@/components/campaigns/send-now-dialog";
import type { SendingReadiness } from "@/services/email/provider";

const CANCELLABLE: CampaignStatus[] = ["DRAFT", "SCHEDULED", "SENDING", "PAUSED"];

type CampaignDetailActionsProps = {
  campaignId: string;
  campaignName: string;
  status: CampaignStatus;
  deletable: boolean;
  sendReadiness: SendingReadiness;
  recipientCount: number | null;
};

export function CampaignDetailActions({
  campaignId,
  campaignName,
  status,
  deletable,
  sendReadiness,
  recipientCount,
}: CampaignDetailActionsProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleUnschedule() {
    setIsPending(true);
    try {
      const result = await unscheduleCampaignAction(campaignId);
      if (result.success) {
        toast.success("Campaign moved back to draft");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsPending(false);
    }
  }

  async function handleDuplicate() {
    setIsPending(true);
    try {
      const result = await duplicateCampaignAction(campaignId);
      if (result.success) {
        toast.success("Campaign duplicated");
        router.push(`/campaigns/${result.data.id}`);
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete() {
    const result = await deleteCampaignAction(campaignId);
    if (result.success) {
      toast.success("Campaign deleted");
      router.push("/campaigns");
    } else {
      toast.error(result.error);
    }
  }

  async function handleCancel() {
    const result = await cancelCampaignAction(campaignId);
    if (result.success) {
      toast.success(`Campaign cancelled. ${result.data.cancelledRecipients.toLocaleString()} unsent recipient(s) will not be emailed.`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleSendNow(): Promise<boolean> {
    const result = await sendCampaignNowAction(campaignId, "SEND");
    if (!result.success) {
      toast.error(result.error);
      return false;
    }
    toast.success(`Sending started: ${result.data.sent} sent, ${result.data.remaining} remaining.`);
    router.refresh();
    return true;
  }

  return (
    <>
      {status === "SCHEDULED" && (
        <SendNowDialog readiness={sendReadiness} recipientCount={recipientCount} onConfirm={handleSendNow} />
      )}
      {status === "SCHEDULED" && (
        <Button variant="outline" onClick={handleUnschedule} disabled={isPending}>
          <CalendarX />
          Unschedule
        </Button>
      )}
      {status !== "DRAFT" && (
        <Button variant="outline" asChild>
          <Link href={`/campaigns/${campaignId}/report`}>
            <BarChart3 />
            Report
          </Link>
        </Button>
      )}
      <Button variant="outline" onClick={handleDuplicate} disabled={isPending}>
        <Copy />
        Duplicate
      </Button>
      {CANCELLABLE.includes(status) && (
        <ConfirmDialog
          trigger={
            <Button variant="outline" disabled={isPending}>
              <Ban />
              Cancel campaign
            </Button>
          }
          title="Cancel this campaign?"
          description={`"${campaignName}" will be stopped permanently. Emails already sent are not affected, and no further emails will be sent. This can't be undone (you can duplicate it later).`}
          confirmLabel="Cancel campaign"
          cancelLabel="Keep campaign"
          onConfirm={handleCancel}
        />
      )}
      {deletable && (
        <ConfirmDialog
          trigger={
            <Button variant="outline" disabled={isPending}>
              <Trash2 />
              Delete
            </Button>
          }
          title="Delete this campaign?"
          description={`"${campaignName}" will be permanently deleted. Your list and template are not affected.`}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}