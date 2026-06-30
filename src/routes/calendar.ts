import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const upcomingQuerySchema = z.object({
  series: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export async function calendarRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/calendar/upcoming — next races across all series (or one),
  // ordered by date. Powers a landing page "next races" / a calendar view.
  app.get('/upcoming', async (request) => {
    const { series, limit } = upcomingQuerySchema.parse(request.query);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rounds = await app.prisma.round.findMany({
      where: {
        OR: [{ startDate: { gte: today } }, { endDate: { gte: today } }],
        ...(series ? { season: { series: { slug: series } } } : {}),
      },
      orderBy: [{ startDate: 'asc' }],
      take: limit,
      include: {
        circuit: true,
        season: { include: { series: { select: { slug: true, shortName: true } } } },
      },
    });

    const data = rounds.map((r) => ({
      series: r.season.series.slug,
      seriesName: r.season.series.shortName,
      season: r.season.year,
      round: r.roundNumber,
      name: r.name,
      startDate: r.startDate,
      endDate: r.endDate,
      circuit: {
        name: r.circuit.name,
        slug: r.circuit.slug,
        country: r.circuit.country,
        city: r.circuit.city,
      },
    }));

    return { data };
  });
}
