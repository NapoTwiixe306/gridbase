import { FastifyInstance } from 'fastify';
import { EntryService } from '../services/entry.service';
import { transferListQuerySchema } from '../schemas/transfer.schema';

export async function transferRoutes(app: FastifyInstance): Promise<void> {
  const service = new EntryService(app.prisma);

  app.get('/latest', async () => {
    return { data: await service.latestTransfers() };
  });

  app.get('/', async (request) => {
    const query = transferListQuerySchema.parse(request.query);
    return service.listTransfers(query);
  });
}
