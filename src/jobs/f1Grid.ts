import { PrismaClient } from '@prisma/client';
import { slugify } from '../schemas/common';

/**
 * Refreshes the F1 grid in the database from Jolpica (the free Ergast successor)
 * so that new/changed line-ups show up automatically. Everything is upserted by
 * natural key (team slug, driver slug, [season, carNumber]) so re-runs never
 * duplicate. Entries created here are CONFIRMED (Jolpica reflects actual, official
 * participation), which the transfer job maps to OFFICIAL transfers.
 *
 * Only F1 is covered: no free API exposes entry lists for WEC/IMSA/GT/etc., so
 * those grids stay community-maintained and their transfers are derived the same
 * way from whatever the community enters.
 */

const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1';
const USER_AGENT =
  'GridBase-API/0.1 (transfer-cron; https://github.com/NapoTwiixe306/gridbase-api)';

// Jolpica constructorId → the canonical team slug already used in our data.
const CONSTRUCTOR_SLUG: Record<string, string> = {
  red_bull: 'red-bull-racing',
  mercedes: 'mercedes-amg-petronas',
  ferrari: 'scuderia-ferrari',
  mclaren: 'mclaren',
  aston_martin: 'aston-martin',
  alpine: 'alpine',
  williams: 'williams',
  haas: 'haas',
  sauber: 'kick-sauber',
  rb: 'rb-visa-cash-app-rb',
  audi: 'audi',
  cadillac: 'cadillac-f1-team',
};

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
}
interface ApiResponse {
  MRData: {
    StandingsTable?: {
      StandingsLists: {
        DriverStandings: { Driver: JolpicaDriver; Constructors: JolpicaConstructor[] }[];
      }[];
    };
  };
}

export interface F1GridSummary {
  seasons: number[];
  entriesUpserted: number;
}

async function fetchJson<T>(url: string): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.ok) return (await res.json()) as T;
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      continue;
    }
    throw new Error(`Jolpica request failed ${res.status} for ${url}`);
  }
  throw new Error(`Jolpica request failed after retries: ${url}`);
}

export async function refreshF1Grid(prisma: PrismaClient): Promise<F1GridSummary> {
  const series = await prisma.series.findUnique({ where: { slug: 'f1' }, select: { id: true } });
  if (!series) return { seasons: [], entriesUpserted: 0 };

  const now = new Date().getFullYear();
  const years = [now, now + 1];
  const done: number[] = [];
  let entriesUpserted = 0;

  for (const year of years) {
    const data = await fetchJson<ApiResponse>(
      `${JOLPICA_BASE}/${year}/driverstandings/?format=json&limit=100`,
    );
    const standings = data.MRData.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [];
    if (standings.length === 0) continue; // future season with no data yet

    const season = await prisma.season.upsert({
      where: { seriesId_year: { seriesId: series.id, year } },
      create: { seriesId: series.id, year, status: 'UPCOMING' },
      update: {},
      select: { id: true },
    });

    for (const standing of standings) {
      const driver = standing.Driver;
      const constructor = standing.Constructors[standing.Constructors.length - 1];
      if (!constructor) continue;

      const teamId = await resolveTeam(prisma, constructor);
      const driverId = await resolveDriver(prisma, driver);
      const carNumber =
        driver.permanentNumber ?? driver.code ?? slugify(driver.givenName, driver.familyName);

      const entry = await prisma.entry.upsert({
        where: { seasonId_carNumber: { seasonId: season.id, carNumber } },
        create: {
          teamId,
          seasonId: season.id,
          seriesId: series.id,
          carNumber,
          status: 'CONFIRMED',
        },
        update: { teamId, status: 'CONFIRMED' },
        select: { id: true },
      });

      await prisma.entryDriver.upsert({
        where: { entryId_driverId: { entryId: entry.id, driverId } },
        create: { entryId: entry.id, driverId, isPrimary: true },
        update: {},
      });
      entriesUpserted += 1;
    }

    done.push(year);
  }

  return { seasons: done, entriesUpserted };
}

async function resolveTeam(prisma: PrismaClient, c: JolpicaConstructor): Promise<string> {
  const slug = CONSTRUCTOR_SLUG[c.constructorId] ?? slugify(c.name);
  const team = await prisma.team.upsert({
    where: { slug },
    create: { slug, fullName: c.name, shortName: c.name, country: 'XX' },
    update: {}, // never clobber curated colours / metadata
    select: { id: true },
  });
  return team.id;
}

async function resolveDriver(prisma: PrismaClient, d: JolpicaDriver): Promise<string> {
  const slug = slugify(d.givenName, d.familyName);
  const driver = await prisma.driver.upsert({
    where: { slug },
    create: {
      slug,
      firstName: d.givenName,
      lastName: d.familyName,
      dateOfBirth: d.dateOfBirth ? new Date(d.dateOfBirth) : null,
      status: 'ACTIVE',
    },
    update: {},
    select: { id: true },
  });
  return driver.id;
}
