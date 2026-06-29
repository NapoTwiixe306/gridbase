import rateLimit from '@fastify/rate-limit';
import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { config } from '../config';
import { ERROR_CODES } from '../types';

/**
 * Global rate limiting. Returns the standard GridBase error envelope with a
 * RATE_LIMITED code when a client exceeds the window allowance.
 */
async function rateLimitPlugin(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    errorResponseBuilder: (_request, context) => ({
      error: {
        code: ERROR_CODES.RATE_LIMITED,
        message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)}s.`,
        statusCode: 429,
      },
    }),
  });
}

export default fp(rateLimitPlugin, { name: 'rate-limit' });
