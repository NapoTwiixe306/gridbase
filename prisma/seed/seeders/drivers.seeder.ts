import { join } from 'node:path';
import { Prisma } from '@prisma/client';
import { SeedContext } from '../context';
import { chunk, DATA_DIR, loadAndValidate, slugify, toDate } from '../helpers';
import { driverDataSchema } from '../validation';

const BATCH = 1000;

/**
 * Drivers are the highest-volume entity. Bulk-inserted with `createMany`,
 * de-duplicated on their unique slug. The Entry seeder is responsible for
 * guaranteeing that ACTIVE drivers actually have at least one Entry.
 */
export async function seedDrivers(ctx: SeedContext): Promise<number> {
  const records = loadAndValidate(join(DATA_DIR, 'drivers'), driverDataSchema);

  const rows: Prisma.DriverCreateManyInput[] = records.map((r) => ({
    ...r,
    slug: slugify(r.firstName, r.lastName),
    dateOfBirth: toDate(r.dateOfBirth),
  }));

  for (const batch of chunk(rows, BATCH)) {
    await ctx.prisma.driver.createMany({ data: batch, skipDuplicates: true });
  }

  const slugs = rows.map((r) => r.slug);
  for (const batch of chunk(slugs, BATCH)) {
    const found = await ctx.prisma.driver.findMany({
      where: { slug: { in: batch } },
      select: { id: true, slug: true },
    });
    for (const d of found) ctx.drivers.set(d.slug, d.id);
  }

  // Distinct slugs = real number of people (one fiche per driver even if they
  // appear across several files/series).
  return new Set(slugs).size;
}
