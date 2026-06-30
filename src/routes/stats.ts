import { FastifyInstance } from 'fastify';

export async function statsRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/stats — global totals. `drivers` is the count of UNIQUE drivers
  // (one row per person, regardless of how many series/seasons they race in).
  app.get('/', async () => {
    const [
      drivers,
      teams,
      manufacturers,
      series,
      seasons,
      categories,
      circuits,
      entries,
      transfers,
    ] = await Promise.all([
      app.prisma.driver.count(),
      app.prisma.team.count(),
      app.prisma.manufacturer.count(),
      app.prisma.series.count(),
      app.prisma.season.count(),
      app.prisma.category.count(),
      app.prisma.circuit.count(),
      app.prisma.entry.count(),
      app.prisma.transfer.count(),
    ]);

    return {
      data: {
        drivers, // unique drivers, all categories combined
        teams,
        manufacturers,
        series,
        seasons,
        categories,
        circuits,
        entries,
        transfers,
      },
    };
  });
}
