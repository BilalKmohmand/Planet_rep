import { Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder, TextChannel, EmbedBuilder } from 'discord.js';
import { botEngine } from './botEngine';
import { db } from './db';

let discordClient: Client | null = null;
let isConnected = false;
let botUserTag = 'TrackerBot#0000';
let guildCount = 0;

export function getDiscordStatus() {
  return {
    isConnected,
    botTag: botUserTag,
    guildCount,
  };
}

export async function initDiscordBot(token?: string) {
  const botToken = token || process.env.DISCORD_BOT_TOKEN;
  if (!botToken || botToken.trim() === '') {
    console.log('[Discord Bot] No DISCORD_BOT_TOKEN provided. Running in high-fidelity Simulator mode.');
    return;
  }

  if (discordClient) {
    try {
      await discordClient.destroy();
    } catch (e) {
      console.warn('Error destroying existing Discord client:', e);
    }
  }

  try {
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    discordClient.once(Events.ClientReady, async (c) => {
      isConnected = true;
      botUserTag = c.user.tag;
      guildCount = c.guilds.cache.size;
      console.log(`[Discord Bot] Logged in as ${c.user.tag}! Monitoring ${guildCount} servers.`);

      // Sync active voice states currently in all guilds on startup (prevents missing members already in voice!)
      for (const guild of c.guilds.cache.values()) {
        for (const channel of guild.channels.cache.values()) {
          if (channel.isVoiceBased()) {
            await db.addChannel(channel.id, channel.name);
            for (const member of channel.members.values()) {
              const voiceState = member.voice;
              await botEngine.handleVoiceStateUpdate(
                {
                  userId: member.id,
                  username: member.user.username,
                  userTag: member.user.tag,
                  avatarUrl: member.user.displayAvatarURL(),
                  guildId: guild.id,
                  guildName: guild.name,
                  channelId: null,
                },
                {
                  userId: member.id,
                  username: member.user.username,
                  userTag: member.user.tag,
                  avatarUrl: member.user.displayAvatarURL(),
                  guildId: guild.id,
                  guildName: guild.name,
                  channelId: channel.id,
                  channelName: channel.name,
                  selfMute: !!voiceState.selfMute,
                  selfDeaf: !!voiceState.selfDeaf,
                  selfVideo: !!voiceState.selfVideo,
                  streaming: !!voiceState.streaming,
                }
              );
            }
          }
        }
      }
    });

    discordClient.on(Events.VoiceStateUpdate, async (oldState, newState) => {
      const member = newState.member || oldState.member;
      if (!member || member.user.bot) return;

      const userId = member.id;
      const username = member.user.username;
      const userTag = member.user.tag;
      const avatarUrl = member.user.displayAvatarURL();
      const guildId = (newState.guild || oldState.guild).id;
      const guildName = (newState.guild || oldState.guild).name;

      await botEngine.handleVoiceStateUpdate(
        {
          userId,
          username,
          userTag,
          avatarUrl,
          guildId,
          guildName,
          channelId: oldState.channelId,
          channelName: oldState.channel?.name,
          selfMute: !!oldState.selfMute,
          selfDeaf: !!oldState.selfDeaf,
          selfVideo: !!oldState.selfVideo,
          streaming: !!oldState.streaming,
        },
        {
          userId,
          username,
          userTag,
          avatarUrl,
          guildId,
          guildName,
          channelId: newState.channelId,
          channelName: newState.channel?.name,
          selfMute: !!newState.selfMute,
          selfDeaf: !!newState.selfDeaf,
          selfVideo: !!newState.selfVideo,
          streaming: !!newState.streaming,
        }
      );

      // Optional: Auto-announce streaming events to a log channel
      const logChannelId = process.env.DISCORD_LOG_CHANNEL_ID;
      if (logChannelId && !oldState.streaming && newState.streaming && newState.channel) {
        const targetChannel = newState.guild.channels.cache.get(logChannelId);
        if (targetChannel && targetChannel.isTextBased()) {
          targetChannel.send(`🔴 **${member.user.username}** started screen sharing in **#${newState.channel.name}**!`);
        }
      }
    });

    discordClient.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const { commandName } = interaction;

      if (commandName === 'stats') {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const timeframe = (interaction.options.getString('timeframe') as any) || 'all';
        const res = await botEngine.executeStatsCommand(targetUser.id, timeframe);
        const embed = res.embeds[0];
        
        const discordEmbed = new EmbedBuilder()
          .setTitle(embed.title || '')
          .setDescription(embed.description || '')
          .setColor(embed.color || 0x5865F2)
          .setTimestamp(new Date(embed.timestamp || Date.now()));

        if (embed.author) {
          discordEmbed.setAuthor({ name: embed.author.name, iconURL: embed.author.icon_url });
        }
        if (embed.footer) {
          discordEmbed.setFooter({ text: embed.footer.text });
        }
        if (embed.fields) {
          embed.fields.forEach(f => discordEmbed.addFields({ name: f.name, value: f.value, inline: f.inline }));
        }

        await interaction.reply({ embeds: [discordEmbed] });
      } else if (commandName === 'live') {
        const res = await botEngine.executeLiveCommand();
        const embed = res.embeds[0];
        const discordEmbed = new EmbedBuilder()
          .setTitle(embed.title || '')
          .setDescription(embed.description || '')
          .setColor(embed.color || 0x57F287)
          .setTimestamp(new Date());

        embed.fields?.forEach(f => discordEmbed.addFields({ name: f.name, value: f.value, inline: f.inline }));
        await interaction.reply({ embeds: [discordEmbed] });
      } else if (commandName === 'inactive') {
        const days = interaction.options.getInteger('days') || 7;
        const res = await botEngine.executeInactiveCommand(days);
        const embed = res.embeds[0];
        const discordEmbed = new EmbedBuilder()
          .setTitle(embed.title || '')
          .setDescription(embed.description || '')
          .setColor(embed.color || 0xFEE75C)
          .setTimestamp(new Date());

        embed.fields?.forEach(f => discordEmbed.addFields({ name: f.name, value: f.value, inline: f.inline }));
        await interaction.reply({ embeds: [discordEmbed] });
      } else if (commandName === 'leaderboard') {
        const type = (interaction.options.getString('type') as any) || 'stream';
        const timeframe = (interaction.options.getString('timeframe') as any) || 'weekly';
        const res = await botEngine.executeLeaderboardCommand(type, timeframe);
        const embed = res.embeds[0];
        const discordEmbed = new EmbedBuilder()
          .setTitle(embed.title || '')
          .setDescription(embed.description || '')
          .setColor(embed.color || 0xEB459E)
          .setTimestamp(new Date());

        embed.fields?.forEach(f => discordEmbed.addFields({ name: f.name, value: f.value, inline: f.inline }));
        await interaction.reply({ embeds: [discordEmbed] });
      }
    });

    await discordClient.login(botToken);
  } catch (error) {
    console.error('[Discord Bot] Connection error:', error);
    isConnected = false;
  }
}
