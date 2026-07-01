import { Prisma, PrismaClient } from '@prisma/client';
import { PaginatedResult } from '../types';
import { EntryListQuery } from '../schemas/entry.schema';
import { looksLikeCuid } from '../schemas/common';
import { toEntrySummary } from './driver.service';

const entryInclude = {
  team: true,
  series: true,
  category: true,
  manufacturer: true,
  season: true,
  drivers: { include: { driver: true } },
} satisfies Prisma.EntryInclude;

export class EntryService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(query: EntryListQuery): Promise<PaginatedResult<unknown>> {
    const { page, limit, series, season, team, driver, category } = query;

    const where: Prisma.EntryWhereInput = {};
    if (series) where.series = { slug: series };
    if (season) where.season = { year: season };
    if (category) where.category = { abbreviation: category };
    if (team) {
      where.team = looksLikeCuid(team) ? { id: team } : { slug: team };
    }
    if (driver) {
      where.drivers = {
        some: looksLikeCuid(driver) ? { driverId: driver } : { driver: { slug: driver } },
      };
    }

    const [entries, total] = await Promise.all([
      this.prisma.entry.findMany({
        where,
        include: entryInclude,
        orderBy: [{ season: { year: 'desc' } }, { carNumber: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.entry.count({ where }),
    ]);

    return {
      data: entries.map(toEntrySummary),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }
}
