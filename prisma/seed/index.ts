import { PrismaClient } from '@prisma/client';
import { createContext, SeedContext } from './context';
import {
  seedCategories,
  seedCircuits,
  seedManufacturers,
  seedSeasons,
  seedSeries,
} from './seeders/reference.seeder';
import { seedTeams } from './seeders/teams.seeder';
import { seedDrivers } from './seeders/drivers.seeder';
import { seedEntries } from './seeders/entries.seeder';
import { seedTransfers } from './seeders/transfers.seeder';
import { seedTitles } from './seeders/titles.seeder';
import { seedRounds } from './seeders/rounds.seeder';

/**
 * Orchestrates the full seed in foreign-key-safe order. Each entity lives in its
 * own JSON data file(s) under prisma/seed/data, so the database can grow to
 * thousands of drivers/teams without touching this code — only data files.
 */
export async function runSeed(prisma: PrismaClient): Promise<void> {
  const ctx = createContext(prisma);

  // Reset transactional data so re-seeding is idempotent (FK-safe order).
  await prisma.transfer.deleteMany();
  await prisma.driverTitle.deleteMany();
  await prisma.round.deleteMany();
  await prisma.entryDriver.deleteMany();
  await prisma.entry.deleteMany();

  const series = await seedSeries(ctx);
  const seasons = await seedSeasons(ctx);
  const categories = await seedCategories(ctx);
  const manufacturers = await seedManufacturers(ctx);
  const circuits = await seedCircuits(ctx);
  const teams = await seedTeams(ctx);
  const drivers = await seedDrivers(ctx);
  const { entries, entryDrivers } = await seedEntries(ctx);
  const transfers = await seedTransfers(ctx);
  const titles = await seedTitles(ctx);
  const rounds = await seedRounds(ctx);

  await assertSeedDriversHaveEntries(ctx);

  console.log('\n✅ Seeded:');
  console.log(`  - ${series} series`);
  console.log(`  - ${seasons} seasons`);
  console.log(`  - ${categories} categories`);
  console.log(`  - ${manufacturers} manufacturers`);
  console.log(`  - ${circuits} circuits`);
  console.log(`  - ${teams} teams`);
  console.log(`  - ${drivers} drivers`);
  console.log(`  - ${entries} entries (${entryDrivers} driver assignments)`);
  console.log(`  - ${transfers} transfers`);
  console.log(`  - ${titles} driver titles`);
  console.log(`  - ${rounds} calendar rounds`);

  await printDriverSummary(prisma);
}

/**
 * Enforce: no ACTIVE driver *defined by the seed files* may exist without at
 * least one Entry. Scoped to the drivers this seed loaded (via the context) so
 * it does not police rows owned by other data sources — e.g. the F1 drivers
 * imported by `npm run ingest:single-seaters`, whose entries are (re)built by
 * that script, not the seed.
 */
async function assertSeedDriversHaveEntries(ctx: SeedContext): Promise<void> {
  const ids = [...ctx.drivers.values()];
  if (ids.length === 0) return;
  const orphans = await ctx.prisma.driver.findMany({
    where: { id: { in: ids }, status: 'ACTIVE', entryDrivers: { none: {} } },
    select: { firstName: true, lastName: true, slug: true },
  });
  if (orphans.length > 0) {
    const list = orphans.map((d) => `${d.firstName} ${d.lastName} (${d.slug})`).join(', ');
    throw new Error(
      `Data integrity error: ${orphans.length} ACTIVE driver(s) without any Entry: ${list}. ` +
        'Add an entry or set status to WITHOUT_SEAT.',
    );
  }
}

const SUMMARY_LIMIT = 12;

/** Print a few current-season entries as a readable confirmation of the seed. */
async function printDriverSummary(prisma: PrismaClient): Promise<void> {
  const year = new Date().getFullYear();
  const primaries = await prisma.entryDriver.findMany({
    where: { isPrimary: true, entry: { season: { year } } },
    include: {
      driver: true,
      entry: { include: { team: true, series: true } },
    },
    orderBy: [{ entry: { series: { shortName: 'asc' } } }, { driver: { lastName: 'asc' } }],
  });

  if (primaries.length === 0) return;
  console.log(`\nSample ${year} entries (${primaries.length} total):`);
  for (const ed of primaries.slice(0, SUMMARY_LIMIT)) {
    const cls = ed.wecClassification ? ` / ${titleCase(ed.wecClassification)}` : '';
    console.log(
      `  - ${ed.driver.firstName} ${ed.driver.lastName} → ${ed.entry.team.fullName} / ` +
        `${ed.entry.series.shortName} / Car #${ed.entry.carNumber}${cls}`,
    );
  }
  if (primaries.length > SUMMARY_LIMIT) {
    console.log(`  …and ${primaries.length - SUMMARY_LIMIT} more`);
  }
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
