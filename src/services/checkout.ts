import Stripe from 'stripe';
import { assignRoleByUsername, removeRoleByUsername, sendAdminNotification } from './discord';
import { getRoleMapping } from '../utils/env';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function handleCheckoutCompleted(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;

  // Get customer
  const customerId = session.customer as string;
  if (!customerId) {
    console.error('No customer ID in checkout session');
    return;
  }

  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) {
    console.error('Customer was deleted');
    return;
  }

  // Get Discord username from custom fields
  let discordUsername: string | undefined;

  if (session.custom_fields && session.custom_fields.length > 0) {
    // Buscar en custom_fields (key = "usuariodediscord")
    const discordField = session.custom_fields.find(
      (field) => 
        field.key === 'usuariodediscord' ||
        field.key === 'discord_username' || 
        field.key.toLowerCase().includes('discord')
    );
    if (discordField && discordField.text && discordField.text.value) {
      discordUsername = discordField.text.value;
    }
  }

  // Si no está en custom_fields, buscar en metadata del customer
  if (!discordUsername && customer.metadata) {
    discordUsername =
      customer.metadata.discord_username ||
      customer.metadata.discord_user ||
      customer.metadata.username ||
      customer.metadata.Usuario_de_Discord ||
      customer.metadata.usuario_de_discord;
  }

  if (!discordUsername) {
    console.warn(
      `No Discord username found in checkout session or customer metadata for ${customer.email}`
    );
    return;
  }

  // Get line items to find the product
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });

  if (!lineItems.data.length) {
    console.error('No line items found in checkout session');
    return;
  }

  // Get first product
  const firstItem = lineItems.data[0];
  const priceId = firstItem.price?.id;
  
  if (!priceId) {
    console.error('No price ID found in line items');
    return;
  }

  // Get price to find product
  const price = await stripe.prices.retrieve(priceId);
  const productId = price.product as string;

  if (!productId) {
    console.error('No product ID found');
    return;
  }

  // Get product details to show name
  const product = await stripe.products.retrieve(productId);
  const productName = product.name || productId;

  // Get role ID from mapping
  const roleMapping = getRoleMapping();
  const roleId = roleMapping[productId];

  if (!roleId) {
    console.warn(`No role mapping found for product ${productId}`);
    return;
  }

  console.log(`Processing checkout for Discord user: ${discordUsername}, product: ${productName}`);

  // Save discord_username to customer metadata for future use
  await stripe.customers.update(customerId, {
    metadata: {
      discord_username: discordUsername,
    },
  });

  // Assign role
  await assignRoleByUsername(discordUsername, roleId);

  // Send notification
  await sendAdminNotification(
    `✅ **Nueva compra**\n` +
      `👤 Usuario: @${discordUsername}\n` +
      `📧 Email: ${customer.email}\n` +
      `🎫 Producto: ${productName}\n` +
      `💰 Total: ${(session.amount_total || 0) / 100} ${session.currency?.toUpperCase()}`
  );
}

export async function handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  
  // Get customer
  const customerId = subscription.customer as string;
  const customer = await stripe.customers.retrieve(customerId);
  
  if (customer.deleted) {
    console.error('Customer was deleted');
    return;
  }

  // Get Discord username from metadata
  const discordUsername =
    customer.metadata?.discord_username ||
    customer.metadata?.discord_user ||
    customer.metadata?.username;

  if (!discordUsername) {
    console.warn(`No Discord username found for customer ${customer.email}`);
    return;
  }

  // Get product from subscription
  const productId = subscription.items.data[0]?.price.product as string;
  
  if (!productId) {
    console.error('No product ID in subscription');
    return;
  }

  // Get product details
  const product = await stripe.products.retrieve(productId);
  const productName = product.name || productId;

  // Get role ID
  const roleMapping = getRoleMapping();
  const roleId = roleMapping[productId];

  if (!roleId) {
    console.warn(`No role mapping for product ${productId}`);
    return;
  }

  console.log(`Removing role for Discord user: ${discordUsername}, product: ${productName}`);

  // Remove role
  await removeRoleByUsername(discordUsername, roleId);

  // Notify
  await sendAdminNotification(
    `❌ **Suscripción cancelada**\n` +
      `👤 Usuario: @${discordUsername}\n` +
      `📧 Email: ${customer.email}\n` +
      `🎫 Producto: ${productName}`
  );
}

export async function handleCustomerDeleted(event: Stripe.Event): Promise<void> {
  const customer = event.data.object as Stripe.Customer;

  // Get Discord username from metadata
  const discordUsername =
    customer.metadata?.discord_username ||
    customer.metadata?.discord_user ||
    customer.metadata?.username;

  if (!discordUsername) {
    console.warn(`No Discord username found for deleted customer ${customer.email}`);
    return;
  }

  // Remove all roles (we don't know which one they had, so we try all)
  const roleMapping = getRoleMapping();
  const roleIds = Object.values(roleMapping);

  for (const roleId of roleIds) {
    try {
      await removeRoleByUsername(discordUsername, roleId);
    } catch (err) {
      // Ignore errors (user might not have this role)
      console.log(`User ${discordUsername} doesn't have role ${roleId}`);
    }
  }

  await sendAdminNotification(
    `❌ **Customer eliminado**\n` +
      `👤 Usuario: @${discordUsername}\n` +
      `📧 Email: ${customer.email}`
  );
}
