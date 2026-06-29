import { join } from 'node:path';
import { Prisma } from '@prisma/client';
import { SeedContext } from '../context';
import { chunk, DATA_DIR, loadAndValidate, resolve, toDate } from '../helpers';
import { entryDataSchema } from '../validation';

const BATCH = 1000;

export interface EntriesResult {
  entries: number;
  entryDrivers: number;
}

/**
 * Entries link teams, seasons, series and drivers. Because EntryDriver rows need
 * the parent entry's id, this runs in three batched phases:
 *   1. createMany entries (idempotent via the unique [seasonId, carNumber])
 *   2. read the entries back to map natural key -> id
 *   3. createMany the EntryDriver join rows
 */
export async function seedEntries(ctx: SeedContext): Promise<EntriesResult> {
  const records = loadAndValidate(join(DATA_DIR, 'entries'), entryDataSchema);

  const seasonIds = new Set<string>();
  const entryRows: Prisma.EntryCreateManyInput[] = records.map((r) => {
    const seasonId = resolve(ctx.seasons, `${r.series}:${r.season}`, 'season');
    seasonIds.add(seasonId);
    return {
      teamId: resolve(ctx.teams, r.team, 'team'),
      seriesId: resolve(ctx.series, r.series, 'series'),
      seasonId,
      categoryId: r.category
        ? resolve(ctx.categories, `${r.series}:${r.category}`, 'category')
        : null,
      manufacturerId: r.manufacturer
        ? resolve(ctx.manufacturers, r.manufacturer, 'manufacturer')
        : null,
      carNumber: r.carNumber,
      chassis: r.chassis ?? null,
      status: r.status,
      announcedAt: toDate(r.announcedAt),
      sourceUrl: r.sourceUrl ?? null,
    };
  });

  // Phase 1 — insert entries.
  for (const batch of chunk(entryRows, BATCH)) {
    await ctx.prisma.entry.createMany({ data: batch, skipDuplicates: true });
  }

  // Phase 2 — map `${seasonId}:${carNumber}` -> entry id.
  const entryIdByKey = new Map<string, string>();
  const found = await ctx.prisma.entry.findMany({
    where: { seasonId: { in: [...seasonIds] } },
    select: { id: true, seasonId: true, carNumber: true },
  });
  for (const e of found) entryIdByKey.set(`${e.seasonId}:${e.carNumber}`, e.id);

  // Phase 3 — build and insert EntryDriver join rows.
  const joinRows: Prisma.EntryDriverCreateManyInput[] = [];
  records.forEach((r, index) => {
    const seasonId = resolve(ctx.seasons, `${r.series}:${r.season}`, 'season');
    const entryId = entryIdByKey.get(`${seasonId}:${r.carNumber}`);
    if (!entryId) {
      throw new Error(`Entry not found after insert (record #${index}, car #${r.carNumber})`);
    }
    for (const d of r.drivers) {
      joinRows.push({
        entryId,
        driverId: resolve(ctx.drivers, d.driver, 'driver'),
        role: d.role,
        isPrimary: d.isPrimary,
        wecClassification: d.wecClassification ?? null,
      });
    }
  });

  for (const batch of chunk(joinRows, BATCH)) {
    await ctx.prisma.entryDriver.createMany({ data: batch, skipDuplicates: true });
  }

  return { entries: entryRows.length, entryDrivers: joinRows.length };
}
