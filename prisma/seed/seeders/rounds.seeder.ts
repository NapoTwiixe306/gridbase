import { join } from 'node:path';
import { Prisma } from '@prisma/client';
import { SeedContext } from '../context';
import { chunk, DATA_DIR, loadAndValidate, resolve, toDate } from '../helpers';
import { roundDataSchema } from '../validation';

const BATCH = 1000;

/**
 * Calendar rounds — link each season to the circuits it visits. References a
 * season by `${series}:${year}` and a circuit by slug, so it runs after the
 * season and circuit seeders. Rebuilt from files each run (cleared upstream).
 */
export async function seedRounds(ctx: SeedContext): Promise<number> {
  const records = loadAndValidate(join(DATA_DIR, 'calendar'), roundDataSchema);

  const rows: Prisma.RoundCreateManyInput[] = records.map((r) => ({
    seasonId: resolve(ctx.seasons, `${r.series}:${r.season}`, 'season'),
    circuitId: resolve(ctx.circuits, r.circuit, 'circuit'),
    roundNumber: r.round,
    name: r.name ?? null,
    startDate: toDate(r.startDate),
    endDate: toDate(r.endDate),
  }));

  for (const batch of chunk(rows, BATCH)) {
    await ctx.prisma.round.createMany({ data: batch });
  }

  return rows.length;
}
