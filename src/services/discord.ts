import { Client, GatewayIntentBits } from 'discord.js';

let discordClient: Client | null = null;

export async function initDiscordBot(): Promise<void> {
  discordClient = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  });

  discordClient.once('ready', () => {
    console.log(`Discord bot logged in as ${discordClient!.user!.tag}`);
  });

  await discordClient.login(process.env.DISCORD_BOT_TOKEN);
}

export async function assignRole(
  userId: string,
  roleId: string
): Promise<void> {
  if (!discordClient) {
    throw new Error('Discord client not initialized');
  }

  const guild = await discordClient.guilds.fetch(process.env.DISCORD_GUILD_ID!);
  const member = await guild.members.fetch(userId);
  const role = await guild.roles.fetch(roleId);

  if (!role) {
    throw new Error(`Role ${roleId} not found`);
  }

  await member.roles.add(role);
  console.log(`Assigned role ${role.name} to user ${member.user.tag}`);
}

export async function removeRole(
  userId: string,
  roleId: string
): Promise<void> {
  if (!discordClient) {
    throw new Error('Discord client not initialized');
  }

  const guild = await discordClient.guilds.fetch(process.env.DISCORD_GUILD_ID!);
  const member = await guild.members.fetch(userId);
  const role = await guild.roles.fetch(roleId);

  if (!role) {
    throw new Error(`Role ${roleId} not found`);
  }

  await member.roles.remove(role);
  console.log(`Removed role ${role.name} from user ${member.user.tag}`);
}
