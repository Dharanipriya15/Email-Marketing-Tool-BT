// HTTP smoke test against a running server (default http://localhost:3000).
// Logs in as the seed admin via the same credential check + session token the
// login action uses. Never prints secrets. Run: npm run smoke
import { verifyCredentials } from "@/services/auth-service";
import { SESSION_COOKIE_NAME, createSessionToken } from "@/lib/session";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set");
  const auth = await verifyCredentials(email, password);
  console.log("seed admin credentials valid:", auth.success);
  if (!auth.success) process.exit(1);
  const token = await createSessionToken({ userId: auth.userId, organizationId: auth.organizationId, role: auth.role });
  const cookie = `${SESSION_COOKIE_NAME}=${token}`;

  const { prisma } = await import("@/db/client");
  const org = auth.organizationId;
  const [campaign, list, template, contact] = await Promise.all([
    prisma.campaign.findFirst({ where: { organizationId: org }, select: { id: true } }),
    prisma.contactList.findFirst({ where: { organizationId: org }, select: { id: true } }),
    prisma.emailTemplate.findFirst({ where: { organizationId: org }, select: { id: true } }),
    prisma.contact.findFirst({ where: { organizationId: org }, select: { id: true } }),
  ]);
  await prisma.$disconnect();

  const pages = ["/dashboard", "/contacts", "/contacts/import", "/lists", "/templates", "/templates/create", "/campaigns", "/campaigns/create", "/reports", "/settings", "/help"];
  if (campaign) pages.push(`/campaigns/${campaign.id}`);
  if (list) pages.push(`/lists/${list.id}`);
  if (template) pages.push(`/templates/${template.id}`);
  if (contact) pages.push(`/contacts/${contact.id}`);

  let failures = 0;
  const check = async (label: string, path: string, init: RequestInit, ok: (s: number, loc: string | null) => boolean) => {
    const res = await fetch(BASE + path, { redirect: "manual", ...init });
    const loc = res.headers.get("location");
    const pass = ok(res.status, loc);
    if (!pass) failures++;
    console.log(`${pass ? "PASS" : "FAIL"} ${label} ${path.replace(/\/c[a-z0-9]{20,}/g, "/:id")} -> ${res.status}${loc ? ` (${loc.replace(/\?.*/, "")})` : ""}`);
  };
  await check("public", "/login", {}, (s) => s === 200);
  await check("anon-redirect", "/dashboard", {}, (s, l) => s === 307 && !!l?.includes("/login"));
  for (const page of pages) await check("auth", page, { headers: { cookie } }, (s) => s === 200);
  await check("public", "/unsubscribe/invalid-token", {}, (s) => s === 200 || s === 404);
  await check("cron-no-auth", "/api/cron/dispatch", {}, (s) => s === 401);
  await check("cron-bad-auth", "/api/cron/dispatch", { headers: { authorization: "Bearer wrong" } }, (s) => s === 401);
  await check("sns-junk", "/api/webhooks/ses", { method: "POST", body: "not json" }, (s) => s === 400);
  await check("sns-forged", "/api/webhooks/ses", {
    method: "POST",
    body: JSON.stringify({ Type: "Notification", MessageId: "x", TopicArn: "arn:aws:sns:ap-south-1:1:t", Message: "{}", Timestamp: "t", SignatureVersion: "1", Signature: "AAAA", SigningCertURL: "https://evil.example.com/c.pem" }),
  }, (s) => s === 403);
  console.log(`smoke: ${pages.length + 7 - failures} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}
main().catch((error) => {
  console.error("smoke failed:", error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});