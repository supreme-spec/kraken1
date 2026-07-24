import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const cams = await prisma.camera.findMany();
  console.log(JSON.stringify(cams, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
