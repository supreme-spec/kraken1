import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const ids = [9, 10, 11];
  await prisma.personPhoto.deleteMany({ where: { person_id: { in: ids } } });
  const deleted = await prisma.person.deleteMany({ where: { id: { in: ids } } });
  console.log("Deleted persons:", deleted.count);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
