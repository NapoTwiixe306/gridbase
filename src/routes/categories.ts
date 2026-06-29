import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const categoryListQuerySchema = z.object({
  series: z.string().min(1).optional(),
});

export async function categoryRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/categories — every category (class) across all series.
  // Optional ?series=<slug> to restrict to one championship.
  app.get('/', async (request) => {
    const { series } = categoryListQuerySchema.parse(request.query);
    const categories = await app.prisma.category.findMany({
      where: series ? { series: { slug: series } } : undefined,
      orderBy: [{ series: { slug: 'asc' } }, { hierarchy: 'asc' }],
      include: {
        series: { select: { slug: true, shortName: true, fullName: true } },
        _count: { select: { entries: true } },
      },
    });
    return { data: categories };
  });
}
