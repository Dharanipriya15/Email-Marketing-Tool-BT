// READ-ONLY: lists users in the boiltech org with their role. Changes nothing.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { organizationId: "boiltech-org" },
    select: { email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`users in boiltech-org: ${users.length}`);
  for (const u of users) console.log(`${u.email}\t${u.role}\tcreated ${u.createdAt.toISOString()}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
