import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { DEFAULT_TEMPLATES } from "../src/lib/default-templates";
import { sanitizeEmailHtml } from "../src/lib/email-sanitize";
import { htmlToPlainText } from "../src/lib/email-text";

const prisma = new PrismaClient();

const ORGANIZATION_NAME = "BoilerTech Energy";

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@boiltech.com").toLowerCase();
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
if (!adminPassword || adminPassword.length < 12) {
  throw new Error("Set SEED_ADMIN_PASSWORD (at least 12 characters) before seeding.");
}
  const adminName = process.env.SEED_ADMIN_NAME ?? "BoilerTech Admin";

  const organization = await prisma.organization.upsert({
    where: { id: "boiltech-org" },
    update: {},
    create: { id: "boiltech-org", name: ORGANIZATION_NAME },
  });

  await prisma.settings.upsert({
    where: { organizationId: organization.id },
    update: {},
    create: {
      organizationId: organization.id,
      fromName: ORGANIZATION_NAME,
      companyName: ORGANIZATION_NAME,
    },
  });

  const passwordHash = await hashPassword(adminPassword);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      organizationId: organization.id,
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
    },
  });

  // Default starter templates: only created when no template with the same
  // name exists for the organization, so re-running the seed is safe and
  // never overwrites user edits.
  let createdTemplates = 0;
  for (const template of DEFAULT_TEMPLATES) {
    const existing = await prisma.emailTemplate.findFirst({
      where: { organizationId: organization.id, name: template.name },
      select: { id: true },
    });
    if (existing) continue;
    const htmlContent = sanitizeEmailHtml(template.htmlContent);
    await prisma.emailTemplate.create({
      data: {
        organizationId: organization.id,
        name: template.name,
        subject: template.subject,
        previewText: template.previewText,
        htmlContent,
        textContent: htmlToPlainText(htmlContent),
      },
    });
    createdTemplates++;
  }
  console.log(`Seeded ${createdTemplates} default email template(s).`);

  console.log(`Seeded organization "${organization.name}" and admin user "${adminEmail}".`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
