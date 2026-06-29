import { FastifyInstance } from 'fastify';
import { SearchService } from '../services/search.service';
import { searchQuerySchema } from '../schemas/driver.schema';

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  const service = new SearchService(app.prisma);

  app.get('/', async (request) => {
    const { q } = searchQuerySchema.parse(request.query);
    return { data: await service.search(q) };
  });
}
