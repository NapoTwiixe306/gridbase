import { join } from 'node:path';
import { Prisma } from '@prisma/client';
import { SeedContext } from '../context';
import { chunk, DATA_DIR, loadAndValidate, resolve } from '../helpers';
import { titleDataSchema } from '../validation';

const BATCH = 1000;

/**
 * Driver championship titles (palmarès). References drivers by slug, so it runs
 * after the driver seeder. Titles are rebuilt from files each run (cleared in
 * the orchestrator), so a plain bulk insert is enough.
 */
export async function seedTitles(ctx: SeedContext): Promise<number> {
  const records = loadAndValidate(join(DATA_DIR, 'titles'), titleDataSchema);

  const rows: Prisma.DriverTitleCreateManyInput[] = records.map((r) => ({
    driverId: resolve(ctx.drivers, r.driver, 'driver'),
    year: r.year,
    series: r.series,
    category: r.category ?? null,
    sourceUrl: r.sourceUrl ?? null,
  }));

  for (const batch of chunk(rows, BATCH)) {
    await ctx.prisma.driverTitle.createMany({ data: batch });
  }

  return rows.length;
}
