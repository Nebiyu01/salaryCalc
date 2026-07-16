import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Seed the built-in calculators. Adding a new calculator later is just
  // another upsert here (or a row inserted via an admin tool).
  await prisma.calculatorType.upsert({
    where: { slug: "salary" },
    update: {},
    create: {
      slug: "salary",
      name: "Salary Calculator",
      config: { country: "US", year: 2025 },
    },
  });
  // eslint-disable-next-line no-console
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
