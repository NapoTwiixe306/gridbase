import { FastifyInstance } from 'fastify';
import { EntryService } from '../services/entry.service';
import { entryListQuerySchema } from '../schemas/entry.schema';

export async function entryRoutes(app: FastifyInstance): Promise<void> {
  const service = new EntryService(app.prisma);

  app.get('/', async (request) => {
    const query = entryListQuerySchema.parse(request.query);
    return service.list(query);
  });
}
