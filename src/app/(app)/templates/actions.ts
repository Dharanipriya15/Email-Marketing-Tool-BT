"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeEmailHtml } from "@/lib/email-sanitize";
import { buildEmailFooterText, renderPersonalizedEmail } from "@/lib/email-render";
import { prisma } from "@/db/client";
import { getTestAllowlist } from "@/lib/email-sending-config";
import { isAllowedTestRecipient, TEST_RECIPIENT_NOT_ALLOWED_ERROR } from "@/lib/test-email-recipients";
import { buildOneClickUnsubscribeUrl, buildUnsubscribePageUrl, createUnsubscribeToken } from "@/lib/unsubscribe-token";
import { htmlToPlainText } from "@/lib/email-text";
import { applyPersonalization } from "@/lib/personalization";
import {
  templateFormSchema,
  sendTestEmailSchema,
  type SendTestEmailInput,
  type TemplateFormInput,
} from "@/schemas/template";
import * as templateService from "@/services/template-service";
import * as templateImageService from "@/services/template-image-service";
import { getEmailProvider, EMAIL_NOT_CONFIGURED_MESSAGE } from "@/services/email/provider";
import type { ActionResult } from "@/types/action";

const GENERIC_ERROR = "Something went wrong. Please try again.";
const NOT_FOUND_ERROR = "This template no longer exists. It may have been deleted.";
const TEST_EMAIL_RATE_LIMIT = { maxAttempts: 20, windowMs: 15 * 60 * 1000 };

function validationError(error: ZodError): string {
  return error.issues[0]?.message ?? GENERIC_ERROR;
}

function inUseError(campaignCount: number): string {
  const campaigns = campaignCount === 1 ? "1 campaign" : `${campaignCount} campaigns`;
  return `This template is used by ${campaigns} and can't be deleted. Duplicate it if you want to make changes without affecting those campaigns.`;
}

export async function createTemplateAction(
  input: TemplateFormInput
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = templateFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: validationError(parsed.error) };
  }

  try {
    const template = await templateService.createTemplate(user.organizationId, parsed.data);
    revalidatePath("/templates");
    return { success: true, data: { id: template.id } };
  } catch (error) {
    console.error("Failed to create template:", error);
    return { success: false, error: GENERIC_ERROR };
  }
}

export async function updateTemplateAction(
  id: string,
  input: TemplateFormInput
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = templateFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: validationError(parsed.error) };
  }

  try {
    await templateService.updateTemplate(user.organizationId, id, parsed.data);
    revalidatePath("/templates");
    revalidatePath(`/templates/${id}`);
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof templateService.TemplateNotFoundError) {
      return { success: false, error: NOT_FOUND_ERROR };
    }
    console.error("Failed to update template:", error);
    return { success: false, error: GENERIC_ERROR };
  }
}

export async function deleteTemplateAction(id: string): Promise<ActionResult> {
  const { user, error: adminError } = await requireAdmin();
  if (!user) return { success: false, error: adminError };

  try {
    await templateService.deleteTemplate(user.organizationId, id);
    revalidatePath("/templates");
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof templateService.TemplateInUseError) {
      return { success: false, error: inUseError(error.campaignCount) };
    }
    if (error instanceof templateService.TemplateNotFoundError) {
      return { success: false, error: NOT_FOUND_ERROR };
    }
    console.error("Failed to delete template:", error);
    return { success: false, error: GENERIC_ERROR };
  }
}

export async function duplicateTemplateAction(id: string): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();

  try {
    const copy = await templateService.duplicateTemplate(user.organizationId, id);
    revalidatePath("/templates");
    return { success: true, data: { id: copy.id } };
  } catch (error) {
    if (error instanceof templateService.TemplateNotFoundError) {
      return { success: false, error: NOT_FOUND_ERROR };
    }
    console.error("Failed to duplicate template:", error);
    return { success: false, error: GENERIC_ERROR };
  }
}

