import { PrismaClient } from '@prisma/client';
import { runSeed } from './seed/index';

const prisma = new PrismaClient();

runSeed(prisma)
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
