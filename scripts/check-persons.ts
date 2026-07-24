import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const persons = await prisma.person.findMany({ select: { id: true, name: true, category: true } });
  console.log("Existing persons:", JSON.stringify(persons, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
