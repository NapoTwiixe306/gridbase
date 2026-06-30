import { Prisma, PrismaClient } from '@prisma/client';
import { AppError, currentYear, PaginatedResult } from '../types';
import { DriverListQuery, DriverEntriesQuery } from '../schemas/driver.schema';
import { looksLikeCuid } from '../schemas/common';

/** Entry shape with everything needed to render driver/team profiles. */
const entryInclude = {
  team: true,
  series: true,
  category: true,
  manufacturer: true,
  season: true,
  drivers: { include: { driver: true } },
} satisfies Prisma.EntryInclude;

type EntryWithRelations = Prisma.EntryGetPayload<{ include: typeof entryInclude }>;

export class DriverService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(query: DriverListQuery): Promise<PaginatedResult<unknown>> {
    const { page, limit, series, nationality, status } = query;

    const where: Prisma.DriverWhereInput = {};
    if (nationality) where.nationality = nationality;
    if (status) where.status = status;
    if (series) {
      where.entryDrivers = {
        some: { entry: { series: { slug: series } } },
      };
    }

    const [drivers, total] = await Promise.all([
      this.prisma.driver.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          entryDrivers: {
            where: { entry: { season: { year: currentYear() } } },
            include: { entry: { include: entryInclude } },
          },
        },
      }),
      this.prisma.driver.count({ where }),
    ]);

    const data = drivers.map((driver) => {
      const entries = driver.entryDrivers.map((ed) => ed.entry);
      const { entryDrivers, ...base } = driver;
      return { ...base, current_entries: entries.map(toEntrySummary) };
    });

    return {
      data,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  /** Resolve a driver by cuid or slug. */
  async getByIdOrSlug(idOrSlug: string): Promise<unknown> {
    const driver = await this.prisma.driver.findFirst({
      where: looksLikeCuid(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug },
      include: {
        entryDrivers: {
          where: { entry: { season: { year: currentYear() } } },
          include: { entry: { include: entryInclude } },
        },
        titles: { orderBy: [{ year: 'desc' }] },
      },
    });

    if (!driver) throw AppError.notFound('Driver not found');

    const entryDrivers = driver.entryDrivers;
    const currentEntries = entryDrivers.map((ed) => ed.entry);

    const teamsMap = new Map<string, EntryWithRelations['team']>();
    const seriesMap = new Map<string, EntryWithRelations['series']>();
    for (const entry of currentEntries) {
      teamsMap.set(entry.team.id, entry.team);
      seriesMap.set(entry.series.id, entry.series);
    }

    const primaryEntryDriver = entryDrivers.find((ed) => ed.role === 'TITULAR') ?? entryDrivers[0];

    const { entryDrivers: _drivers, titles, ...base } = driver;

    return {
      ...base,
      current_entries: currentEntries.map(toEntrySummary),
      current_teams: [...teamsMap.values()].map(toTeamSummary),
      current_series: [...seriesMap.values()].map(toSeriesSummary),
      is_multi_series: seriesMap.size > 1,
      primary_team: primaryEntryDriver ? toTeamSummary(primaryEntryDriver.entry.team) : null,
      titles: titles.map((t) => ({ year: t.year, series: t.series, category: t.category })),
      titles_count: titles.length,
    };
  }

  /** A driver's championship titles (palmarès), most recent first. */
  async listTitles(idOrSlug: string): Promise<unknown[]> {
    const driver = await this.prisma.driver.findFirst({
      where: looksLikeCuid(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug },
      select: { id: true },
    });
    if (!driver) throw AppError.notFound('Driver not found');

    const titles = await this.prisma.driverTitle.findMany({
      where: { driverId: driver.id },
      orderBy: [{ year: 'desc' }],
      select: { year: true, series: true, category: true, sourceUrl: true },
    });
    return titles;
  }

  /** All entries for a driver across all seasons; optional series/season filter. */
  async listEntries(idOrSlug: string, filter: DriverEntriesQuery): Promise<unknown[]> {
    const driver = await this.prisma.driver.findFirst({
      where: looksLikeCuid(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug },
      select: { id: true },
    });
    if (!driver) throw AppError.notFound('Driver not found');

    const entryWhere: Prisma.EntryWhereInput = {
      drivers: { some: { driverId: driver.id } },
    };
    if (filter.series) entryWhere.series = { slug: filter.series };
    if (filter.season) entryWhere.season = { year: filter.season };

    const entries = await this.prisma.entry.findMany({
      where: entryWhere,
      include: entryInclude,
      orderBy: [{ season: { year: 'desc' } }],
    });

    return entries.map(toEntrySummary);
  }

  async search(q: string): Promise<unknown[]> {
    const drivers = await this.prisma.driver.findMany({
      where: {
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { nickname: { contains: q } },
        ],
      },
      orderBy: [{ lastName: 'asc' }],
      take: 25,
    });
    return drivers;
  }
}

export function toEntrySummary(entry: EntryWithRelations) {
  return {
    id: entry.id,
    carNumber: entry.carNumber,
    chassis: entry.chassis,
    status: entry.status,
    season: entry.season.year,
    team: toTeamSummary(entry.team),
    series: toSeriesSummary(entry.series),
    category: entry.category
      ? {
          id: entry.category.id,
          fullName: entry.category.fullName,
          abbreviation: entry.category.abbreviation,
        }
      : null,
    manufacturer: entry.manufacturer
      ? { id: entry.manufacturer.id, name: entry.manufacturer.name }
      : null,
    drivers: entry.drivers.map((ed) => ({
      id: ed.driver.id,
      firstName: ed.driver.firstName,
      lastName: ed.driver.lastName,
      slug: ed.driver.slug,
      role: ed.role,
      isPrimary: ed.isPrimary,
      wecClassification: ed.wecClassification,
    })),
  };
}

export function toTeamSummary(team: EntryWithRelations['team']) {
  return {
    id: team.id,
    fullName: team.fullName,
    shortName: team.shortName,
    slug: team.slug,
    primaryColor: team.primaryColor,
    secondaryColor: team.secondaryColor,
  };
}

export function toSeriesSummary(series: EntryWithRelations['series']) {
  return {
    id: series.id,
    fullName: series.fullName,
    shortName: series.shortName,
    slug: series.slug,
  };
}
