"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import {
  campaignFormSchema,
  scheduleCampaignSchema,
  type CampaignFormInput,
  type ScheduleCampaignInput,
} from "@/schemas/campaign";
import * as campaignService from "@/services/campaign-service";
import * as sendService from "@/services/campaign-send-service";
import { EMAIL_NOT_CONFIGURED_MESSAGE } from "@/services/email/provider";
import type { ActionResult } from "@/types/action";

const GENERIC_ERROR = "Something went wrong. Please try again.";
const NOT_FOUND_ERROR = "This campaign no longer exists. It may have been deleted.";

function validationError(error: ZodError): string {
  return error.issues[0]?.message ?? GENERIC_ERROR;
}

// Maps known service errors to user-facing messages; unknown errors are logged.
function serviceError(error: unknown, context: string): string {
  if (error instanceof campaignService.CampaignNotFoundError) return NOT_FOUND_ERROR;
  if (error instanceof campaignService.CampaignNotEditableError) {
    return error.status === "SCHEDULED"
      ? "This campaign is scheduled. Unschedule it before making changes."
      : "This campaign has already started sending and can no longer be changed.";
  }
  if (error instanceof campaignService.CampaignInvalidReferenceError) {
    return error.field === "contactListId"
      ? "The selected contact list no longer exists."
      : "The selected template no longer exists.";
  }
  if (error instanceof campaignService.CampaignNotReadyError) {
    return "Choose an audience and a template before scheduling.";
  }
  console.error(`Failed to ${context}:`, error);
  return GENERIC_ERROR;
}

function revalidateCampaign(id?: string) {
  revalidatePath("/campaigns");
  if (id) revalidatePath(`/campaigns/${id}`);
}

export async function createCampaignAction(
  input: CampaignFormInput
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = campaignFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: validationError(parsed.error) };
  }

  try {
    const campaign = await campaignService.createCampaign(user.organizationId, user.id, parsed.data);
    revalidateCampaign();
    return { success: true, data: { id: campaign.id } };
  } catch (error) {
    return { success: false, error: serviceError(error, "create campaign") };
  }
}

export async function updateCampaignAction(id: string, input: CampaignFormInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = campaignFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: validationError(parsed.error) };
  }

  try {
    await campaignService.updateCampaign(user.organizationId, id, parsed.data);
    revalidateCampaign(id);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: serviceError(error, "update campaign") };
  }
}

export async function duplicateCampaignAction(id: string): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();

  try {
    const copy = await campaignService.duplicateCampaign(user.organizationId, user.id, id);
    revalidateCampaign();
    return { success: true, data: { id: copy.id } };
  } catch (error) {
    return { success: false, error: serviceError(error, "duplicate campaign") };
  }
}

export async function deleteCampaignAction(id: string): Promise<ActionResult> {
  const user = await requireUser();

  try {
    await campaignService.deleteCampaign(user.organizationId, id);
    revalidateCampaign();
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof campaignService.CampaignNotEditableError) {
      return { success: false, error: "Campaigns that have started sending can't be deleted." };
    }
    return { success: false, error: serviceError(error, "delete campaign") };
  }
}

// Only marks the campaign as scheduled; no email is sent by this action.
export async function scheduleCampaignAction(id: string, input: ScheduleCampaignInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = scheduleCampaignSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: validationError(parsed.error) };
  }

  try {
    await campaignService.scheduleCampaign(user.organizationId, id, parsed.data.scheduledAt);
    revalidateCampaign(id);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: serviceError(error, "schedule campaign") };
  }
}

export async function unscheduleCampaignAction(id: string): Promise<ActionResult> {
  const user = await requireUser();

  try {
    await campaignService.unscheduleCampaign(user.organizationId, id);
    revalidateCampaign(id);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: serviceError(error, "unschedule campaign") };
  }
}

