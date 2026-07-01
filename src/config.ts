import 'dotenv/config';
import { z } from 'zod';

const configSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_VERSION: z.string().default('v1'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(3_600_000),
  // Bearer token guarding write endpoints (e.g. creating transfers). When unset,
  // those endpoints are disabled — the public API stays read-only by default.
  ADMIN_TOKEN: z.string().min(1).optional(),
  // Transfer cron: derives transfers from the grids on a schedule. Off by
  // default; set ENABLE_TRANSFER_CRON=true to activate.
  ENABLE_TRANSFER_CRON: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  TRANSFER_SYNC_CRON: z.string().default('0 */6 * * *'),
  // Allowed browser origins for CORS, comma-separated (e.g.
  // "https://pitwall.app,https://www.pitwall.app"). Unset = allow any origin
  // (convenient in development; lock it down in production).
  CORS_ORIGIN: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const parsed = configSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const config = loadConfig();
