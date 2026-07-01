import { Prisma, PrismaClient, TransferStatus } from '@prisma/client';
import { TransferHub } from '../plugins/realtime';
import { toTransferCard } from '../services/transfer.service';

/**
 * Derives transfers from the grid data (Entries) and materialises them as
 * Transfer rows — no manual entry, no news scraping. Whenever a driver appears
 * in a different team than the previous season **within the same series**, that
 * team change is a transfer. The transfer's status is taken from the driver's
 * destination entry:
 *
 *   Entry CONFIRMED  → Transfer OFFICIAL
 *   Entry RUMOUR     → Transfer RUMOUR
 *
 * The job is idempotent: a transfer is keyed by (driver, destination team,
 * season). Re-runs never duplicate, and a RUMOUR is upgraded to OFFICIAL the
 * moment its entry becomes CONFIRMED (never downgraded). Newly created or
 * upgraded transfers are pushed live to SSE subscribers when a hub is given.
 */

const transferInclude = {
  driver: true,
  fromTeam: true,
  toTeam: true,
  fromSeries: true,
  toSeries: true,
} satisfies Prisma.TransferInclude;

// Higher = more definitive. We only ever move a transfer up this ladder.
const STATUS_RANK: Record<TransferStatus, number> = {
  CANCELLED: 0,
  RUMOUR: 1,
  CONFIRMED: 2,
  OFFICIAL: 3,
};

export interface TransferSyncSummary {
  moves: number;
  created: number;
  upgraded: number;
}

interface SeasonSlot {
  year: number;
  teamId: string;
  seriesId: string;
  status: TransferStatus; // OFFICIAL or RUMOUR, mapped from the entry status
  announcedAt: Date | null;
  sourceUrl: string | null;
}

interface Move {
  driverId: string;
  fromTeamId: string;
  toTeamId: string;
  seriesId: string;
  season: string;
  status: TransferStatus;
  announcedAt: Date | null;
  sourceUrl: string | null;
}

export async function syncTransfers(
  prisma: PrismaClient,
  hub?: TransferHub,
): Promise<TransferSyncSummary> {
  const entries = await prisma.entry.findMany({
    where: { status: { in: ['CONFIRMED', 'RUMOUR'] } },
    select: {
      teamId: true,
      seriesId: true,
      status: true,
      announcedAt: true,
      sourceUrl: true,
      season: { select: { year: true } },
      drivers: { select: { driverId: true } },
    },
  });

  // Group each driver's seasons within a single series: key = `${driver}:${series}`.
  const timelines = new Map<string, Map<number, SeasonSlot>>();
  for (const e of entries) {
    const slotStatus: TransferStatus = e.status === 'CONFIRMED' ? 'OFFICIAL' : 'RUMOUR';
    for (const ed of e.drivers) {
      const key = `${ed.driverId}:${e.seriesId}`;
      let byYear = timelines.get(key);
      if (!byYear) timelines.set(key, (byYear = new Map()));
      const existing = byYear.get(e.season.year);
      // One team per (driver, series, year). A CONFIRMED entry wins over a rumour
      // if a driver somehow has both for the same season.
      if (!existing || (existing.status === 'RUMOUR' && slotStatus === 'OFFICIAL')) {
        byYear.set(e.season.year, {
          year: e.season.year,
          teamId: e.teamId,
          seriesId: e.seriesId,
          status: slotStatus,
          announcedAt: e.announcedAt,
          sourceUrl: e.sourceUrl,
        });
      }
    }
  }

  // Detect adjacent-season team changes. The timeline key is `${driverId}:${seriesId}`.
  const moves: Move[] = [];
  for (const [key, byYear] of timelines) {
    const driverId = key.slice(0, key.indexOf(':'));
    const slots = [...byYear.values()].sort((a, b) => a.year - b.year);
    for (let i = 1; i < slots.length; i += 1) {
      const prev = slots[i - 1];
      const cur = slots[i];
      if (prev.teamId === cur.teamId) continue;
      moves.push({
        driverId,
        fromTeamId: prev.teamId,
        toTeamId: cur.teamId,
        seriesId: cur.seriesId,
        season: String(cur.year),
        status: cur.status,
        announcedAt: cur.announcedAt,
        sourceUrl: cur.sourceUrl,
      });
    }
  }

  let created = 0;
  let upgraded = 0;
  for (const move of moves) {
    const result = await upsertTransfer(prisma, move);
    if (result === 'created') created += 1;
    if (result === 'upgraded') upgraded += 1;
    if (result !== 'unchanged' && hub) {
      const row = await prisma.transfer.findFirst({
        where: { driverId: move.driverId, toTeamId: move.toTeamId, season: move.season },
        include: transferInclude,
      });
      if (row) hub.broadcast('transfer', toTransferCard(row));
    }
  }

  return { moves: moves.length, created, upgraded };
}

type UpsertResult = 'created' | 'upgraded' | 'unchanged';

async function upsertTransfer(prisma: PrismaClient, move: Move): Promise<UpsertResult> {
  const existing = await prisma.transfer.findFirst({
    where: { driverId: move.driverId, toTeamId: move.toTeamId, season: move.season },
    select: { id: true, status: true },
  });

  if (!existing) {
    await prisma.transfer.create({
      data: {
        driverId: move.driverId,
        fromTeamId: move.fromTeamId,
        toTeamId: move.toTeamId,
        fromSeriesId: move.seriesId,
        toSeriesId: move.seriesId,
        season: move.season,
        status: move.status,
        type: 'TRANSFER',
        announcedAt: move.announcedAt,
        sourceUrl: move.sourceUrl,
      },
    });
    return 'created';
  }

  if (STATUS_RANK[move.status] > STATUS_RANK[existing.status]) {
    await prisma.transfer.update({
      where: { id: existing.id },
      data: {
        status: move.status,
        announcedAt: move.announcedAt ?? undefined,
        sourceUrl: move.sourceUrl ?? undefined,
      },
    });
    return 'upgraded';
  }

  return 'unchanged';
}
