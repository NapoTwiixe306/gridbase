import { PrismaClient } from '@prisma/client';

/**
 * Shared lookup maps built up as each seeder runs, so later seeders can resolve
 * human-friendly natural keys (slugs, names, year) to database IDs.
 */
export interface SeedContext {
  prisma: PrismaClient;
  /** series slug -> id */
  series: Map<string, string>;
  /** `${seriesSlug}:${year}` -> season id */
  seasons: Map<string, string>;
  /** `${seriesSlug}:${abbreviation}` -> category id */
  categories: Map<string, string>;
  /** manufacturer name -> id */
  manufacturers: Map<string, string>;
  /** circuit slug -> id */
  circuits: Map<string, string>;
  /** team slug -> id */
  teams: Map<string, string>;
  /** driver slug -> id */
  drivers: Map<string, string>;
}

export function createContext(prisma: PrismaClient): SeedContext {
  return {
    prisma,
    series: new Map(),
    seasons: new Map(),
    categories: new Map(),
    manufacturers: new Map(),
    circuits: new Map(),
    teams: new Map(),
    drivers: new Map(),
  };
}