export async function getAudienceInfoAction(
  contactListId: string
): Promise<ActionResult<campaignService.AudienceInfo>> {
  const user = await requireUser();
  if (typeof contactListId !== "string" || contactListId.length === 0 || contactListId.length > 64) {
    return { success: false, error: "Choose a contact list." };
  }

  try {
    const info = await campaignService.getAudienceInfo(user.organizationId, contactListId);
    return { success: true, data: info };
  } catch (error) {
    console.error("Failed to load audience info:", error);
    return { success: false, error: GENERIC_ERROR };
  }
}
// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

const SEND_CONFIRMATION_WORD = "SEND";

function sendError(error: unknown, context: string): string {
  if (error instanceof sendService.SendingDisabledError) {
    return "Sending is turned off. Set EMAIL_SENDING_ENABLED=true to enable it.";
  }
  if (error instanceof sendService.ProviderNotConfiguredError) return EMAIL_NOT_CONFIGURED_MESSAGE;
  if (error instanceof sendService.RecipientCapExceededError) {
    return `This campaign has ${error.count.toLocaleString()} recipients, above the safety limit of ${error.cap.toLocaleString()} (EMAIL_MAX_CAMPAIGN_RECIPIENTS).`;
  }
  if (error instanceof sendService.CampaignNotSendableError) {
    switch (error.reason) {
      case "not_found":
        return NOT_FOUND_ERROR;
      case "missing_content":
        return "Choose an audience and a template before sending.";
      case "no_recipients":
        return "There are no eligible recipients in this list.";
      default:
        return "This campaign can't be sent in its current state.";
    }
  }
  return serviceError(error, context);
}

export type SendProgressResult = { sent: number; failed: number; skipped: number; remaining: number; completed: boolean };

function toProgress(result: sendService.BatchResult): SendProgressResult {
  return {
    sent: result.sent,
    failed: result.failed,
    skipped: result.skipped,
    remaining: result.remaining,
    completed: result.completed,
  };
}

// Prepares the recipient snapshot and sends the first batch. Requires the
// user to have typed SEND in the confirmation dialog.
export async function sendCampaignNowAction(
  id: string,
  confirmation: string
): Promise<ActionResult<SendProgressResult>> {
  const user = await requireUser();
  if (confirmation !== SEND_CONFIRMATION_WORD) {
    return { success: false, error: `Type ${SEND_CONFIRMATION_WORD} to confirm.` };
  }

  try {
    await sendService.prepareCampaign(user.organizationId, id);
  } catch (error) {
    return { success: false, error: sendError(error, "prepare campaign") };
  }

  try {
    const result = await sendService.processCampaignBatch(id, { organizationId: user.organizationId });
    revalidateCampaign(id);
    return { success: true, data: toProgress(result) };
  } catch (error) {
    revalidateCampaign(id);
    return { success: false, error: sendError(error, "send campaign batch") };
  }
}

export async function processNextBatchAction(id: string): Promise<ActionResult<SendProgressResult>> {
  const user = await requireUser();
  try {
    const result = await sendService.processCampaignBatch(id, { organizationId: user.organizationId });
    revalidateCampaign(id);
    return { success: true, data: toProgress(result) };
  } catch (error) {
    return { success: false, error: sendError(error, "send campaign batch") };
  }
}

export async function pauseCampaignAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const paused = await sendService.pauseCampaign(user.organizationId, id);
    revalidateCampaign(id);
    return paused ? { success: true, data: undefined } : { success: false, error: "Only sending campaigns can be paused." };
  } catch (error) {
    return { success: false, error: sendError(error, "pause campaign") };
  }
}

export async function resumeCampaignAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const resumed = await sendService.resumeCampaign(user.organizationId, id);
    revalidateCampaign(id);
    return resumed ? { success: true, data: undefined } : { success: false, error: "Only paused campaigns can be resumed." };
  } catch (error) {
    return { success: false, error: sendError(error, "resume campaign") };
  }
}