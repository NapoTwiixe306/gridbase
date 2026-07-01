import { Prisma, PrismaClient } from '@prisma/client';
import { AppError, PaginatedResult } from '../types';
import { looksLikeCuid } from '../schemas/common';
import {
  TransferListQuery,
  MercatoQuery,
  GridCompareQuery,
  TransferInput,
} from '../schemas/transfer.schema';

/** Everything needed to render a transfer "card" (team badges + driver avatar). */
const transferInclude = {
  driver: true,
  fromTeam: true,
  toTeam: true,
  fromSeries: true,
  toSeries: true,
} satisfies Prisma.TransferInclude;

type TransferWithRelations = Prisma.TransferGetPayload<{ include: typeof transferInclude }>;

/** Entry line-up needed to diff two seasons for the grid comparator. */
const gridEntryInclude = {
  team: true,
  category: true,
  drivers: { include: { driver: true } },
} satisfies Prisma.EntryInclude;

type GridEntry = Prisma.EntryGetPayload<{ include: typeof gridEntryInclude }>;

export class TransferService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Create a transfer and return it as a ready-to-render card. */
  async create(input: TransferInput): Promise<ReturnType<typeof toTransferCard>> {
    const created = await this.prisma.transfer.create({
      data: input,
      include: transferInclude,
    });
    return toTransferCard(created);
  }

  /** Chronological feed of transfers, filterable and paginated. */
  async list(query: TransferListQuery): Promise<PaginatedResult<unknown>> {
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
        include: transferInclude,
        orderBy: [{ announcedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transfer.count({ where }),
    ]);

    return {
      data: transfers.map(toTransferCard),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  /** The most recent transfers, for the landing "latest transfers" strip. */
  async latest(take = 20): Promise<unknown[]> {
    const transfers = await this.prisma.transfer.findMany({
      take,
      where: { status: { not: 'CANCELLED' } },
      orderBy: [{ announcedAt: 'desc' }, { createdAt: 'desc' }],
      include: transferInclude,
    });
    return transfers.map(toTransferCard);
  }

  /**
   * Mercato view grouped by team for one series + season: each team's arrivals
   * (in), departures (out) and net balance, sorted by who recruited the most.
   */
  async mercatoByTeam(query: MercatoQuery): Promise<unknown> {
    const { series, season } = query;

    const transfers = await this.prisma.transfer.findMany({
      where: {
        season,
        status: { not: 'CANCELLED' },
        OR: [{ fromSeries: { slug: series } }, { toSeries: { slug: series } }],
      },
      include: transferInclude,
    });

    const teams = new Map<
      string,
      { team: ReturnType<typeof toTeamBadge>; in: unknown[]; out: unknown[] }
    >();

    const bucket = (team: TransferWithRelations['toTeam']) => {
      if (!team) return null;
      if (!teams.has(team.id)) teams.set(team.id, { team: toTeamBadge(team), in: [], out: [] });
      return teams.get(team.id)!;
    };

    for (const t of transfers) {
      const driver = toDriverBadge(t.driver);
      // An arrival counts for the destination team when the move lands in-series.
      if (t.toTeam && t.toSeries?.slug === series)
        bucket(t.toTeam)?.in.push({ driver, transferId: t.id });
      // A departure counts for the origin team when the move leaves from in-series.
      if (t.fromTeam && t.fromSeries?.slug === series)
        bucket(t.fromTeam)?.out.push({ driver, transferId: t.id });
    }

    const rows = [...teams.values()]
      .map((r) => ({ ...r, net: r.in.length - r.out.length }))
      .sort((a, b) => b.net - a.net || b.in.length - a.in.length);

    return { series, season, teams: rows };
  }

  /** A single driver's team-change history, oldest first (for the profile). */
  async driverTimeline(idOrSlug: string): Promise<unknown[]> {
    const driver = await this.prisma.driver.findFirst({
      where: looksLikeCuid(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug },
      select: { id: true },
    });
    if (!driver) throw AppError.notFound('Driver not found');

    const transfers = await this.prisma.transfer.findMany({
      where: { driverId: driver.id },
      orderBy: [{ announcedAt: 'asc' }, { createdAt: 'asc' }],
      include: transferInclude,
    });
    return transfers.map(toTransferCard);
  }

  /**
   * Grid comparator: diff a series' driver line-up between two seasons.
   * Derived from Entries (not Transfers), so it works from the entry data alone.
   *   joined  → in season B, not in season A (green)
   *   left    → in season A, not in season B (red)
   *   stayed  → in both (with each season's team, to reveal internal moves)
   */
  async compareGrids(query: GridCompareQuery): Promise<unknown> {
    const { series, seasonA, seasonB } = query;

    const [entriesA, entriesB] = await Promise.all([
      this.seasonEntries(series, seasonA),
      this.seasonEntries(series, seasonB),
    ]);

    const gridA = driverTeamMap(entriesA);
    const gridB = driverTeamMap(entriesB);

    const joined: unknown[] = [];
    const left: unknown[] = [];
    const stayed: unknown[] = [];

    for (const [driverId, b] of gridB) {
      const a = gridA.get(driverId);
      if (a) {
        stayed.push({
          driver: b.driver,
          fromTeam: a.team,
          toTeam: b.team,
          changedTeam: a.team.id !== b.team.id,
        });
      } else {
        joined.push({ driver: b.driver, team: b.team });
      }
    }
    for (const [driverId, a] of gridA) {
      if (!gridB.has(driverId)) left.push({ driver: a.driver, team: a.team });
    }

    const byName = (x: { driver: { lastName: string } }, y: { driver: { lastName: string } }) =>
      x.driver.lastName.localeCompare(y.driver.lastName);

    return {
      series,
      seasonA,
      seasonB,
      summary: { stayed: stayed.length, joined: joined.length, left: left.length },
      joined: joined.sort(byName as never),
      left: left.sort(byName as never),
      stayed: stayed.sort(byName as never),
    };
  }

  private async seasonEntries(series: string, year: number): Promise<GridEntry[]> {
    return this.prisma.entry.findMany({
      where: {
        series: { slug: series },
        season: { year },
        status: { in: ['CONFIRMED'] },
      },
      include: gridEntryInclude,
    });
  }
}

/** Reduce a season's entries to one row per driver with their team. */
function driverTeamMap(
  entries: GridEntry[],
): Map<string, { driver: ReturnType<typeof toDriverBadge>; team: ReturnType<typeof toTeamBadge> }> {
  const map = new Map<
    string,
    { driver: ReturnType<typeof toDriverBadge>; team: ReturnType<typeof toTeamBadge> }
  >();
  for (const entry of entries) {
    for (const ed of entry.drivers) {
      if (map.has(ed.driver.id)) continue;
      map.set(ed.driver.id, { driver: toDriverBadge(ed.driver), team: toTeamBadge(entry.team) });
    }
  }
  return map;
}

/** Compact team badge: colours for the visual system, no logo. */
export function toTeamBadge(team: NonNullable<TransferWithRelations['toTeam']>) {
  return {
    id: team.id,
    fullName: team.fullName,
    shortName: team.shortName,
    slug: team.slug,
    primaryColor: team.primaryColor,
    secondaryColor: team.secondaryColor,
  };
}

/** Compact driver badge: name + avatar source (Wikimedia photo or null). */
export function toDriverBadge(driver: TransferWithRelations['driver']) {
  return {
    id: driver.id,
    firstName: driver.firstName,
    lastName: driver.lastName,
    slug: driver.slug,
    nationality: driver.nationality,
    photoUrl: driver.photoUrl,
  };
}

/** The double-sided transfer card consumed by the tracker feed. */
export function toTransferCard(t: TransferWithRelations) {
  return {
    id: t.id,
    driver: toDriverBadge(t.driver),
    from: t.fromTeam
      ? { team: toTeamBadge(t.fromTeam), series: toSeriesBadge(t.fromSeries) }
      : null,
    to: t.toTeam ? { team: toTeamBadge(t.toTeam), series: toSeriesBadge(t.toSeries) } : null,
    season: t.season,
    status: t.status,
    type: t.type,
    announcedAt: t.announcedAt,
    effectiveAt: t.effectiveAt,
    sourceUrl: t.sourceUrl,
    notes: t.notes,
  };
}

function toSeriesBadge(series: TransferWithRelations['fromSeries']) {
  if (!series) return null;
  return { id: series.id, shortName: series.shortName, slug: series.slug };
}
