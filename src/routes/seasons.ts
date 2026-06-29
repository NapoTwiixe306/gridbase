import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { paginationSchema } from '../schemas/common';
import { AppError } from '../types';

const seasonListQuerySchema = paginationSchema.extend({
  series: z.string().min(1).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
});

export async function seasonRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request) => {
    const { page, limit, series, year } = seasonListQuerySchema.parse(request.query);
    const where = {
      ...(series ? { series: { slug: series } } : {}),
      ...(year ? { year } : {}),
    };
    const [data, total] = await Promise.all([
      app.prisma.season.findMany({
        where,
        include: { series: true },
        orderBy: [{ year: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      app.prisma.season.count({ where }),
    ]);
    return {
      data,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  });

  app.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const season = await app.prisma.season.findUnique({
      where: { id },
      include: { series: true, _count: { select: { entries: true } } },
    });
    if (!season) throw AppError.notFound('Season not found');
    return { data: season };
  });
}
