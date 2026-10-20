// Safe batch sending engine for campaigns. Server-side only.
//
// Safety layers, in order:
// 1. EMAIL_SENDING_ENABLED must be exactly "true" (global kill switch).
// 2. EMAIL_MAX_CAMPAIGN_RECIPIENTS caps audience size (default 100).
// 3. EMAIL_TEST_ALLOWLIST, when set, limits real sends to listed emails/domains.
// 4. Suppression/unsubscribe is re-checked right before every send.
// 5. Each recipient is claimed with a guarded PENDING -> SENDING update, so a
//    recipient can never be sent twice even if batches run concurrently.
// 6. DB writes around a send are retried on transient connection errors, and
//    recipients stuck in SENDING are flagged for manual review, never re-sent.
import { prisma } from "@/db/client";
import type { CampaignStatus } from "@prisma/client";
import {
  getBatchSize,
  getStuckSendingMinutes,
  getMaxCampaignRecipients,
  getSendRatePerSecond,
  getTestAllowlist,
  isAllowedByAllowlist,
  isSendingEnabled,
} from "@/lib/email-sending-config";
import { withDbRetry } from "@/lib/db-retry";
import { buildEmailFooterText, renderPersonalizedEmail } from "@/lib/email-render";
import { htmlToPlainText } from "@/lib/email-text";
import { applyPersonalization } from "@/lib/personalization";
import {
  buildOneClickUnsubscribeUrl,
  buildUnsubscribePageUrl,
  createUnsubscribeToken,
} from "@/lib/unsubscribe-token";
import { eligibleContactsWhere, getBlockedEmails } from "@/services/campaign-service";
import { getEmailProvider, type EmailProvider } from "@/services/email/provider";

export const MAX_SEND_ATTEMPTS = 3;
const PREPARABLE_STATUSES: CampaignStatus[] = ["DRAFT", "SCHEDULED"];

export class SendingDisabledError extends Error {
  constructor() {
    super("Campaign sending is disabled (EMAIL_SENDING_ENABLED is not \"true\").");
  }
}

export class ProviderNotConfiguredError extends Error {
  constructor() {
    super("No email provider is configured.");
  }
}

export class CampaignNotSendableError extends Error {
  constructor(public readonly reason: "not_found" | "wrong_status" | "missing_content" | "no_recipients") {
    super(`Campaign can't be sent (${reason}).`);
  }
}

export class RecipientCapExceededError extends Error {
  constructor(
    public readonly count: number,
    public readonly cap: number
  ) {
    super(`Campaign has ${count} recipients, above EMAIL_MAX_CAMPAIGN_RECIPIENTS (${cap}).`);
  }
}

function assertSendingAllowed(provider?: EmailProvider | null): EmailProvider {
  if (!isSendingEnabled()) throw new SendingDisabledError();
  const resolved = provider ?? getEmailProvider();
  if (!resolved) throw new ProviderNotConfiguredError();
  return resolved;
}

// ---------------------------------------------------------------------------
// Prepare
// ---------------------------------------------------------------------------

// Snapshots the eligible audience into CampaignRecipient rows and moves the
// campaign to SENDING. Sends nothing by itself.
export async function prepareCampaign(
  organizationId: string,
  campaignId: string,
  options: { provider?: EmailProvider | null } = {}
): Promise<{ totalRecipients: number }> {
  assertSendingAllowed(options.provider);

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, organizationId },
    select: { id: true, status: true, contactListId: true, templateId: true },
  });
  if (!campaign) throw new CampaignNotSendableError("not_found");
  if (!PREPARABLE_STATUSES.includes(campaign.status)) throw new CampaignNotSendableError("wrong_status");
  if (!campaign.contactListId || !campaign.templateId) throw new CampaignNotSendableError("missing_content");

  const blockedEmails = await getBlockedEmails(organizationId);
  const contacts = await prisma.contact.findMany({
    where: eligibleContactsWhere(organizationId, campaign.contactListId, blockedEmails),
    select: { id: true, email: true, firstName: true, lastName: true },
    orderBy: { createdAt: "asc" },
  });

  if (contacts.length === 0) throw new CampaignNotSendableError("no_recipients");
  const cap = getMaxCampaignRecipients();
  if (contacts.length > cap) throw new RecipientCapExceededError(contacts.length, cap);

  await prisma.$transaction(async (tx) => {
    // Guarded claim: only one caller can move this campaign into SENDING.
    const claimed = await tx.campaign.updateMany({
      where: { id: campaignId, organizationId, status: { in: PREPARABLE_STATUSES } },
      data: { status: "SENDING", sentAt: new Date(), totalRecipients: contacts.length },
    });
    if (claimed.count === 0) throw new CampaignNotSendableError("wrong_status");

    await tx.campaignRecipient.createMany({
      data: contacts.map((contact) => ({
        organizationId,
        campaignId,
        contactId: contact.id,
        email: contact.email.toLowerCase(),
        firstName: contact.firstName,
        lastName: contact.lastName,
        status: "PENDING" as const,
      })),
      skipDuplicates: true,
    });
  });

  return { totalRecipients: contacts.length };
}

