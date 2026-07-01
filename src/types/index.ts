// Shared TypeScript types and enums for GridBase API.

export const ERROR_CODES = {
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    statusCode: number;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Application error carrying an HTTP status code and a stable error code.
 * Thrown by services and translated by the global error handler.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, statusCode: number) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }

  static notFound(message: string): AppError {
    return new AppError(ERROR_CODES.NOT_FOUND, message, 404);
  }

  static validation(message: string): AppError {
    return new AppError(ERROR_CODES.VALIDATION_ERROR, message, 422);
  }

  static internal(message: string): AppError {
    return new AppError(ERROR_CODES.INTERNAL_ERROR, message, 500);
  }
}

/** Current calendar year, used to compute "current" entries/teams/series. */
export function currentYear(): number {
  return new Date().getFullYear();
}
