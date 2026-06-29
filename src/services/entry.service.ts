import { Prisma, PrismaClient } from '@prisma/client';
import { PaginatedResult } from '../types';
import { EntryListQuery } from '../schemas/entry.schema';
import { TransferListQuery } from '../schemas/transfer.schema';
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

  async listTransfers(query: TransferListQuery): Promise<PaginatedResult<unknown>> {
    const { page, limit, series, season, status, team, driver } = query;

    const where: Prisma.TransferWhereInput = {};
    if (season) where.season = season;
    if (status) where.status = status;
    if (series) {
      where.OR = [{ fromSeries: { slug: series } }, { toSeries: { slug: series } }];
    }
    if (team) {
      const teamWhere = looksLikeCuid(team) ? { id: team } : { slug: team };
      where.AND = [{ OR: [{ fromTeam: teamWhere }, { toTeam: teamWhere }] }];
    }
    if (driver) {
      where.driver = looksLikeCuid(driver) ? { id: driver } : { slug: driver };
    }

    const [transfers, total] = await Promise.all([
      this.prisma.transfer.findMany({
        where,
        include: { driver: true, fromTeam: true, toTeam: true, fromSeries: true, toSeries: true },
        orderBy: { announcedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transfer.count({ where }),
    ]);

    return {
      data: transfers,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async latestTransfers(): Promise<unknown[]> {
    return this.prisma.transfer.findMany({
      take: 20,
      orderBy: { announcedAt: 'desc' },
      include: { driver: true, fromTeam: true, toTeam: true, fromSeries: true, toSeries: true },
    });
  }
}
