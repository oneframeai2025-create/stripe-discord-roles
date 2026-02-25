import { Client, GatewayIntentBits } from 'discord.js';
import { analyzePost } from './openai';

let discordClient: Client | null = null;

const LABORATORIO_CHANNEL = 'laboratorio-de-ganchos';
const ADMINS_CHANNEL = 'chat-admins';

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
    try {
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

      console.log(`📝 Analyzing post from ${message.author.username}: "${message.content.substring(0, 50)}..."`);

      // Show typing indicator
      await message.channel.sendTyping();

      // Analyze the post
      const result = await analyzePost(message.content);

      // Prepare message 1
      let message1 = result.analysis;
      if (result.rewrite) {
        // Add "💡 REESCRITURA:" at the end if there's a rewrite
        message1 += '\n\n💡 REESCRITURA:\n';
      }

      // Send analysis (message 1)
      await message.reply(message1);
      
      // If there's a rewrite, send it as a separate message (message 2)
      if (result.rewrite) {
        await message.channel.send(result.rewrite);
      }
      
      console.log(`✅ Analysis sent to ${message.author.username}`);
    } catch (error) {
      console.error('Error handling message:', error);
      await message.reply('❌ Error al analizar el post. Verifica que las API keys de OpenAI estén configuradas.');
    }
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

export async function assignRoleByUsername(
  username: string,
  roleId: string
): Promise<void> {
  if (!discordClient) {
    throw new Error('Discord client not initialized');
  }

  // Clean username (remove @ if present)
  const cleanUsername = username.replace(/^@/, '').toLowerCase();

  const guild = await discordClient.guilds.fetch(process.env.DISCORD_GUILD_ID!);
  
  // Fetch all members to search by username
  const members = await guild.members.fetch();
  
  // Find member by username (case-insensitive)
  const member = members.find(
    (m) => m.user.username.toLowerCase() === cleanUsername
  );

  if (!member) {
    throw new Error(`Discord user not found: ${username}`);
  }

  const role = await guild.roles.fetch(roleId);

  if (!role) {
    throw new Error(`Role ${roleId} not found`);
  }

  await member.roles.add(role);
  console.log(`✅ Assigned role ${role.name} to user ${member.user.tag} (${member.user.username})`);
}

export async function removeRoleByUsername(
  username: string,
  roleId: string
): Promise<void> {
  if (!discordClient) {
    throw new Error('Discord client not initialized');
  }

  // Clean username (remove @ if present)
  const cleanUsername = username.replace(/^@/, '').toLowerCase();

  const guild = await discordClient.guilds.fetch(process.env.DISCORD_GUILD_ID!);
  
  // Fetch all members to search by username
  const members = await guild.members.fetch();
  
  // Find member by username (case-insensitive)
  const member = members.find(
    (m) => m.user.username.toLowerCase() === cleanUsername
  );

  if (!member) {
    throw new Error(`Discord user not found: ${username}`);
  }

  const role = await guild.roles.fetch(roleId);

  if (!role) {
    throw new Error(`Role ${roleId} not found`);
  }

  await member.roles.remove(role);
  console.log(`❌ Removed role ${role.name} from user ${member.user.tag} (${member.user.username})`);
}

export async function sendAdminNotification(message: string): Promise<void> {
  if (!discordClient) {
    throw new Error('Discord client not initialized');
  }

  try {
    console.log(`🔍 Attempting to send notification to #${ADMINS_CHANNEL}...`);
    
    const guild = await discordClient.guilds.fetch(process.env.DISCORD_GUILD_ID!);
    const channels = await guild.channels.fetch();
    
    console.log(`📋 Found ${channels.size} channels in guild`);
    
    // Log all text channels for debugging
    const textChannels = channels.filter((ch) => ch?.type === 0);
    console.log(`📝 Text channels: ${Array.from(textChannels.values()).map((ch) => ch?.name).join(', ')}`);
    
    const adminChannel = channels.find(
      (ch) => ch?.type === 0 && ch.name === ADMINS_CHANNEL
    );

    if (!adminChannel || adminChannel.type !== 0) {
      console.error(`❌ Admin channel #${ADMINS_CHANNEL} not found. Available text channels: ${Array.from(textChannels.values()).map((ch) => ch?.name).join(', ')}`);
      return;
    }

    console.log(`✅ Found admin channel: ${adminChannel.name} (ID: ${adminChannel.id})`);
    
    await adminChannel.send(message);
    console.log(`📢 Admin notification sent to #${ADMINS_CHANNEL}`);
  } catch (error) {
    console.error('❌ Error sending admin notification:', error);
  }
}
