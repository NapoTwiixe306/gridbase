import { FastifyInstance, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

/**
 * A minimal Server-Sent Events hub for pushing live transfers to connected
 * clients. SSE is a natural fit for a one-way broadcast feed: it runs over
 * plain HTTP, browsers reconnect automatically via `EventSource`, and it needs
 * no extra dependency. Clients subscribe on `GET /transfers/live`; the tracker
 * broadcasts a card whenever a transfer is created.
 */
export interface TransferHub {
  /** Register an SSE client; returns an unsubscribe function. */
  subscribe(reply: FastifyReply): () => void;
  /** Push a named event with a JSON payload to every connected client. */
  broadcast(event: string, data: unknown): void;
  /** Number of currently connected clients (useful for /health, tests). */
  clientCount(): number;
}

declare module 'fastify' {
  interface FastifyInstance {
    transferHub: TransferHub;
  }
}

const HEARTBEAT_MS = 25_000; // keep intermediaries from closing idle connections

async function realtimePlugin(app: FastifyInstance): Promise<void> {
  const clients = new Set<FastifyReply>();

  const heartbeat = setInterval(() => {
    for (const reply of clients) reply.raw.write(': ping\n\n');
  }, HEARTBEAT_MS);
  heartbeat.unref?.();

  const hub: TransferHub = {
    subscribe(reply) {
      clients.add(reply);
      const drop = (): void => {
        clients.delete(reply);
      };
      reply.raw.on('close', drop);
      return drop;
    },
    broadcast(event, data) {
      const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      for (const reply of clients) reply.raw.write(frame);
    },
    clientCount() {
      return clients.size;
    },
  };

  app.decorate('transferHub', hub);

  app.addHook('onClose', async () => {
    clearInterval(heartbeat);
    for (const reply of clients) reply.raw.end();
    clients.clear();
  });
}

export default fp(realtimePlugin, { name: 'realtime' });
