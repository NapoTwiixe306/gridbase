/**
 * Strict, database-free validator for all seed data files.
 *
 * Runs in CI (and locally via `npm run validate:data`) to catch bad data before
 * it ever reaches the database:
 *   - every record matches its Zod schema (shape, ISO codes, hex colours…);
 *   - every entry/transfer reference resolves to an existing series, season,
 *     category, manufacturer, team or driver;
 *   - no duplicate car number within the same series + season;
 *   - every ACTIVE driver has at least one entry.
 *
 * Exits non-zero (and prints every problem) if anything is wrong.
 */
import { join } from 'node:path';
import { DATA_DIR, loadAndValidate, slugify } from '../prisma/seed/helpers';
import {
  categoryDataSchema,
  circuitDataSchema,
  driverDataSchema,
  entryDataSchema,
  manufacturerDataSchema,
  seasonDataSchema,
  seriesDataSchema,
  teamDataSchema,
  titleDataSchema,
  transferDataSchema,
} from '../prisma/seed/validation';

function fail(message: string): never {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

// --- Phase 1: shape validation (precise location on first offender) ----------
let series,
  seasons,
  categories,
  manufacturers,
  circuits,
  teams,
  drivers,
  entries,
  transfers,
  titles;
try {
  series = loadAndValidate(join(DATA_DIR, 'series.json'), seriesDataSchema);
  seasons = loadAndValidate(join(DATA_DIR, 'seasons.json'), seasonDataSchema);
  categories = loadAndValidate(join(DATA_DIR, 'categories.json'), categoryDataSchema);
  manufacturers = loadAndValidate(join(DATA_DIR, 'manufacturers.json'), manufacturerDataSchema);
  circuits = loadAndValidate(join(DATA_DIR, 'circuits.json'), circuitDataSchema);
  teams = loadAndValidate(join(DATA_DIR, 'teams'), teamDataSchema);
  drivers = loadAndValidate(join(DATA_DIR, 'drivers'), driverDataSchema);
  entries = loadAndValidate(join(DATA_DIR, 'entries'), entryDataSchema);
  transfers = loadAndValidate(join(DATA_DIR, 'transfers'), transferDataSchema);
  titles = loadAndValidate(join(DATA_DIR, 'titles'), titleDataSchema);
} catch (error) {
  fail((error as Error).message);
}

// --- Phase 2: cross-reference + integrity (collect every problem) ------------
const errors: string[] = [];
const err = (m: string): void => void errors.push(m);

const seriesSlugs = new Set(series.map((s) => s.slug));
const seasonKeys = new Set(seasons.map((s) => `${s.series}:${s.year}`));
const categoryKeys = new Set(categories.map((c) => `${c.series}:${c.abbreviation}`));
const manufacturerNames = new Set(manufacturers.map((m) => m.name));
const teamSlugs = new Set(teams.map((t) => slugify(t.fullName)));
const driverSlugs = new Set(drivers.map((d) => slugify(d.firstName, d.lastName)));

// circuits: unique name/slug
const circuitSlugs = new Set<string>();
for (const c of circuits) {
  const slug = slugify(c.name);
  if (circuitSlugs.has(slug)) err(`duplicate circuit "${c.name}" (slug ${slug})`);
  circuitSlugs.add(slug);
}

// referenced data must exist in the reference files
for (const s of seasons) {
  if (!seriesSlugs.has(s.series))
    err(`season ${s.series}:${s.year} → unknown series "${s.series}"`);
}
for (const c of categories) {
  if (!seriesSlugs.has(c.series))
    err(`category ${c.series}:${c.abbreviation} → unknown series "${c.series}"`);
}

const carNumberOwner = new Map<string, string>();
const driversWithEntry = new Set<string>();
entries.forEach((e, i) => {
  const at = `entry #${i} (${e.series} #${e.carNumber})`;
  if (!seriesSlugs.has(e.series)) err(`${at}: unknown series "${e.series}"`);
  if (!seasonKeys.has(`${e.series}:${e.season}`))
    err(`${at}: unknown season ${e.series}:${e.season}`);
  if (!teamSlugs.has(e.team)) err(`${at}: unknown team "${e.team}"`);
  if (e.category && !categoryKeys.has(`${e.series}:${e.category}`))
    err(`${at}: unknown category ${e.series}:${e.category}`);
  if (e.manufacturer && !manufacturerNames.has(e.manufacturer))
    err(`${at}: unknown manufacturer "${e.manufacturer}"`);

  const key = `${e.series}:${e.season}:${e.carNumber}`;
  if (carNumberOwner.has(key))
    err(
      `duplicate car #${e.carNumber} in ${e.series} ${e.season} (${carNumberOwner.get(key)} & ${e.team})`,
    );
  else carNumberOwner.set(key, e.team);

  for (const d of e.drivers) {
    if (!driverSlugs.has(d.driver)) err(`${at}: unknown driver "${d.driver}"`);
    driversWithEntry.add(d.driver);
  }
});

for (const d of drivers) {
  const slug = slugify(d.firstName, d.lastName);
  if (d.status === 'ACTIVE' && !driversWithEntry.has(slug))
    err(`ACTIVE driver "${d.firstName} ${d.lastName}" (${slug}) has no entry`);
}

titles.forEach((t, i) => {
  if (!driverSlugs.has(t.driver))
    err(`title #${i} (${t.year} ${t.series}): unknown driver "${t.driver}"`);
});

transfers.forEach((t, i) => {
  if (!driverSlugs.has(t.driver)) err(`transfer #${i}: unknown driver "${t.driver}"`);
  if (t.fromTeam && !teamSlugs.has(t.fromTeam))
    err(`transfer #${i}: unknown fromTeam "${t.fromTeam}"`);
  if (t.toTeam && !teamSlugs.has(t.toTeam)) err(`transfer #${i}: unknown toTeam "${t.toTeam}"`);
  if (t.fromSeries && !seriesSlugs.has(t.fromSeries))
    err(`transfer #${i}: unknown fromSeries "${t.fromSeries}"`);
  if (t.toSeries && !seriesSlugs.has(t.toSeries))
    err(`transfer #${i}: unknown toSeries "${t.toSeries}"`);
});

if (errors.length > 0) {
  console.error(`\n❌ ${errors.length} data problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log('✅ Data valid:');
console.log(
  `   ${series.length} series · ${seasons.length} seasons · ${categories.length} categories · ${manufacturerNames.size} manufacturers · ${circuitSlugs.size} circuits`,
);
console.log(
  `   ${teamSlugs.size} teams · ${driverSlugs.size} drivers · ${entries.length} entries · ${transfers.length} transfers · ${titles.length} titles`,
);
