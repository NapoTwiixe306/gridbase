import { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ApiErrorBody, AppError, ERROR_CODES } from '../types';

function send(reply: FastifyReply, body: ApiErrorBody): void {
  void reply.status(body.error.statusCode).send(body);
}

/**
 * Global error handler producing the consistent GridBase API error envelope:
 * { error: { code, message, statusCode } }.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    send(reply, {
      error: {
        code: ERROR_CODES.NOT_FOUND,
        message: `Route ${request.method} ${request.url} not found`,
        statusCode: 404,
      },
    });
  });

  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof AppError) {
      send(reply, {
        error: { code: error.code, message: error.message, statusCode: error.statusCode },
      });
      return;
    }

    if (error instanceof ZodError) {
      const message = error.issues
        .map((issue) => `${issue.path.join('.') || 'value'}: ${issue.message}`)
        .join('; ');
      send(reply, {
        error: { code: ERROR_CODES.VALIDATION_ERROR, message, statusCode: 422 },
      });
      return;
    }

    // Fastify's own validation (rare here, we validate with Zod) or rate limit.
    if (error.statusCode === 429) {
      send(reply, {
        error: { code: ERROR_CODES.RATE_LIMITED, message: error.message, statusCode: 429 },
      });
      return;
    }

    request.log.error(error);
    send(reply, {
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'An unexpected error occurred',
        statusCode: 500,
      },
    });
  });
}
