import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { isoCountrySchema, looksLikeCuid, paginationSchema } from '../schemas/common';
import { AppError } from '../types';

const circuitListQuerySchema = paginationSchema.extend({
  country: isoCountrySchema.optional(),
  type: z.enum(['PERMANENT', 'STREET', 'OVAL', 'ROAD']).optional(),
});

export async function circuitRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/circuits — alphabetical, paginated; filter by country / type.
  app.get('/', async (request) => {
    const { page, limit, country, type } = circuitListQuerySchema.parse(request.query);
    const where = {
      ...(country ? { country } : {}),
      ...(type ? { type } : {}),
    };
    const [data, total] = await Promise.all([
      app.prisma.circuit.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      app.prisma.circuit.count({ where }),
    ]);
    return {
      data,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  });

  // GET /api/v1/circuits/:id — accepts a cuid or a slug.
  app.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const circuit = await app.prisma.circuit.findFirst({
      where: looksLikeCuid(id) ? { id } : { slug: id },
    });
    if (!circuit) throw AppError.notFound('Circuit not found');
    return { data: circuit };
  });
}
