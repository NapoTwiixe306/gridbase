import { PrismaClient } from '@prisma/client';
import { TransferHub } from '../plugins/realtime';
import { refreshF1Grid } from './f1Grid';
import { syncTransfers, TransferSyncSummary } from './transferSync';

/** Minimal structural logger — satisfied by Fastify's `app.log` (pino). */
export interface JobLogger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

export interface PipelineDeps {
  prisma: PrismaClient;
  hub?: TransferHub;
  logger?: JobLogger;
}

/**
 * The full transfer pipeline: refresh the F1 grid from Jolpica (best-effort —
 * a Jolpica outage must never block the rest), then derive transfers from every
 * series' grid and push new/upgraded ones live.
 */
export async function runTransferPipeline(deps: PipelineDeps): Promise<TransferSyncSummary> {
  const { prisma, hub, logger } = deps;

  try {
    const grid = await refreshF1Grid(prisma);
    logger?.info({ grid }, 'transfer-cron: F1 grid refreshed');
  } catch (error) {
    logger?.warn({ err: error }, 'transfer-cron: F1 grid refresh failed (continuing)');
  }

  const summary = await syncTransfers(prisma, hub);
  logger?.info({ summary }, 'transfer-cron: transfers synced');
  return summary;
}
