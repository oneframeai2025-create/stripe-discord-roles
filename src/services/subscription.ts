import Stripe from 'stripe';
import { assignRoleByUsername, removeRoleByUsername } from './discord';
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

  // Get Discord username from customer metadata
  const discordUsername = customer.metadata?.discord_username;

  if (!discordUsername) {
    console.warn(
      `No Discord username found in customer metadata for ${customer.email}`
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

  console.log(`Processing subscription for Discord user: ${discordUsername}`);

  // Handle event
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      if (subscription.status === 'active') {
        await assignRoleByUsername(discordUsername, roleId);
      } else {
        await removeRoleByUsername(discordUsername, roleId);
      }
      break;

    case 'customer.subscription.deleted':
      await removeRoleByUsername(discordUsername, roleId);
      break;
  }
}

async function getCustomer(
  customerId: string
): Promise<Stripe.Customer | null> {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    });
    const customer = await stripe.customers.retrieve(customerId);
    // Ensure it's not a deleted customer
    if (customer.deleted) {
      return null;
    }
    return customer as Stripe.Customer;
  } catch (err) {
    console.error(`Error fetching customer: ${err}`);
    return null;
  }
}