// ---------------------------------------------------------------------------
// Process
// ---------------------------------------------------------------------------

export type BatchOptions = {
  organizationId?: string;
  batchSize?: number;
  maxPerRun?: number;
  provider?: EmailProvider | null;
  // Injectable for tests so throttling doesn't slow them down.
  sleep?: (ms: number) => Promise<void>;
};

export type BatchResult = {
  sent: number;
  failed: number;
  retried: number;
  skipped: number;
  remaining: number;
  completed: boolean;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function processCampaignBatch(campaignId: string, options: BatchOptions = {}): Promise<BatchResult> {
  const provider = assertSendingAllowed(options.provider);
  const batchSize = options.batchSize ?? getBatchSize();
  const maxPerRun = options.maxPerRun ?? batchSize;
  const sleep = options.sleep ?? defaultSleep;
  const minIntervalMs = 1000 / getSendRatePerSecond();
  const allowlist = getTestAllowlist();
  const retry = <T,>(operation: () => Promise<T>) => withDbRetry(operation, { sleep });

  const result: BatchResult = { sent: 0, failed: 0, retried: 0, skipped: 0, remaining: 0, completed: false };

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, ...(options.organizationId ? { organizationId: options.organizationId } : {}) },
    select: {
      id: true,
      organizationId: true,
      status: true,
      subject: true,
      template: { select: { previewText: true, htmlContent: true } },
      organization: {
        select: {
          name: true,
          settings: { select: { companyName: true, companyAddress: true, unsubscribeFooterText: true } },
        },
      },
    },
  });
  if (!campaign) throw new CampaignNotSendableError("not_found");
  // Paused/completed campaigns are left alone.
  if (campaign.status !== "SENDING") {
    result.remaining = await countPending(campaignId);
    return result;
  }
  if (!campaign.template) {
    await prisma.campaign.updateMany({ where: { id: campaignId, status: "SENDING" }, data: { status: "FAILED" } });
    throw new CampaignNotSendableError("missing_content");
  }

  const { organizationId } = campaign;
  const settings = campaign.organization.settings;
  const companyName = settings?.companyName || campaign.organization.name;
  const attempted = new Set<string>();
  let lastSendAt = 0;

  while (result.sent + result.failed + result.retried + result.skipped < maxPerRun) {
    const take = Math.min(batchSize, maxPerRun - (result.sent + result.failed + result.retried + result.skipped));
    const recipients = await prisma.campaignRecipient.findMany({
      where: { campaignId, status: "PENDING", ...(attempted.size > 0 ? { id: { notIn: [...attempted] } } : {}) },
      orderBy: { createdAt: "asc" },
      take,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        retryCount: true,
        contactId: true,
        contact: { select: { status: true, company: true, industry: true, location: true } },
      },
    });
    if (recipients.length === 0) break;

    // Fresh suppression list right before sending this batch.
    const blocked = new Set(await getBlockedEmails(organizationId));

    for (const recipient of recipients) {
      attempted.add(recipient.id);

      // Claim; if another worker already took it, skip (prevents double-send).
      const claim = await retry(() =>
        prisma.campaignRecipient.updateMany({
          where: { id: recipient.id, status: "PENDING" },
          data: { status: "SENDING", queuedAt: new Date() },
        })
      );
      if (claim.count === 0) continue;

      const contactInactive = recipient.contact && recipient.contact.status !== "ACTIVE";
      if (blocked.has(recipient.email.toLowerCase()) || contactInactive) {
        await prisma.campaignRecipient.updateMany({
          where: { id: recipient.id, status: "SENDING" },
          data: { status: "SUPPRESSED", lastError: "Skipped: suppressed or unsubscribed" },
        });
        result.skipped++;
        continue;
      }

      if (!isAllowedByAllowlist(recipient.email, allowlist)) {
        console.info("[campaign-send] skipped (not in EMAIL_TEST_ALLOWLIST)", { campaignId, recipientId: recipient.id });
        await prisma.campaignRecipient.updateMany({
          where: { id: recipient.id, status: "SENDING" },
          data: { status: "SUPPRESSED", lastError: "Skipped: not in EMAIL_TEST_ALLOWLIST" },
        });
        result.skipped++;
        continue;
      }

      const data: Record<string, string> = {
        first_name: recipient.firstName ?? "",
        last_name: recipient.lastName ?? "",
        company: recipient.contact?.company ?? "",
        industry: recipient.contact?.industry ?? "",
        location: recipient.contact?.location ?? "",
      };
      const token = createUnsubscribeToken({
        organizationId,
        email: recipient.email,
        contactId: recipient.contactId,
        campaignId,
      });
      const footer = {
        unsubscribeUrl: buildUnsubscribePageUrl(token),
        companyName,
        companyAddress: settings?.companyAddress,
        footerText: settings?.unsubscribeFooterText,
      };
      const rendered = renderPersonalizedEmail(
        { subject: campaign.subject, previewText: campaign.template.previewText, htmlContent: campaign.template.htmlContent },
        data,
        footer
      );
      const text =
        applyPersonalization(htmlToPlainText(campaign.template.htmlContent), data) + buildEmailFooterText(footer);

      // Throttle to EMAIL_SEND_RATE_PER_SEC.
      const wait = lastSendAt + minIntervalMs - Date.now();
      if (lastSendAt > 0 && wait > 0) await sleep(wait);
      lastSendAt = Date.now();

      let outcome: { success: true; messageId: string } | { success: false; error: string };
      try {
        outcome = await provider.sendEmail({
          to: recipient.email,
          toName: [recipient.firstName, recipient.lastName].filter(Boolean).join(" ") || undefined,
          subject: rendered.subject,
          html: rendered.html,
          text,
          headers: {
            "List-Unsubscribe": `<${buildOneClickUnsubscribeUrl(token)}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
      } catch (error) {
        outcome = { success: false, error: error instanceof Error ? error.message.slice(0, 300) : "Send error" };
      }

      if (outcome.success) {
        const sentAt = new Date();
        // The email is already with the provider: these writes must not be lost.
        const marked = await retry(() =>
          prisma.campaignRecipient.updateMany({
            where: { id: recipient.id, status: "SENDING" },
            data: { status: "SENT", providerMessageId: outcome.messageId || null, sentAt, lastError: null },
          })
        );
        // Only count once even if the status write was retried after committing.
        if (marked.count > 0) {
          await retry(() => prisma.campaign.update({ where: { id: campaignId }, data: { totalSent: { increment: 1 } } }));
          await retry(() =>
            prisma.emailEvent.create({
              data: { organizationId, campaignId, campaignRecipientId: recipient.id, type: "SENT", occurredAt: sentAt },
            })
          );
        }
        result.sent++;
      } else {
        const attempts = recipient.retryCount + 1;
        const finalFailure = attempts >= MAX_SEND_ATTEMPTS;
        await retry(() =>
          prisma.campaignRecipient.updateMany({
            where: { id: recipient.id, status: "SENDING" },
            data: finalFailure
            ? { status: "FAILED", retryCount: attempts, lastError: outcome.error, failedAt: new Date() }
              : { status: "PENDING", retryCount: attempts, lastError: outcome.error },
          })
        );
        if (finalFailure) {
          await retry(() => prisma.campaign.update({ where: { id: campaignId }, data: { totalFailed: { increment: 1 } } }));
          result.failed++;
        } else {
          result.retried++;
        }
      }
    }
  }

  result.remaining = await retry(() => countPending(campaignId));
  if (result.remaining === 0) {
    const done = await prisma.campaign.updateMany({
      where: { id: campaignId, status: "SENDING" },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    result.completed = done.count > 0;
  }
  return result;
}

function countPending(campaignId: string): Promise<number> {
  return prisma.campaignRecipient.count({ where: { campaignId, status: "PENDING" } });
}

// ---------------------------------------------------------------------------
// Pause / resume / progress
// ---------------------------------------------------------------------------

export async function pauseCampaign(organizationId: string, campaignId: string): Promise<boolean> {
  const result = await prisma.campaign.updateMany({
    where: { id: campaignId, organizationId, status: "SENDING" },
    data: { status: "PAUSED" },
  });
  return result.count > 0;
}

export async function resumeCampaign(organizationId: string, campaignId: string): Promise<boolean> {
  const result = await prisma.campaign.updateMany({
    where: { id: campaignId, organizationId, status: "PAUSED" },
    data: { status: "SENDING" },
  });
  return result.count > 0;
}

export type CampaignProgress = {
  pending: number;
  sent: number;
  failed: number;
  skipped: number;
  total: number;
};

export async function getCampaignProgress(organizationId: string, campaignId: string): Promise<CampaignProgress> {
  const groups = await prisma.campaignRecipient.groupBy({
    by: ["status"],
    where: { campaignId, organizationId },
    _count: { _all: true },
  });
  const progress: CampaignProgress = { pending: 0, sent: 0, failed: 0, skipped: 0, total: 0 };
  for (const group of groups) {
    const count = group._count._all;
    progress.total += count;
    if (group.status === "PENDING" || group.status === "QUEUED" || group.status === "SENDING") progress.pending += count;
    else if (group.status === "FAILED" || group.status === "BOUNCED") progress.failed += count;
    else if (group.status === "SUPPRESSED" || group.status === "UNSUBSCRIBED") progress.skipped += count;
    else progress.sent += count;
  }
  return progress;
}

// ---------------------------------------------------------------------------
// Dispatcher (cron)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Stuck recipients
// ---------------------------------------------------------------------------

export const STUCK_REVIEW_PREFIX = "Needs manual review:";

// A recipient left in SENDING (process crashed or the DB dropped after the
// provider call) may or may not have been emailed. It is NEVER re-sent: it is
// moved to FAILED with a review note so a human can decide.
export async function reconcileStuckRecipients(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - getStuckSendingMinutes() * 60_000);
  const result = await prisma.campaignRecipient.updateMany({
    where: { status: "SENDING", OR: [{ queuedAt: { lt: cutoff } }, { queuedAt: null, updatedAt: { lt: cutoff } }] },
    data: {
      status: "FAILED",
      failedAt: now,
      lastError: `${STUCK_REVIEW_PREFIX} stuck in SENDING; the provider may already have delivered it. Not retried to avoid a duplicate send.`,
    },
  });
  if (result.count > 0) console.warn("[campaign-send] flagged stuck recipients for review", { count: result.count });
  return result.count;
}

// ---------------------------------------------------------------------------
// Dispatcher (cron / worker)
// ---------------------------------------------------------------------------

export type DispatchSummary = {
  started: string[];
  failedToStart: { id: string; reason: string }[];
  processed: { id: string; result: BatchResult }[];
  flaggedStuck: number;
  elapsedMs: number;
};

export type DispatchOptions = {
  // Stop starting new work after this many ms (default 45s, safe for a 60s function).
  timeBudgetMs?: number;
  provider?: EmailProvider | null;
  sleep?: (ms: number) => Promise<void>;
  clock?: () => number;
};

// Starts due scheduled campaigns, then sends batches for SENDING campaigns
// until the time budget runs out. Throttling stays inside processCampaignBatch.
export async function dispatchDueCampaigns(now: Date = new Date(), options: DispatchOptions = {}): Promise<DispatchSummary> {
  assertSendingAllowed(options.provider);
  const clock = options.clock ?? Date.now;
  const startedAt = clock();
  const budgetMs = options.timeBudgetMs ?? 45_000;
  const summary: DispatchSummary = { started: [], failedToStart: [], processed: [], flaggedStuck: 0, elapsedMs: 0 };

  summary.flaggedStuck = await withDbRetry(() => reconcileStuckRecipients(now), { sleep: options.sleep });

  const due = await prisma.campaign.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    select: { id: true, organizationId: true },
    orderBy: { scheduledAt: "asc" },
    take: 5,
  });
  for (const campaign of due) {
    try {
      await prepareCampaign(campaign.organizationId, campaign.id, { provider: options.provider });
      summary.started.push(campaign.id);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown error";
      summary.failedToStart.push({ id: campaign.id, reason });
      // Don't retry a campaign that can never start every minute.
      if (error instanceof RecipientCapExceededError || error instanceof CampaignNotSendableError) {
        await prisma.campaign.updateMany({ where: { id: campaign.id, status: "SCHEDULED" }, data: { status: "FAILED" } });
      }
    }
  }

  const ratePerSec = getSendRatePerSecond();
  const batchSize = getBatchSize();
  const exhausted = new Set<string>();
  while (true) {
    const remainingMs = budgetMs - (clock() - startedAt);
    // Number of sends that fit in the remaining budget at the configured rate.
    const fit = Math.floor((remainingMs / 1000) * ratePerSec);
    if (fit < 1) break;
    const sending = await prisma.campaign.findMany({
      where: { status: "SENDING", ...(exhausted.size > 0 ? { id: { notIn: [...exhausted] } } : {}) },
      select: { id: true },
      orderBy: { sentAt: "asc" },
      take: 3,
    });
    if (sending.length === 0) break;
    for (const campaign of sending) {
      const left = Math.floor(((budgetMs - (clock() - startedAt)) / 1000) * ratePerSec);
      if (left < 1) break;
      const result = await processCampaignBatch(campaign.id, {
        batchSize,
        maxPerRun: Math.min(batchSize, left),
        provider: options.provider,
        sleep: options.sleep,
      });
      summary.processed.push({ id: campaign.id, result });
      if (result.remaining === 0 || result.sent + result.failed + result.retried + result.skipped === 0) exhausted.add(campaign.id);
    }
  }
  summary.elapsedMs = clock() - startedAt;
  return summary;
}
