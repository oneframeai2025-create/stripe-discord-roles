import { Client, GatewayIntentBits } from 'discord.js';
import { analyzePost } from './openai';

let discordClient: Client | null = null;

const LABORATORIO_CHANNEL = 'laboratorio-de-ganchos';

export async function initDiscordBot(): Promise<void> {
  discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  discordClient.once('ready', () => {
    console.log(`Discord bot logged in as ${discordClient!.user!.tag}`);
  });

  // Analyze posts in #laboratorio-de-ganchos
  discordClient.on('messageCreate', async (message) => {
    // Ignore bot's own messages
    if (message.author.bot) return;

    // Only respond in #laboratorio-de-ganchos
    if (message.channel.type === 0 && message.channel.name !== LABORATORIO_CHANNEL) {
      return;
    }

    // Ignore very short messages (< 10 chars)
    if (message.content.length < 10) {
      return;
    }

    // Show typing indicator
    await message.channel.sendTyping();

    // Analyze the post
    const analysis = await analyzePost(message.content);

    // Reply with analysis
    await message.reply(analysis);
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
