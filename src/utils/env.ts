export function validateEnv(): void {
  const required = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'DISCORD_BOT_TOKEN',
    'DISCORD_GUILD_ID',
  ];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

export function getRoleMapping(): Record<string, string> {
  const mapping = process.env.ROLE_MAPPING || '';
  if (!mapping) {
    return {};
  }

  const pairs = mapping.split(',');
  const result: Record<string, string> = {};

  for (const pair of pairs) {
    const [productId, roleId] = pair.split(':');
    if (productId && roleId) {
      result[productId.trim()] = roleId.trim();
    }
  }

  return result;
}
