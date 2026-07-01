import { FastifyInstance, FastifyRequest } from 'fastify';
import { TransferService } from '../services/transfer.service';
import {
  transferListQuerySchema,
  transferInputSchema,
  mercatoQuerySchema,
  gridCompareQuerySchema,
} from '../schemas/transfer.schema';
import { config } from '../config';
import { AppError } from '../types';

export async function transferRoutes(app: FastifyInstance): Promise<void> {
  const service = new TransferService(app.prisma);

  // Landing strip — the most recent transfers as ready-to-render cards.
  app.get('/latest', async () => {
    return { data: await service.latest() };
  });

  // Live feed (SSE): each newly created transfer is pushed as a `transfer` event.
  app.get('/live', async (_request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    reply.raw.write('event: connected\ndata: {"ok":true}\n\n');
    app.transferHub.subscribe(reply);
    return reply; // keep the connection open; hub cleans up on close
  });

  // Main tracker feed — filterable by series/season/status/team/driver.
  app.get('/', async (request) => {
    const query = transferListQuerySchema.parse(request.query);
    return service.list(query);
  });

  // Create a transfer (admin only) and broadcast it live to SSE subscribers.
  app.post('/', async (request, reply) => {
    requireAdmin(request);
    const input = transferInputSchema.parse(request.body);
    const card = await service.create(input);
    app.transferHub.broadcast('transfer', card);
    return reply.code(201).send({ data: card });
  });

  // Mercato view grouped by team (arrivals / departures / net balance).
  app.get('/mercato', async (request) => {
    const query = mercatoQuerySchema.parse(request.query);
    return { data: await service.mercatoByTeam(query) };
  });

  // Grid comparator — season N vs season N+1 (joined / left / stayed).
  app.get('/compare', async (request) => {
    const query = gridCompareQuerySchema.parse(request.query);
    return { data: await service.compareGrids(query) };
  });

  // A single driver's team-change timeline (oldest first).
  app.get('/driver/:idOrSlug', async (request) => {
    const { idOrSlug } = request.params as { idOrSlug: string };
    return { data: await service.driverTimeline(idOrSlug) };
  });
}

/** Guard write endpoints behind the ADMIN_TOKEN bearer. Disabled when unset. */
function requireAdmin(request: FastifyRequest): void {
  if (!config.ADMIN_TOKEN) {
    throw new AppError('NOT_FOUND', 'Write endpoints are disabled', 404);
  }
  const header = request.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token !== config.ADMIN_TOKEN) {
    throw new AppError('VALIDATION_ERROR', 'Invalid or missing admin token', 401);
  }
}
