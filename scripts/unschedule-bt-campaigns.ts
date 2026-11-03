// One-off: unschedule BT_OCT and Demo_BT (SCHEDULED -> DRAFT) via the app's own service.
import { prisma } from "../src/db/client";
import { unscheduleCampaign } from "../src/services/campaign-service";

const NAMES = ["BT_OCT", "Demo_BT"];

async function snapshot() {
  const rows = await prisma.campaign.findMany({
    where: { name: { in: NAMES } },
    select: { id: true, organizationId: true, name: true, status: true, scheduledAt: true, _count: { select: { recipients: true } } },
    orderBy: { name: "asc" },
  });
  return rows;
}

function print(label: string, rows: Awaited<ReturnType<typeof snapshot>>) {
  console.log(`--- ${label} (${rows.length} rows)`);
  for (const r of rows) console.log(JSON.stringify({ id: r.id, name: r.name, status: r.status, scheduledAt: r.scheduledAt, recipients: r._count.recipients }));
}

async function main() {
  const before = await snapshot();
  print("BEFORE", before);
  const scheduled = before.filter((r) => r.status === "SCHEDULED");
  if (before.length > 2) { console.log("STOP: more than 2 matches; nothing updated."); return; }
  if (scheduled.length === 0) { console.log("STOP: no SCHEDULED matches; nothing updated."); return; }
  for (const r of scheduled) {
    await unscheduleCampaign(r.organizationId, r.id);
    console.log(`unscheduled ${r.name} (${r.id})`);
  }
  print("AFTER", await snapshot());
}

main().catch((e) => { console.error("ERROR:", e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
