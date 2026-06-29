import { FastifyInstance } from 'fastify';
import { TeamService } from '../services/team.service';
import { teamListQuerySchema, teamTransfersQuerySchema } from '../schemas/team.schema';

export async function teamRoutes(app: FastifyInstance): Promise<void> {
  const service = new TeamService(app.prisma);

  app.get('/', async (request) => {
    const query = teamListQuerySchema.parse(request.query);
    return service.list(query);
  });

  app.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    return { data: await service.getByIdOrSlug(id) };
  });

  app.get('/:id/drivers', async (request) => {
    const { id } = request.params as { id: string };
    return { data: await service.listDrivers(id) };
  });

  app.get('/:id/transfers', async (request) => {
    const { id } = request.params as { id: string };
    const filter = teamTransfersQuerySchema.parse(request.query);
    return { data: await service.listTransfers(id, filter) };
  });
}
