import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import cron, { ScheduledTask } from 'node-cron';
import { config } from '../config';
import { runTransferPipeline } from '../jobs';

/**
 * In-process scheduler for the transfer pipeline. Disabled unless
 * ENABLE_TRANSFER_CRON=true (and never runs under NODE_ENV=test), so the API is
 * inert by default. Schedule is a standard cron expression in TRANSFER_SYNC_CRON
 * (default every 6 hours). Runs are guarded so a slow run can't overlap itself.
 */
async function schedulerPlugin(app: FastifyInstance): Promise<void> {
  if (!config.ENABLE_TRANSFER_CRON || config.NODE_ENV === 'test') return;

  if (!cron.validate(config.TRANSFER_SYNC_CRON)) {
    app.log.error(`Invalid TRANSFER_SYNC_CRON: "${config.TRANSFER_SYNC_CRON}" — cron disabled`);
    return;
  }

  let running = false;
  const task: ScheduledTask = cron.schedule(config.TRANSFER_SYNC_CRON, async () => {
    if (running) {
      app.log.warn('transfer-cron: previous run still in progress, skipping tick');
      return;
    }
    running = true;
    try {
      await runTransferPipeline({ prisma: app.prisma, hub: app.transferHub, logger: app.log });
    } catch (error) {
      app.log.error({ err: error }, 'transfer-cron: run failed');
    } finally {
      running = false;
    }
  });

  app.log.info(`transfer-cron scheduled: "${config.TRANSFER_SYNC_CRON}"`);
  app.addHook('onClose', async () => {
    task.stop();
  });
}

export default fp(schedulerPlugin, { name: 'scheduler', dependencies: ['prisma', 'realtime'] });
