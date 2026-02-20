import Stripe from 'stripe';
import { assignRole, removeRole } from './discord';
import { getRoleMapping } from '../utils/env';

export async function handleSubscriptionEvent(
  event: Stripe.Event
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const customer = await getCustomer(subscription.customer as string);

  if (!customer) {
    console.error('Customer not found');
    return;
  }

  // Get Discord user ID from customer metadata
  const discordUserId = customer.metadata?.discord_user_id;

  if (!discordUserId) {
    console.warn(
      `No Discord user ID found in customer metadata for ${customer.email}`
    );
    return;
  }

  // Get product ID from subscription
  const productId = subscription.items.data[0]?.price.product as string;

  if (!productId) {
    console.error('No product ID found in subscription');
    return;
  }

  // Get role ID from mapping
  const roleMapping = getRoleMapping();
  const roleId = roleMapping[productId];

  if (!roleId) {
    console.warn(`No role mapping found for product ${productId}`);
    return;
  }

  // Handle event
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      if (subscription.status === 'active') {
        await assignRole(discordUserId, roleId);
      } else {
        await removeRole(discordUserId, roleId);
      }
      break;

    case 'customer.subscription.deleted':
      await removeRole(discordUserId, roleId);
      break;
  }
}

async function getCustomer(
  customerId: string
): Promise<Stripe.Customer | null> {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-12-18.acacia',
    });
    return await stripe.customers.retrieve(customerId);
  } catch (err) {
    console.error(`Error fetching customer: ${err}`);
    return null;
  }
}
