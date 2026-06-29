import Fastify, { FastifyInstance } from 'fastify';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import prismaPlugin from './plugins/prisma';
import rateLimitPlugin from './plugins/rateLimit';
import { registerErrorHandler } from './middleware/errorHandler';
import { registerRoutes } from './routes';

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

  await app.register(prismaPlugin);
  await app.register(rateLimitPlugin);

  const version = readVersion();
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version,
  }));

  await registerRoutes(app);

  return app;
}
