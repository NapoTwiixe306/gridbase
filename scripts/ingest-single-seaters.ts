/**
 * Generate single-seater (F1) seed data FILES from free public APIs.
 *
 * This script does NOT touch the database. It writes JSON into
 * `prisma/seed/data/` exactly like the hand-authored files, so there is a
 * single source of truth (the JSON files, versioned in git). After running it,
 * load everything the normal way with `npm run db:seed`.
 *
 *   npm run ingest:single-seaters   →  refreshes the F1 JSON files
 *   npm run db:seed                 →  loads ALL data (incl. F1) into the DB
 *
 * Files written:
 *   prisma/seed/data/drivers/f1.json        (one fiche per driver, de-duplicated)
 *   prisma/seed/data/teams/f1.json          (F1 teams, de-duplicated)
 *   prisma/seed/data/entries/f1-2024.json   (one entry per driver per season)
 *   prisma/seed/data/entries/f1-2025.json
 *   prisma/seed/data/entries/f1-2026.json
 *
 * DATA SOURCES:
 *   • Jolpica (https://api.jolpi.ca/ergast/f1) — Ergast successor, F1 only.
 *     `/{year}/driverstandings` links each driver to the constructor(s) they
 *     drove for; `/{year}/drivers` gives DOB and nationality.
 *   • OpenF1 (https://api.openf1.org/v1) — accurate per-season car numbers
 *     (Jolpica's permanentNumber is wrong for some drivers, e.g. Verstappen).
 *   • F2 / F3: no free API exposes their entry lists (Jolpica returns 404), so
 *     they are NOT generated here — add them by hand under seed/data/.
 *
 * The output is deterministic (records sorted by key) for clean git diffs.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { slugify } from '../src/schemas/common';

const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1';
const OPENF1_BASE = 'https://api.openf1.org/v1';
const DATA_DIR = join(__dirname, '..', 'prisma', 'seed', 'data');

const CURRENT_YEAR = new Date().getFullYear();
// 2024 + 2025 + the current year, sorted ascending so the latest season wins
// when a driver's "permanent" number is recorded on their fiche.
const F1_SEASONS = [...new Set([2024, 2025, CURRENT_YEAR])].sort();

// --- Hardcoded team metadata (colours/country don't come from the API) --------
interface TeamMeta {
  fullName: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  country: string; // ISO 3166-1 alpha-2
}

// Keyed by Jolpica constructorId (stable across seasons).
const TEAM_META: Record<string, TeamMeta> = {
  red_bull: {
    fullName: 'Red Bull Racing',
    shortName: 'Red Bull',
    primaryColor: '#3671C6',
    secondaryColor: '#FF1801',
    country: 'AT',
  },
  mercedes: {
    fullName: 'Mercedes-AMG Petronas',
    shortName: 'Mercedes',
    primaryColor: '#27F4D2',
    secondaryColor: '#000000',
    country: 'DE',
  },
  ferrari: {
    fullName: 'Scuderia Ferrari',
    shortName: 'Ferrari',
    primaryColor: '#E8002D',
    secondaryColor: '#FFF200',
    country: 'IT',
  },
  mclaren: {
    fullName: 'McLaren',
    shortName: 'McLaren',
    primaryColor: '#FF8000',
    secondaryColor: '#000000',
    country: 'GB',
  },
  aston_martin: {
    fullName: 'Aston Martin',
    shortName: 'Aston Martin',
    primaryColor: '#229971',
    secondaryColor: '#000000',
    country: 'GB',
  },
  alpine: {
    fullName: 'Alpine',
    shortName: 'Alpine',
    primaryColor: '#0093CC',
    secondaryColor: '#FF87BC',
    country: 'FR',
  },
  williams: {
    fullName: 'Williams',
    shortName: 'Williams',
    primaryColor: '#64C4FF',
    secondaryColor: '#00A0DE',
    country: 'GB',
  },
  haas: {
    fullName: 'Haas',
    shortName: 'Haas',
    primaryColor: '#B6BABD',
    secondaryColor: '#ED1C24',
    country: 'US',
  },
  sauber: {
    fullName: 'Kick Sauber',
    shortName: 'Sauber',
    primaryColor: '#52E252',
    secondaryColor: '#000000',
    country: 'CH',
  },
  rb: {
    fullName: 'RB (Visa Cash App RB)',
    shortName: 'RB',
    primaryColor: '#6692FF',
    secondaryColor: '#1634CB',
    country: 'IT',
  },
  audi: {
    fullName: 'Audi',
    shortName: 'Audi',
    primaryColor: '#BB0A30',
    secondaryColor: '#000000',
    country: 'DE',
  },
  cadillac: {
    fullName: 'Cadillac F1 Team',
    shortName: 'Cadillac',
    primaryColor: '#1A1A1A',
    secondaryColor: '#C9A24B',
    country: 'US',
  },
};

const GENERIC_TEAM_COLOR = '#666666';

// --- Nationality (demonym) -> ISO 3166-1 alpha-2 -----------------------------
const NATIONALITY_ISO: Record<string, string> = {
  American: 'US',
  Argentine: 'AR',
  Argentinian: 'AR',
  Australian: 'AU',
  Austrian: 'AT',
  Belgian: 'BE',
  Brazilian: 'BR',
  British: 'GB',
  Bulgarian: 'BG',
  Canadian: 'CA',
  Chinese: 'CN',
  Colombian: 'CO',
  Czech: 'CZ',
  Danish: 'DK',
  Dutch: 'NL',
  Emirati: 'AE',
  Estonian: 'EE',
  Finnish: 'FI',
  French: 'FR',
  German: 'DE',
  Greek: 'GR',
  Hungarian: 'HU',
  Indian: 'IN',
  Indonesian: 'ID',
  Irish: 'IE',
  Israeli: 'IL',
  Italian: 'IT',
  Japanese: 'JP',
  Malaysian: 'MY',
  Mexican: 'MX',
  Monegasque: 'MC',
  'New Zealander': 'NZ',
  Norwegian: 'NO',
  Polish: 'PL',
  Portuguese: 'PT',
  Russian: 'RU',
  Saudi: 'SA',
  Singaporean: 'SG',
  Slovak: 'SK',
  Slovenian: 'SI',
  'South African': 'ZA',
  Spanish: 'ES',
  Swedish: 'SE',
  Swiss: 'CH',
  Thai: 'TH',
  Turkish: 'TR',
  Ukrainian: 'UA',
  Uruguayan: 'UY',
  Venezuelan: 'VE',
};

function nationalityToISO(nationality: string): string {
  const iso = NATIONALITY_ISO[nationality.trim()];
  if (!iso) {
    console.warn(`  ⚠️  Unknown nationality "${nationality}" — defaulting to "XX"`);
    return 'XX';
  }
  return iso;
}

// --- API response typings (only the fields we use) ---------------------------
interface JolpicaDriver {
  driverId: string;
  permanentNumber?: string;
  code?: string;
  givenName: string;
  familyName: string;
  dateOfBirth?: string;
  nationality: string;
}
interface JolpicaConstructor {
  constructorId: string;
  name: string;
  nationality: string;
}
interface DriverStanding {
  Driver: JolpicaDriver;
  Constructors: JolpicaConstructor[];
}
interface ApiResponse {
  MRData: {
    DriverTable?: { Drivers: JolpicaDriver[] };
    StandingsTable?: { StandingsLists: { DriverStandings: DriverStanding[] }[] };
  };
}
interface OpenF1Session {
  session_key: number;
}
interface OpenF1Driver {
  name_acronym?: string;
  driver_number?: number;
}

// --- Generated file shapes (match prisma/seed/validation.ts) ------------------
interface DriverFile {
  firstName: string;
  lastName: string;
  nationality: string;
  dateOfBirth?: string;
  racingNumber?: number;
  status: 'ACTIVE';
  slug: string; // internal only, stripped before writing
}
interface TeamFile {
  fullName: string;
  shortName: string;
  country: string;
  primaryColor: string;
  secondaryColor: string;
  status: 'ACTIVE';
  slug: string; // internal only, stripped before writing
}
interface EntryFile {
  team: string;
  series: 'f1';
  season: number;
  category: 'F1';
  carNumber: string;
  drivers: { driver: string; isPrimary: true }[];
}

async function fetchJson<T>(url: string): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const res = await fetch(url, { headers: { 'User-Agent': 'GridBase-API/0.1 (ingest)' } });
    if (res.ok) return (await res.json()) as T;
    if (res.status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      continue;
    }
    throw new Error(`Request failed ${res.status} for ${url}`);
  }
  throw new Error(`Request failed after retries: ${url}`);
}

async function fetchDrivers(year: number): Promise<JolpicaDriver[]> {
  const data = await fetchJson<ApiResponse>(
    `${JOLPICA_BASE}/${year}/drivers/?format=json&limit=100`,
  );
  return data.MRData.DriverTable?.Drivers ?? [];
}

async function fetchStandings(year: number): Promise<DriverStanding[]> {
  const data = await fetchJson<ApiResponse>(
    `${JOLPICA_BASE}/${year}/driverstandings/?format=json&limit=100`,
  );
  return data.MRData.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [];
}

/** Authoritative car numbers for a season, keyed by 3-letter code (OpenF1). */
async function openF1NumbersForYear(year: number): Promise<Map<string, string>> {
  const numbers = new Map<string, string>();
  try {
    const sessions = await fetchJson<OpenF1Session[]>(
      `${OPENF1_BASE}/sessions?year=${year}&session_name=Race`,
    );
    if (sessions.length === 0) return numbers;
    const keys = [...new Set([sessions[0].session_key, sessions[sessions.length - 1].session_key])];
    for (const key of keys) {
      const drivers = await fetchJson<OpenF1Driver[]>(`${OPENF1_BASE}/drivers?session_key=${key}`);
      for (const d of drivers) {
        if (d.name_acronym && d.driver_number != null && !numbers.has(d.name_acronym)) {
          numbers.set(d.name_acronym, String(d.driver_number));
        }
      }
    }
  } catch (error) {
    console.warn(`  ⚠️  OpenF1 numbers unavailable for ${year}: ${(error as Error).message}`);
  }
  return numbers;
}

