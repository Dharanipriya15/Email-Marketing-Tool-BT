"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Copy, Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CampaignStatusBadge } from "@/components/shared/status-badge";
import { deleteCampaignAction, duplicateCampaignAction } from "@/app/(app)/campaigns/actions";
import type { CampaignRow } from "@/services/campaign-service";

function isDeletable(campaign: CampaignRow) {
  return (campaign.status === "DRAFT" || campaign.status === "SCHEDULED") && campaign.totalSent === 0;
}

function recipientsLabel(campaign: CampaignRow) {
  if (campaign.estimatedRecipients !== null) {
    return `~${campaign.estimatedRecipients.toLocaleString()}`;
  }
  return `${campaign.totalSent.toLocaleString()} / ${campaign.totalRecipients.toLocaleString()}`;
}

export function CampaignsTable({ campaigns }: { campaigns: CampaignRow[] }) {
  const router = useRouter();
  const [deletingCampaign, setDeletingCampaign] = useState<CampaignRow | null>(null);

  async function handleDuplicate(campaign: CampaignRow) {
    const result = await duplicateCampaignAction(campaign.id);
    if (result.success) {
      toast.success("Campaign duplicated");
      router.push(`/campaigns/${result.data.id}`);
    } else {
      toast.error(result.error);
    }
  }

  async function handleDelete() {
    if (!deletingCampaign) return;
    const result = await deleteCampaignAction(deletingCampaign.id);
    if (result.success) {
      toast.success("Campaign deleted");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campaign</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>List</TableHead>
            <TableHead>Template</TableHead>
            <TableHead className="text-right" title="Estimated eligible recipients, or sent / total once sending starts">
              Recipients
            </TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Scheduled</TableHead>
            <TableHead className="w-10 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => (
            <TableRow key={campaign.id}>
              <TableCell className="max-w-xs">
                <Link href={`/campaigns/${campaign.id}`} className="block truncate font-medium hover:underline">
                  {campaign.name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">{campaign.subject}</p>
              </TableCell>
              <TableCell>
                <CampaignStatusBadge status={campaign.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">{campaign.contactListName ?? "\u2014"}</TableCell>
              <TableCell className="text-muted-foreground">{campaign.templateName ?? "\u2014"}</TableCell>
              <TableCell className="text-right tabular-nums">{recipientsLabel(campaign)}</TableCell>
              <TableCell className="text-muted-foreground">{format(campaign.createdAt, "MMM d, yyyy")}</TableCell>
              <TableCell className="text-muted-foreground">
                {campaign.scheduledAt ? format(campaign.scheduledAt, "MMM d, yyyy h:mm a") : "\u2014"}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Row actions">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => router.push(`/campaigns/${campaign.id}`)}>
                      <Eye />
                      View
                    </DropdownMenuItem>
                    {campaign.status === "DRAFT" && (
                      <DropdownMenuItem onSelect={() => router.push(`/campaigns/${campaign.id}`)}>
                        <Pencil />
                        Edit
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={() => handleDuplicate(campaign)}>
                      <Copy />
                      Duplicate
                    </DropdownMenuItem>
                    {isDeletable(campaign) && (
                      <DropdownMenuItem variant="destructive" onSelect={() => setDeletingCampaign(campaign)}>
                        <Trash2 />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {deletingCampaign && (
        <ConfirmDialog
          open={!!deletingCampaign}
          onOpenChange={(open) => !open && setDeletingCampaign(null)}
          title="Delete this campaign?"
          description={`"${deletingCampaign.name}" will be permanently deleted. Your list and template are not affected.`}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}