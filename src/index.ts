import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { stripeWebhook } from './routes/stripe';
import { initDiscordBot } from './services/discord';
import { validateEnv } from './utils/env';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

async function start() {
  try {
    // Validate environment variables
    validateEnv();

    // Initialize Discord bot
    await initDiscordBot();

    // Register CORS
    await fastify.register(cors, {
      origin: true,
    });

    // Register routes
    await fastify.register(stripeWebhook, { prefix: '/webhook' });

    // Health check
    fastify.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Start server
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    fastify.log.info(`Server listening on ${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