function writeJson(relPath: string, records: unknown[]): void {
  const full = join(DATA_DIR, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, `${JSON.stringify(records, null, 2)}\n`);
  console.log(`📝 ${relPath} — ${records.length} records`);
}

async function main(): Promise<void> {
  console.log('🏁 GridBase API — generating F1 seed files (Jolpica + OpenF1)\n');

  const drivers = new Map<string, DriverFile>();
  const teams = new Map<string, TeamFile>();
  const entriesByYear = new Map<number, EntryFile[]>();

  for (const year of F1_SEASONS) {
    console.log(`🔍 F1 ${year}...`);
    const [standings, driversInfo, openF1Numbers] = await Promise.all([
      fetchStandings(year),
      fetchDrivers(year),
      openF1NumbersForYear(year),
    ]);

    if (standings.length === 0) {
      console.log(`  ⚠️  no standings yet — skipped`);
      continue;
    }

    const jolpicaNumber = new Map<string, string>();
    for (const d of driversInfo) {
      if (d.permanentNumber) jolpicaNumber.set(d.driverId, d.permanentNumber);
    }

    const entries: EntryFile[] = [];

    for (const standing of standings) {
      const driver = standing.Driver;
      // Current team = last constructor in the chronologically-ordered array.
      const constructor = standing.Constructors[standing.Constructors.length - 1];
      if (!constructor) continue;

      const driverSlug = slugify(driver.givenName, driver.familyName);
      const meta = TEAM_META[constructor.constructorId];
      const teamFullName = meta?.fullName ?? constructor.name;
      const teamSlug = slugify(teamFullName);

      const carNumber =
        (driver.code ? openF1Numbers.get(driver.code) : undefined) ??
        jolpicaNumber.get(driver.driverId) ??
        driverSlug;

      // Driver fiche — de-duplicated; latest season overwrites the number.
      drivers.set(driverSlug, {
        firstName: driver.givenName,
        lastName: driver.familyName,
        nationality: nationalityToISO(driver.nationality),
        dateOfBirth: driver.dateOfBirth,
        racingNumber: /^\d+$/.test(carNumber) ? Number(carNumber) : undefined,
        status: 'ACTIVE',
        slug: driverSlug,
      });

      // Team — de-duplicated.
      teams.set(teamSlug, {
        fullName: teamFullName,
        shortName: meta?.shortName ?? constructor.name,
        country: meta?.country ?? nationalityToISO(constructor.nationality),
        primaryColor: meta?.primaryColor ?? GENERIC_TEAM_COLOR,
        secondaryColor: meta?.secondaryColor ?? GENERIC_TEAM_COLOR,
        status: 'ACTIVE',
        slug: teamSlug,
      });

      entries.push({
        team: teamSlug,
        series: 'f1',
        season: year,
        category: 'F1',
        carNumber,
        drivers: [{ driver: driverSlug, isPrimary: true }],
      });
    }

    entries.sort((a, b) => Number(a.carNumber) - Number(b.carNumber));
    entriesByYear.set(year, entries);
    console.log(`  ✅ ${standings.length} drivers`);
  }

  // --- Write files (sorted for deterministic diffs) --------------------------
  console.log('');
  const driverRecords = [...drivers.values()]
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map(({ slug: _slug, ...d }) => stripUndefined(d));
  const teamRecords = [...teams.values()]
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map(({ slug: _slug, ...t }) => t);

  writeJson('drivers/f1.json', driverRecords);
  writeJson('teams/f1.json', teamRecords);
  for (const year of [...entriesByYear.keys()].sort()) {
    writeJson(`entries/f1-${year}.json`, entriesByYear.get(year) ?? []);
  }

  console.log('\nℹ️  F2 / F3 not generated (no free entry-list API). Add them by hand.');
  console.log('✅ Files written. Run `npm run db:seed` to load them into the database.');
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
