import { FastifyInstance } from 'fastify';
import { DriverService } from '../services/driver.service';
import {
  driverEntriesQuerySchema,
  driverListQuerySchema,
  searchQuerySchema,
} from '../schemas/driver.schema';

export async function driverRoutes(app: FastifyInstance): Promise<void> {
  const service = new DriverService(app.prisma);

  // GET /drivers/search must be registered before /drivers/:id is matched.
  app.get('/search', async (request) => {
    const { q } = searchQuerySchema.parse(request.query);
    return { data: await service.search(q) };
  });

  app.get('/', async (request) => {
    const query = driverListQuerySchema.parse(request.query);
    return service.list(query);
  });

  app.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    return { data: await service.getByIdOrSlug(id) };
  });

  app.get('/:id/entries', async (request) => {
    const { id } = request.params as { id: string };
    const filter = driverEntriesQuerySchema.parse(request.query);
    return { data: await service.listEntries(id, filter) };
  });
}
