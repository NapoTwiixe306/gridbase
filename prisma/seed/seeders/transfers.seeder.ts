import { join } from 'node:path';
import { Prisma } from '@prisma/client';
import { SeedContext } from '../context';
import { chunk, DATA_DIR, loadAndValidate, resolve, toDate } from '../helpers';
import { transferDataSchema } from '../validation';

const BATCH = 1000;

export async function seedTransfers(ctx: SeedContext): Promise<number> {
  const records = loadAndValidate(join(DATA_DIR, 'transfers'), transferDataSchema);

  const rows: Prisma.TransferCreateManyInput[] = records.map((r) => ({
    driverId: resolve(ctx.drivers, r.driver, 'driver'),
    fromTeamId: r.fromTeam ? resolve(ctx.teams, r.fromTeam, 'team') : null,
    toTeamId: r.toTeam ? resolve(ctx.teams, r.toTeam, 'team') : null,
    fromSeriesId: r.fromSeries ? resolve(ctx.series, r.fromSeries, 'series') : null,
    toSeriesId: r.toSeries ? resolve(ctx.series, r.toSeries, 'series') : null,
    season: r.season ?? null,
    announcedAt: toDate(r.announcedAt),
    effectiveAt: toDate(r.effectiveAt),
    status: r.status,
    type: r.type,
    sourceUrl: r.sourceUrl ?? null,
    notes: r.notes ?? null,
  }));

  for (const batch of chunk(rows, BATCH)) {
    await ctx.prisma.transfer.createMany({ data: batch, skipDuplicates: true });
  }

  return rows.length;
}
