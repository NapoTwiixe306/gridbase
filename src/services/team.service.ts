import { Prisma, PrismaClient } from '@prisma/client';
import { AppError, currentYear, PaginatedResult } from '../types';
import { TeamListQuery, TeamTransfersQuery } from '../schemas/team.schema';
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

export class TeamService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(query: TeamListQuery): Promise<PaginatedResult<unknown>> {
    const { page, limit, series, country, status } = query;

    const where: Prisma.TeamWhereInput = {};
    if (country) where.country = country;
    if (status) where.status = status;
    if (series) where.entries = { some: { series: { slug: series } } };

    const [teams, total] = await Promise.all([
      this.prisma.team.findMany({
        where,
        orderBy: { fullName: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.team.count({ where }),
    ]);

    return {
      data: teams,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async getByIdOrSlug(idOrSlug: string): Promise<unknown> {
    const team = await this.prisma.team.findFirst({
      where: looksLikeCuid(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug },
      include: {
        entries: {
          where: { season: { year: currentYear() } },
          include: entryInclude,
        },
      },
    });
    if (!team) throw AppError.notFound('Team not found');

    const { entries, ...base } = team;
    return {
      ...base,
      current_entries: entries.map(toEntrySummary),
      current_drivers: dedupeDrivers(entries),
    };
  }

  async listDrivers(idOrSlug: string): Promise<unknown[]> {
    const team = await this.prisma.team.findFirst({
      where: looksLikeCuid(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug },
      select: { id: true },
    });
    if (!team) throw AppError.notFound('Team not found');

    const entries = await this.prisma.entry.findMany({
      where: { teamId: team.id, season: { year: currentYear() } },
      include: entryInclude,
    });

    return dedupeDrivers(entries);
  }

  async listTransfers(idOrSlug: string, filter: TeamTransfersQuery): Promise<unknown[]> {
    const team = await this.prisma.team.findFirst({
      where: looksLikeCuid(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug },
      select: { id: true },
    });
    if (!team) throw AppError.notFound('Team not found');

    const where: Prisma.TransferWhereInput = {
      OR: [{ fromTeamId: team.id }, { toTeamId: team.id }],
    };
    if (filter.season) where.season = filter.season;

    return this.prisma.transfer.findMany({
      where,
      orderBy: { announcedAt: 'desc' },
      include: { driver: true, fromTeam: true, toTeam: true },
    });
  }
}

type EntryForDrivers = Prisma.EntryGetPayload<{ include: typeof entryInclude }>;

function dedupeDrivers(entries: EntryForDrivers[]): unknown[] {
  const map = new Map<string, unknown>();
  for (const entry of entries) {
    for (const ed of entry.drivers) {
      if (map.has(ed.driver.id)) continue;
      map.set(ed.driver.id, {
        id: ed.driver.id,
        firstName: ed.driver.firstName,
        lastName: ed.driver.lastName,
        slug: ed.driver.slug,
        nationality: ed.driver.nationality,
        status: ed.driver.status,
        role: ed.role,
        carNumber: entry.carNumber,
        series: { slug: entry.series.slug, shortName: entry.series.shortName },
        wecClassification: ed.wecClassification,
      });
    }
  }
  return [...map.values()];
}
