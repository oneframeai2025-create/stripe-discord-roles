import Stripe from 'stripe';
import { assignRoleByUsername, removeRoleByUsername, sendAdminNotification } from './discord';
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
  // Try different possible keys where the username might be stored
  const discordUsername = 
    customer.metadata?.discord_username || 
    customer.metadata?.discord_user ||
    customer.metadata?.username ||
    customer.metadata?.Usuario_de_Discord ||
    customer.metadata?.usuario_de_discord;

  if (!discordUsername) {
    console.warn(
      `No Discord username found in customer metadata for ${customer.email}. Metadata:`,
      customer.metadata
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

  // Get role name for notification
  const roleName = Object.keys(roleMapping).find(key => roleMapping[key] === roleId) || 'Unknown';

  // Handle event
  switch (event.type) {
    case 'customer.subscription.created':
      if (subscription.status === 'active') {
        await assignRoleByUsername(discordUsername, roleId);
        await sendAdminNotification(
          `✅ **Nueva suscripción**\n` +
          `👤 Usuario: @${discordUsername}\n` +
          `📧 Email: ${customer.email}\n` +
          `🎫 Tier: ${roleName}\n` +
          `💰 Precio: ${formatPrice(subscription.items.data[0]?.price)}\n` +
          `📅 Estado: ${subscription.status}`
        );
      }
      break;

    case 'customer.subscription.updated':
      if (subscription.status === 'active') {
        await assignRoleByUsername(discordUsername, roleId);
        await sendAdminNotification(
          `🔄 **Suscripción actualizada**\n` +
          `👤 Usuario: @${discordUsername}\n` +
          `📧 Email: ${customer.email}\n` +
          `🎫 Tier: ${roleName}\n` +
          `📅 Estado: ${subscription.status}`
        );
      } else {
        await removeRoleByUsername(discordUsername, roleId);
        await sendAdminNotification(
          `⚠️ **Suscripción pausada/inactiva**\n` +
          `👤 Usuario: @${discordUsername}\n` +
          `📧 Email: ${customer.email}\n` +
          `📅 Estado: ${subscription.status}`
        );
      }
      break;

    case 'customer.subscription.deleted':
      await removeRoleByUsername(discordUsername, roleId);
      await sendAdminNotification(
        `❌ **Suscripción cancelada**\n` +
        `👤 Usuario: @${discordUsername}\n` +
        `📧 Email: ${customer.email}\n` +
        `🎫 Tier: ${roleName}`
      );
      break;
  }
}

function formatPrice(price?: Stripe.Price): string {
  if (!price) return 'N/A';
  const amount = price.unit_amount || 0;
  const currency = price.currency.toUpperCase();
  return `${(amount / 100).toFixed(2)} ${currency}`;
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
