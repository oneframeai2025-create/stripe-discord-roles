import { FastifyPluginAsync } from 'fastify';
import Stripe from 'stripe';
import { handleSubscriptionEvent } from '../services/subscription';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export const stripeWebhook: FastifyPluginAsync = async (fastify) => {
  // Add rawBody plugin first
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body: Buffer, done) => {
      req.rawBody = body;
      try {
        const json = JSON.parse(body.toString());
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  fastify.post('/stripe', async (request, reply) => {
    const sig = request.headers['stripe-signature'] as string;

    if (!sig) {
      return reply.code(400).send({ error: 'Missing stripe-signature header' });
    }

    if (!request.rawBody) {
      return reply.code(400).send({ error: 'Missing request body' });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        request.rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      fastify.log.error(`Webhook signature verification failed: ${err}`);
      return reply.code(400).send({ error: 'Invalid signature' });
    }

    fastify.log.info(`Received event: ${event.type}`);

    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await handleSubscriptionEvent(event);
          break;
        default:
          fastify.log.info(`Unhandled event type: ${event.type}`);
      }

      return reply.send({ received: true });
    } catch (err) {
      fastify.log.error(`Error handling event: ${err}`);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