// Takes the current editor content directly (not a saved template id), so
// "Send Test" works identically whether or not the template has been saved
// yet — the user shouldn't have to save before they can test it.
export async function sendTestEmailAction(input: SendTestEmailInput): Promise<ActionResult> {
  const user = await requireUser();

  const provider = getEmailProvider();
  if (!provider) {
    return { success: false, error: EMAIL_NOT_CONFIGURED_MESSAGE };
  }

  const parsed = sendTestEmailSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: validationError(parsed.error) };
  }

  const { allowed } = checkRateLimit(`send-test:${user.id}`, TEST_EMAIL_RATE_LIMIT);
  if (!allowed) {
    return {
      success: false,
      error: "You've sent a lot of test emails recently. Please wait a few minutes and try again.",
    };
  }

  const { subject, previewText } = parsed.data;
  const testEmail = parsed.data.testEmail.trim().toLowerCase();

  try {
    const orgUsers = await prisma.user.findMany({
      where: { organizationId: user.organizationId },
      select: { email: true },
    });
    if (!isAllowedTestRecipient(testEmail, getTestAllowlist(), orgUsers.map((u) => u.email))) {
      return { success: false, error: TEST_RECIPIENT_NOT_ALLOWED_ERROR };
    }

    const htmlContent = sanitizeEmailHtml(parsed.data.htmlContent);

    // Same compliance footer + List-Unsubscribe headers as a real campaign
    // email, so the test shows exactly what recipients get. The link is real:
    // clicking it unsubscribes the test address in this organization.
    const settings = await prisma.settings.findUnique({
      where: { organizationId: user.organizationId },
      select: { companyName: true, companyAddress: true, unsubscribeFooterText: true },
    });
    const token = createUnsubscribeToken({ organizationId: user.organizationId, email: testEmail });
    const footer = {
      unsubscribeUrl: buildUnsubscribePageUrl(token),
      companyName: settings?.companyName,
      companyAddress: settings?.companyAddress,
      footerText: settings?.unsubscribeFooterText,
    };
    const rendered = renderPersonalizedEmail({ subject, previewText, htmlContent }, undefined, footer);

    const result = await provider.sendEmail({
      to: testEmail,
      subject: `[Test] ${rendered.subject}`,
      html: rendered.html,
      text: applyPersonalization(htmlToPlainText(htmlContent)) + buildEmailFooterText(footer),
      headers: {
        "List-Unsubscribe": `<${buildOneClickUnsubscribeUrl(token)}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    if (!result.success) {
      console.error("Email provider rejected test email:", result.error);
      return { success: false, error: "The email provider couldn't send this test email. Please try again." };
    }
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Failed to send test email:", error);
    return { success: false, error: GENERIC_ERROR };
  }
}

// Image uploads go through /api/templates/images (larger request bodies);
// listing and deleting are plain actions.
export async function listTemplateImagesAction(): Promise<
  ActionResult<templateImageService.TemplateImageSummary[]>
> {
  const user = await requireUser();
  try {
    return { success: true, data: await templateImageService.listTemplateImages(user.organizationId) };
  } catch (error) {
    console.error("Failed to list template images:", error);
    return { success: false, error: "Your images couldn't be loaded. Please try again." };
  }
}

// Admin-only, like deleting a template: emails that were already sent keep
// pointing at the file, so deleting it breaks the image in those emails.
export async function deleteTemplateImageAction(id: string): Promise<ActionResult> {
  const { user, error: adminError } = await requireAdmin();
  if (!user) return { success: false, error: adminError };

  try {
    await templateImageService.deleteTemplateImage(user.organizationId, id);
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof templateImageService.TemplateImageNotFoundError) {
      return { success: false, error: "This image no longer exists. It may have been deleted." };
    }
    console.error("Failed to delete template image:", error);
    return { success: false, error: GENERIC_ERROR };
  }
}
