import { FastifyInstance } from 'fastify';
import { config } from '../config';
import { driverRoutes } from './drivers';
import { teamRoutes } from './teams';
import { manufacturerRoutes } from './manufacturers';
import { seriesRoutes } from './series';
import { seasonRoutes } from './seasons';
import { entryRoutes } from './entries';
import { transferRoutes } from './transfers';
import { searchRoutes } from './search';
import { categoryRoutes } from './categories';
import { circuitRoutes } from './circuits';
import { calendarRoutes } from './calendar';
import { statsRoutes } from './stats';

/** Registers every API route module under /api/{version}. */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  const prefix = `/api/${config.API_VERSION}`;

  await app.register(
    async (api) => {
      await api.register(driverRoutes, { prefix: '/drivers' });
      await api.register(teamRoutes, { prefix: '/teams' });
      await api.register(manufacturerRoutes, { prefix: '/manufacturers' });
      await api.register(seriesRoutes, { prefix: '/series' });
      await api.register(seasonRoutes, { prefix: '/seasons' });
      await api.register(categoryRoutes, { prefix: '/categories' });
      await api.register(circuitRoutes, { prefix: '/circuits' });
      await api.register(calendarRoutes, { prefix: '/calendar' });
      await api.register(statsRoutes, { prefix: '/stats' });
      await api.register(entryRoutes, { prefix: '/entries' });
      await api.register(transferRoutes, { prefix: '/transfers' });
      await api.register(searchRoutes, { prefix: '/search' });
    },
    { prefix },
  );
}
