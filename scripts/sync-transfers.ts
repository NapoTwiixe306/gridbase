/**
 * Run the transfer pipeline once, from the command line:
 *
 *   npm run sync:transfers
 *
 * Refreshes the F1 grid from Jolpica, then derives transfers from every series'
 * grid and upserts them (RUMOUR/OFFICIAL from the entry status; rumours upgraded
 * to official when confirmed). Idempotent — safe to run repeatedly. The same
 * pipeline runs on a schedule inside the server when ENABLE_TRANSFER_CRON=true.
 */
import { PrismaClient } from '@prisma/client';
import { runTransferPipeline } from '../src/jobs';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    console.log('🔁 Running transfer pipeline...');
    const summary = await runTransferPipeline({
      prisma,
      logger: {
        info: (o: unknown) => console.log(o),
        warn: (o: unknown) => console.warn(o),
        error: (o: unknown) => console.error(o),
      },
    });
    console.log(
      `✅ Done — ${summary.moves} moves detected, ${summary.created} created, ${summary.upgraded} upgraded.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
