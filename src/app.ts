import Fastify, { FastifyInstance } from 'fastify';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import prismaPlugin from './plugins/prisma';
import rateLimitPlugin from './plugins/rateLimit';
import realtimePlugin from './plugins/realtime';
import schedulerPlugin from './plugins/scheduler';
import { registerErrorHandler } from './middleware/errorHandler';
import { registerRoutes } from './routes';
import { config } from './config';

interface PackageJson {
  version: string;
}

function readVersion(): string {
  try {
    const raw = readFileSync(join(__dirname, '..', 'package.json'), 'utf-8');
    return (JSON.parse(raw) as PackageJson).version;
  } catch {
    return '0.0.0';
  }
}

/**
 * Builds a fully configured Fastify instance without calling listen().
 * Used by both the server entrypoint and tests.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
    },
  });

  registerErrorHandler(app);

  // Allow the PitWall front-end (and any other browser client) to call the API.
  // Unset CORS_ORIGIN reflects the request origin (any); set it to lock down.
  await app.register(cors, {
    origin: config.CORS_ORIGIN ? config.CORS_ORIGIN.split(',').map((o) => o.trim()) : true,
  });

  const version = readVersion();

  // Interactive API docs at /docs (OpenAPI spec at /docs/json).
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'GridBase API',
        description: 'Open-source motorsport data REST API — drivers, teams, series, transfers.',
        version,
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(prismaPlugin);
  await app.register(rateLimitPlugin);
  await app.register(realtimePlugin);
  await app.register(schedulerPlugin);

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version,
  }));

  await registerRoutes(app);

  return app;
}
