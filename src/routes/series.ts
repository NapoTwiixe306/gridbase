import { FastifyInstance } from 'fastify';
import { AppError, currentYear } from '../types';

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
}
