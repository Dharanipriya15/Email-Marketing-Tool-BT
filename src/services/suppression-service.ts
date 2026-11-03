import type { Prisma, SuppressionReason } from "@prisma/client";
import { prisma } from "@/db/client";
import { chunked } from "@/lib/chunk";

export const SUPPRESSIONS_PAGE_SIZE = 50;

export type SuppressionRow = {
  id: string;
  email: string;
  reason: SuppressionReason;
  source: string | null;
  createdAt: Date;
};

export async function listSuppressions(params: {
  organizationId: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: SuppressionRow[]; total: number; page: number; pageSize: number }> {
  const pageSize = params.pageSize ?? SUPPRESSIONS_PAGE_SIZE;
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const search = params.search?.trim().toLowerCase();
  const where: Prisma.SuppressionWhereInput = {
    organizationId: params.organizationId,
    ...(search ? { email: { contains: search, mode: "insensitive" } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.suppression.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, email: true, reason: true, source: true, createdAt: true },
    }),
    prisma.suppression.count({ where }),
  ]);
  return { rows, total, page, pageSize };
}

// Returns false when the address was already suppressed (any reason).
export async function addManualSuppression(organizationId: string, email: string, source = "manual"): Promise<boolean> {
  const result = await prisma.suppression.createMany({
    data: [{ organizationId, email: email.toLowerCase(), reason: "MANUAL", source }],
    skipDuplicates: true,
  });
  return result.count > 0;
}

// Chunked + idempotent via @@unique([organizationId, email]).
export async function importSuppressions(organizationId: string, emails: string[]): Promise<{ added: number; alreadySuppressed: number }> {
  let added = 0;
  for (const chunk of chunked(emails, 1000)) {
    const result = await prisma.suppression.createMany({
      data: chunk.map((email) => ({ organizationId, email: email.toLowerCase(), reason: "MANUAL" as const, source: "csv-import" })),
      skipDuplicates: true,
    });
    added += result.count;
  }
  return { added, alreadySuppressed: emails.length - added };
}

// Org-scoped delete. Note: an address that also has an Unsubscribe record
// stays blocked; this only removes the suppression entry.
export async function removeSuppression(organizationId: string, id: string): Promise<boolean> {
  const result = await prisma.suppression.deleteMany({ where: { id, organizationId } });
  return result.count > 0;
}
