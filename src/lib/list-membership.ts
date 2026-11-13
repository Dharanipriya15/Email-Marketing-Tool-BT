import type { AddToListResult } from "@/services/contact-service";

// e.g. "Added 3, skipped 1 (suppressed/inactive)"
export function formatAddToListResult({ added, skipped, alreadyInList }: AddToListResult): string {
  const parts = [`Added ${added}`];
  if (skipped > 0) parts.push(`skipped ${skipped} (suppressed/inactive)`);
  if (alreadyInList > 0) parts.push(`${alreadyInList} already in list`);
  return parts.join(", ");
}
