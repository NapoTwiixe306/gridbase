import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError, currentYear } from '../types';

const seasonQuerySchema = z.object({
  season: z.coerce.number().int().min(1900).max(2100).optional(),
});

export async function seriesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => {
    const series = await app.prisma.series.findMany({
      orderBy: { fullName: 'asc' },
      include: { _count: { select: { seasons: true, entries: true } } },
    });
    return { data: series };
  });

  app.get('/:slug', async (request) => {
    const { slug } = request.params as { slug: string };
    const series = await app.prisma.series.findUnique({
      where: { slug },
      include: {
        categories: { orderBy: { hierarchy: 'asc' } },
        seasons: { orderBy: { year: 'desc' } },
      },
    });
    if (!series) throw AppError.notFound('Series not found');

    const currentSeason = series.seasons.find((s) => s.year === currentYear()) ?? null;
    const entriesCount = currentSeason
      ? await app.prisma.entry.count({ where: { seasonId: currentSeason.id } })
      : 0;

    return {
      data: {
        ...series,
        current_season: currentSeason ? { ...currentSeason, entries_count: entriesCount } : null,
      },
    };
  });

  // GET /series/:slug/calendar?season=2026 — the rounds of a series (defaults
  // to the current year), in round order, with their circuit.
  app.get('/:slug/calendar', async (request) => {
    const { slug } = request.params as { slug: string };
    const { season } = seasonQuerySchema.parse(request.query);
    const year = season ?? currentYear();

    const series = await app.prisma.series.findUnique({ where: { slug }, select: { id: true } });
    if (!series) throw AppError.notFound('Series not found');

    const rounds = await app.prisma.round.findMany({
      where: { season: { seriesId: series.id, year } },
      orderBy: { roundNumber: 'asc' },
      include: { circuit: true },
    });
    return { data: { season: year, rounds } };
  });

  // GET /series/:slug/circuits?season=2026 — the distinct circuits a series
  // races at (defaults to the current year).
  app.get('/:slug/circuits', async (request) => {
    const { slug } = request.params as { slug: string };
    const { season } = seasonQuerySchema.parse(request.query);
    const year = season ?? currentYear();

    const series = await app.prisma.series.findUnique({ where: { slug }, select: { id: true } });
    if (!series) throw AppError.notFound('Series not found');

    const rounds = await app.prisma.round.findMany({
      where: { season: { seriesId: series.id, year } },
      orderBy: { roundNumber: 'asc' },
      include: { circuit: true },
    });

    const seen = new Set<string>();
    const circuits = [];
    for (const r of rounds) {
      if (seen.has(r.circuit.id)) continue;
      seen.add(r.circuit.id);
      circuits.push(r.circuit);
    }
    return { data: circuits };
  });
}
