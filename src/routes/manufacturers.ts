import { FastifyInstance } from 'fastify';
import { paginationSchema } from '../schemas/common';

export async function manufacturerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request) => {
    const { page, limit } = paginationSchema.parse(request.query);
    const [data, total] = await Promise.all([
      app.prisma.manufacturer.findMany({
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      app.prisma.manufacturer.count(),
    ]);
    return {
      data,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  });
}
