export interface CodeFile {
  filename: string;
  language: string;
  category: 'node' | 'python' | 'sql' | 'docker' | 'docs';
  description: string;
  content: string;
}

export const BOT_SOURCE_CODE: CodeFile[] = [
  {
    filename: 'schema.sql',
    language: 'sql',
    category: 'sql',
    description: 'Relational database schema for SQLite / PostgreSQL with indexes and constraints',
    content: `-- Discord Voice, Video & Stream Tracker Schema
-- Compatible with SQLite 3 and PostgreSQL

CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(32) PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    user_tag VARCHAR(120),
    avatar_url TEXT,
    first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS voice_channels (
    channel_id VARCHAR(32) PRIMARY KEY,
    channel_name VARCHAR(100) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stores completed historical sessions
CREATE TABLE IF NOT EXISTS member_sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    channel_id VARCHAR(32) NOT NULL,
    channel_name VARCHAR(100) NOT NULL,
    activity_type VARCHAR(16) NOT NULL CHECK(activity_type IN ('voice', 'video', 'stream')),
    start_time BIGINT NOT NULL,       -- Unix timestamp in milliseconds
    end_time BIGINT NOT NULL,         -- Unix timestamp in milliseconds
    duration_seconds INTEGER NOT NULL, -- Cached duration in seconds
    stream_title TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Crash-recovery table: tracks in-progress sessions across restarts
CREATE TABLE IF NOT EXISTS active_sessions (
    user_id VARCHAR(32) PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    channel_id VARCHAR(32) NOT NULL,
    channel_name VARCHAR(100) NOT NULL,
    is_voice BOOLEAN DEFAULT 1,
    is_video BOOLEAN DEFAULT 0,
    is_streaming BOOLEAN DEFAULT 0,
    voice_start_time BIGINT NOT NULL,
    video_start_time BIGINT,
    stream_start_time BIGINT,
    stream_title TEXT,
    last_heartbeat BIGINT NOT NULL
);

-- High-performance indexes for fast slash commands & analytics
CREATE INDEX IF NOT EXISTS idx_sessions_user_start ON member_sessions(user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_guild_start ON member_sessions(guild_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_type ON member_sessions(activity_type);
CREATE INDEX IF NOT EXISTS idx_sessions_channel ON member_sessions(channel_id);
`
  },
  {
    filename: 'bot.ts',
    language: 'typescript',
    category: 'node',
    description: 'Complete Discord.js v14 Bot Engine with Voice State Updates & Slash Commands',
    content: `/**
 * Discord Voice, Video & Stream Tracker Bot (discord.js v14)
 * Tracks voice presence, video camera, and screen share sessions separately.
 */

import {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  VoiceState,
  ChatInputCommandInteraction
} from 'discord.js';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';

dotenv.config();

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID; // Optional: for instant guild command deployment
const LOG_CHANNEL_ID = process.env.DISCORD_LOG_CHANNEL_ID;

if (!TOKEN) {
  console.error('ERROR: DISCORD_BOT_TOKEN is required in .env');
  process.exit(1);
}

// 1. Initialize SQLite Database with WAL mode for high concurrency
const db = new Database('tracker.db');
db.pragma('journal_mode = WAL');

// Create tables if not exist
db.exec(\`
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    user_tag TEXT,
    avatar_url TEXT,
    last_seen_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS member_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    duration_seconds INTEGER NOT NULL,
    stream_title TEXT
  );

  CREATE TABLE IF NOT EXISTS active_sessions (
    user_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    is_voice INTEGER DEFAULT 1,
    is_video INTEGER DEFAULT 0,
    is_streaming INTEGER DEFAULT 0,
    voice_start_time INTEGER NOT NULL,
    video_start_time INTEGER,
    stream_start_time INTEGER,
    stream_title TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_sess_user ON member_sessions(user_id, start_time DESC);
  CREATE INDEX IF NOT EXISTS idx_sess_type ON member_sessions(activity_type);
\`);

// Helper: Format seconds to readable string
function formatDuration(sec: number): string {
  if (sec < 60) return \`\${Math.round(sec)}s\`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0 ? \`\${h}h \${m}m \${s}s\` : \`\${m}m \${s}s\`;
}

// 2. Initialize Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

// Prepared statements for maximum performance
const insertUser = db.prepare(\`
  INSERT INTO users (user_id, username, user_tag, avatar_url, last_seen_at)
  VALUES (@user_id, @username, @user_tag, @avatar_url, @last_seen_at)
  ON CONFLICT(user_id) DO UPDATE SET
    username=excluded.username,
    user_tag=excluded.user_tag,
    avatar_url=excluded.avatar_url,
    last_seen_at=excluded.last_seen_at
\`);

const insertSession = db.prepare(\`
  INSERT INTO member_sessions (id, user_id, guild_id, channel_id, channel_name, activity_type, start_time, end_time, duration_seconds, stream_title)
  VALUES (@id, @user_id, @guild_id, @channel_id, @channel_name, @activity_type, @start_time, @end_time, @duration_seconds, @stream_title)
\`);

const getActiveState = db.prepare('SELECT * FROM active_sessions WHERE user_id = ?');
const upsertActiveState = db.prepare(\`
  INSERT INTO active_sessions (user_id, guild_id, channel_id, channel_name, is_voice, is_video, is_streaming, voice_start_time, video_start_time, stream_start_time, stream_title)
  VALUES (@user_id, @guild_id, @channel_id, @channel_name, @is_voice, @is_video, @is_streaming, @voice_start_time, @video_start_time, @stream_start_time, @stream_title)
  ON CONFLICT(user_id) DO UPDATE SET
    channel_id=excluded.channel_id,
    channel_name=excluded.channel_name,
    is_voice=excluded.is_voice,
    is_video=excluded.is_video,
    is_streaming=excluded.is_streaming,
    voice_start_time=excluded.voice_start_time,
    video_start_time=excluded.video_start_time,
    stream_start_time=excluded.stream_start_time,
    stream_title=excluded.stream_title
\`);
const deleteActiveState = db.prepare('DELETE FROM active_sessions WHERE user_id = ?');

// Handle voiceStateUpdate event
client.on(Events.VoiceStateUpdate, (oldState: VoiceState, newState: VoiceState) => {
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  const now = Date.now();
  const userId = member.id;
  const username = member.user.username;
  const userTag = member.user.tag;
  const avatarUrl = member.user.displayAvatarURL();
  const guildId = (newState.guild || oldState.guild).id;

  insertUser.run({
    user_id: userId,
    username,
    user_tag: userTag,
    avatar_url: avatarUrl,
    last_seen_at: now
  });

  const active = getActiveState.get(userId) as any;

  // 1. User Disconnected
  if (oldState.channelId && !newState.channelId) {
    if (active) {
      if (active.voice_start_time) {
        const dur = Math.max(1, Math.floor((now - active.voice_start_time) / 1000));
        insertSession.run({
          id: \`\${userId}-v-\${now}\`,
          user_id: userId,
          guild_id: guildId,
          channel_id: active.channel_id,
          channel_name: active.channel_name,
          activity_type: 'voice',
          start_time: active.voice_start_time,
          end_time: now,
          duration_seconds: dur,
          stream_title: null
        });
      }
      if (active.is_video && active.video_start_time) {
        const dur = Math.max(1, Math.floor((now - active.video_start_time) / 1000));
        insertSession.run({
          id: \`\${userId}-vid-\${now}\`,
          user_id: userId,
          guild_id: guildId,
          channel_id: active.channel_id,
          channel_name: active.channel_name,
          activity_type: 'video',
          start_time: active.video_start_time,
          end_time: now,
          duration_seconds: dur,
          stream_title: null
        });
      }
      if (active.is_streaming && active.stream_start_time) {
        const dur = Math.max(1, Math.floor((now - active.stream_start_time) / 1000));
        insertSession.run({
          id: \`\${userId}-str-\${now}\`,
          user_id: userId,
          guild_id: guildId,
          channel_id: active.channel_id,
          channel_name: active.channel_name,
          activity_type: 'stream',
          start_time: active.stream_start_time,
          end_time: now,
          duration_seconds: dur,
          stream_title: active.stream_title
        });
      }
      deleteActiveState.run(userId);
    }
    return;
  }

  // 2. User Joined Fresh Channel
  if (!oldState.channelId && newState.channelId && newState.channel) {
    const isVideo = newState.selfVideo ? 1 : 0;
    const isStream = newState.streaming ? 1 : 0;
    upsertActiveState.run({
      user_id: userId,
      guild_id: guildId,
      channel_id: newState.channelId,
      channel_name: newState.channel.name,
      is_voice: 1,
      is_video: isVideo,
      is_streaming: isStream,
      voice_start_time: now,
      video_start_time: isVideo ? now : null,
      stream_start_time: isStream ? now : null,
      stream_title: null
    });
    return;
  }

  // 3. User Switched Channels
  if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId && newState.channel) {
    if (active) {
      if (active.voice_start_time) {
        insertSession.run({
          id: \`\${userId}-v-\${now}\`,
          user_id: userId,
          guild_id: guildId,
          channel_id: active.channel_id,
          channel_name: active.channel_name,
          activity_type: 'voice',
          start_time: active.voice_start_time,
          end_time: now,
          duration_seconds: Math.max(1, Math.floor((now - active.voice_start_time) / 1000)),
          stream_title: null
        });
      }
    }
    upsertActiveState.run({
      user_id: userId,
      guild_id: guildId,
      channel_id: newState.channelId,
      channel_name: newState.channel.name,
      is_voice: 1,
      is_video: newState.selfVideo ? 1 : 0,
      is_streaming: newState.streaming ? 1 : 0,
      voice_start_time: now,
      video_start_time: newState.selfVideo ? now : null,
      stream_start_time: newState.streaming ? now : null,
      stream_title: null
    });
    return;
  }

  // 4. In-Channel Camera / Streaming toggles
  if (active && oldState.channelId === newState.channelId && newState.channel) {
    const oldVid = !!oldState.selfVideo;
    const newVid = !!newState.selfVideo;
    const oldStr = !!oldState.streaming;
    const newStr = !!newState.streaming;

    let updatedVidTime = active.video_start_time;
    let updatedStrTime = active.stream_start_time;

    // Camera turned ON
    if (!oldVid && newVid) updatedVidTime = now;
    // Camera turned OFF
    if (oldVid && !newVid && active.video_start_time) {
      insertSession.run({
        id: \`\${userId}-vid-\${now}\`,
        user_id: userId,
        guild_id: guildId,
        channel_id: active.channel_id,
        channel_name: active.channel_name,
        activity_type: 'video',
        start_time: active.video_start_time,
        end_time: now,
        duration_seconds: Math.max(1, Math.floor((now - active.video_start_time) / 1000)),
        stream_title: null
      });
      updatedVidTime = null;
    }

    // Screen Share started
    if (!oldStr && newStr) {
      updatedStrTime = now;
      if (LOG_CHANNEL_ID) {
        const logChan = newState.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChan && logChan.isTextBased()) {
          logChan.send(\`🔴 **\${username}** started streaming screen in **#\${newState.channel.name}**!\`);
        }
      }
    }
    // Screen Share stopped
    if (oldStr && !newStr && active.stream_start_time) {
      insertSession.run({
        id: \`\${userId}-str-\${now}\`,
        user_id: userId,
        guild_id: guildId,
        channel_id: active.channel_id,
        channel_name: active.channel_name,
        activity_type: 'stream',
        start_time: active.stream_start_time,
        end_time: now,
        duration_seconds: Math.max(1, Math.floor((now - active.stream_start_time) / 1000)),
        stream_title: active.stream_title
      });
      updatedStrTime = null;
    }

    upsertActiveState.run({
      user_id: userId,
      guild_id: guildId,
      channel_id: active.channel_id,
      channel_name: active.channel_name,
      is_voice: 1,
      is_video: newVid ? 1 : 0,
      is_streaming: newStr ? 1 : 0,
      voice_start_time: active.voice_start_time,
      video_start_time: updatedVidTime,
      stream_start_time: updatedStrTime,
      stream_title: active.stream_title
    });
  }
});

// 3. Register Slash Commands
const commands = [
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View voice, video call, and streaming activity stats for a member')
    .addUserOption(opt => opt.setName('user').setDescription('Target user (defaults to you)').setRequired(false))
    .addStringOption(opt =>
      opt.setName('timeframe')
        .setDescription('Time period window')
        .setRequired(false)
        .addChoices(
          { name: 'All Time', value: 'all' },
          { name: 'Today (24h)', value: 'daily' },
          { name: 'This Week (7d)', value: 'weekly' },
          { name: 'This Month (30d)', value: 'monthly' }
        )
    ),
  new SlashCommandBuilder()
    .setName('live')
    .setDescription('List all members currently active in voice, on video, or streaming'),
  new SlashCommandBuilder()
    .setName('inactive')
    .setDescription('Audit members who have not joined voice/video in the last X days')
    .addIntegerOption(opt => opt.setName('days').setDescription('Days threshold (default: 7)').setRequired(false)),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the top voice/streamers in the server')
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Activity category')
        .setRequired(false)
        .addChoices(
          { name: 'Streaming / Screen Share', value: 'stream' },
          { name: 'Video Calls', value: 'video' },
          { name: 'Voice Time', value: 'voice' },
          { name: 'Combined Total', value: 'all' }
        )
    )
    .addStringOption(opt =>
      opt.setName('timeframe')
        .setDescription('Timeframe')
        .setRequired(false)
        .addChoices(
          { name: 'This Week', value: 'weekly' },
          { name: 'This Month', value: 'monthly' },
          { name: 'All Time', value: 'all' }
        )
    ),
];

// Register commands on Discord
async function registerCommands() {
  if (!CLIENT_ID || !TOKEN) return;
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('Registering slash commands with Discord...');
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log(\`Slash commands registered instantly for guild \${GUILD_ID}!\`);
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log('Global slash commands registered!');
    }
  } catch (err) {
    console.error('Error registering slash commands:', err);
  }
}

// 4. Handle Slash Command Interactions
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // /stats
  if (commandName === 'stats') {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const timeframe = interaction.options.getString('timeframe') || 'all';

    let minTime = 0;
    const now = Date.now();
    if (timeframe === 'daily') minTime = now - 86400000;
    if (timeframe === 'weekly') minTime = now - 7 * 86400000;
    if (timeframe === 'monthly') minTime = now - 30 * 86400000;

    const stats = db.prepare(\`
      SELECT 
        SUM(CASE WHEN activity_type = 'voice' THEN duration_seconds ELSE 0 END) as total_voice,
        SUM(CASE WHEN activity_type = 'video' THEN duration_seconds ELSE 0 END) as total_video,
        SUM(CASE WHEN activity_type = 'stream' THEN duration_seconds ELSE 0 END) as total_stream,
        COUNT(*) as session_count
      FROM member_sessions
      WHERE user_id = ? AND start_time >= ?
    \`).get(targetUser.id, minTime) as any;

    const voiceSec = stats?.total_voice || 0;
    const videoSec = stats?.total_video || 0;
    const streamSec = stats?.total_stream || 0;
    const totalSec = voiceSec + videoSec + streamSec;

    const embed = new EmbedBuilder()
      .setTitle(\`📊 Activity Stats for \${targetUser.username}\`)
      .setColor(0x5865F2)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: '🔊 Voice Time', value: \`**\${formatDuration(voiceSec)}**\`, inline: true },
        { name: '📹 Video Call Time', value: \`**\${formatDuration(videoSec)}**\`, inline: true },
        { name: '🔴 Screen Share / Stream', value: \`**\${formatDuration(streamSec)}**\`, inline: true },
        { name: '📈 Total Tracked Time', value: \`**\${formatDuration(totalSec)}** (\${stats?.session_count || 0} sessions)\`, inline: false }
      )
      .setFooter({ text: 'Discord Voice & Stream Tracker' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // /live
  if (commandName === 'live') {
    const active = db.prepare('SELECT * FROM active_sessions').all() as any[];
    const now = Date.now();

    const streams = active.filter(a => a.is_streaming).map(a => \`• <@\${a.user_id}> in \\#\${a.channel_name} (⏱️ \${formatDuration((now - a.stream_start_time)/1000)})\`).join('\\n') || '*None*';
    const videos = active.filter(a => a.is_video).map(a => \`• <@\${a.user_id}> in \\#\${a.channel_name} (⏱️ \${formatDuration((now - a.video_start_time)/1000)})\`).join('\\n') || '*None*';
    const voice = active.filter(a => !a.is_video && !a.is_streaming).map(a => \`• <@\${a.user_id}> in \\#\${a.channel_name} (⏱️ \${formatDuration((now - a.voice_start_time)/1000)})\`).join('\\n') || '*None*';

    const embed = new EmbedBuilder()
      .setTitle(\`🔴 Currently Active Voice Members (\${active.length})\`)
      .setColor(0x57F287)
      .addFields(
        { name: '🔴 Streaming / Screen Share', value: streams, inline: false },
        { name: '📹 On Video Camera', value: videos, inline: false },
        { name: '🔊 Voice Only', value: voice, inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // /inactive
  if (commandName === 'inactive') {
    const days = interaction.options.getInteger('days') || 7;
    const thresholdMs = Date.now() - days * 86400000;

    const inactives = db.prepare(\`
      SELECT u.user_id, u.username, u.last_seen_at
      FROM users u
      LEFT JOIN active_sessions a ON u.user_id = a.user_id
      WHERE a.user_id IS NULL AND (u.last_seen_at < ? OR u.last_seen_at IS NULL)
      LIMIT 20
    \`).all(thresholdMs) as any[];

    const list = inactives.map(i => {
      const daysAgo = i.last_seen_at ? Math.floor((Date.now() - i.last_seen_at) / 86400000) : 'Never';
      return \`• **\${i.username}** (<@\${i.user_id}>) — Last active: \${daysAgo}d ago\`;
    }).join('\\n') || '🎉 No inactive members found!';

    const embed = new EmbedBuilder()
      .setTitle(\`💤 Inactive Members (\${days}+ Days)\`)
      .setDescription(list)
      .setColor(0xFEE75C)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // /leaderboard
  if (commandName === 'leaderboard') {
    const type = interaction.options.getString('type') || 'stream';
    const timeframe = interaction.options.getString('timeframe') || 'weekly';

    let minTime = 0;
    const now = Date.now();
    if (timeframe === 'weekly') minTime = now - 7 * 86400000;
    if (timeframe === 'monthly') minTime = now - 30 * 86400000;

    let filterSql = "WHERE start_time >= ?";
    if (type !== 'all') {
      filterSql += \` AND activity_type = '\${type}'\`;
    }

    const rows = db.prepare(\`
      SELECT user_id, SUM(duration_seconds) as total_sec, COUNT(*) as count
      FROM member_sessions
      \${filterSql}
      GROUP BY user_id
      ORDER BY total_sec DESC
      LIMIT 10
    \`).all(minTime) as any[];

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const lines = rows.map((r, i) => \`\${medals[i] || '#' + (i + 1)} <@\${r.user_id}> — **\${formatDuration(r.total_sec)}** (\${r.count} sessions)\`).join('\\n') || '*No records for this timeframe.*';

    const embed = new EmbedBuilder()
      .setTitle(\`🏆 \${type.toUpperCase()} Leaderboard (\${timeframe})\`)
      .setDescription(lines)
      .setColor(0xEB459E)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
});

client.once(Events.ClientReady, async () => {
  console.log(\`Bot is online as \${client.user?.tag}!\`);
  await registerCommands();
});

client.login(TOKEN);
`
  },
  {
    filename: 'bot.py',
    language: 'python',
    category: 'python',
    description: 'Complete Python Discord Bot (discord.py 2.x) with on_voice_state_update, SQLite & slash commands',
    content: `"""
Discord Voice, Video & Stream Tracker Bot (discord.py 2.x)
Monitors real-time voice, camera, and Go Live streaming activity.
"""

import os
import time
import sqlite3
import discord
from discord import app_commands
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("DISCORD_BOT_TOKEN")
LOG_CHANNEL_ID = os.getenv("DISCORD_LOG_CHANNEL_ID")

# 1. Setup SQLite Database
conn = sqlite3.connect("tracker.db", check_same_thread=False)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.executescript("""
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    user_tag TEXT,
    avatar_url TEXT,
    last_seen_at INTEGER
);

CREATE TABLE IF NOT EXISTS member_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    duration_seconds INTEGER NOT NULL,
    stream_title TEXT
);

CREATE TABLE IF NOT EXISTS active_sessions (
    user_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    is_voice INTEGER DEFAULT 1,
    is_video INTEGER DEFAULT 0,
    is_streaming INTEGER DEFAULT 0,
    voice_start_time INTEGER NOT NULL,
    video_start_time INTEGER,
    stream_start_time INTEGER,
    stream_title TEXT
);

CREATE INDEX IF NOT EXISTS idx_py_sess_user ON member_sessions(user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_py_sess_type ON member_sessions(activity_type);
""")
conn.commit()

def format_duration(seconds: int) -> str:
    if seconds < 60:
        return f"{seconds}s"
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    return f"{h}h {m}m {s}s" if h > 0 else f"{m}m {s}s"

# 2. Discord Bot Setup
intents = discord.Intents.default()
intents.voice_states = True
intents.members = True
intents.guilds = True

bot = commands.Bot(command_prefix="!", intents=intents)

@bot.event
async def on_ready():
    print(f"Logged in as {bot.user} (ID: {bot.user.id})")
    try:
        synced = await bot.tree.sync()
        print(f"Synced {len(synced)} application slash commands.")
    except Exception as e:
        print(f"Failed to sync slash commands: {e}")

# 3. Real-time Voice State Event Listener
@bot.event
async def on_voice_state_update(member: discord.Member, before: discord.VoiceState, after: discord.VoiceState):
    if member.bot:
        return

    now_ms = int(time.time() * 1000)
    user_id = str(member.id)
    username = member.name
    user_tag = f"{member.name}#{member.discriminator}"
    avatar_url = member.display_avatar.url if member.display_avatar else ""
    guild = after.guild if after.guild else before.guild
    guild_id = str(guild.id) if guild else "default_guild"

    # Upsert user record
    cursor.execute("""
        INSERT INTO users (user_id, username, user_tag, avatar_url, last_seen_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            username=excluded.username,
            user_tag=excluded.user_tag,
            avatar_url=excluded.avatar_url,
            last_seen_at=excluded.last_seen_at
    """, (user_id, username, user_tag, avatar_url, now_ms))
    conn.commit()

    cursor.execute("SELECT * FROM active_sessions WHERE user_id = ?", (user_id,))
    active = cursor.fetchone()

    # Case 1: Member Disconnected from Voice
    if before.channel and not after.channel:
        if active:
            if active["voice_start_time"]:
                dur = max(1, (now_ms - active["voice_start_time"]) // 1000)
                cursor.execute("""
                    INSERT INTO member_sessions (id, user_id, guild_id, channel_id, channel_name, activity_type, start_time, end_time, duration_seconds)
                    VALUES (?, ?, ?, ?, ?, 'voice', ?, ?, ?)
                """, (f"{user_id}-v-{now_ms}", user_id, guild_id, active["channel_id"], active["channel_name"], active["voice_start_time"], now_ms, dur))

            if active["is_video"] and active["video_start_time"]:
                dur = max(1, (now_ms - active["video_start_time"]) // 1000)
                cursor.execute("""
                    INSERT INTO member_sessions (id, user_id, guild_id, channel_id, channel_name, activity_type, start_time, end_time, duration_seconds)
                    VALUES (?, ?, ?, ?, ?, 'video', ?, ?, ?)
                """, (f"{user_id}-vid-{now_ms}", user_id, guild_id, active["channel_id"], active["channel_name"], active["video_start_time"], now_ms, dur))

            if active["is_streaming"] and active["stream_start_time"]:
                dur = max(1, (now_ms - active["stream_start_time"]) // 1000)
                cursor.execute("""
                    INSERT INTO member_sessions (id, user_id, guild_id, channel_id, channel_name, activity_type, start_time, end_time, duration_seconds)
                    VALUES (?, ?, ?, ?, ?, 'stream', ?, ?, ?)
                """, (f"{user_id}-str-{now_ms}", user_id, guild_id, active["channel_id"], active["channel_name"], active["stream_start_time"], now_ms, dur))

            cursor.execute("DELETE FROM active_sessions WHERE user_id = ?", (user_id,))
            conn.commit()
        return

    # Case 2: Member Joined Voice Channel
    if not before.channel and after.channel:
        is_video = 1 if after.self_video else 0
        is_stream = 1 if after.self_stream else 0
        cursor.execute("""
            INSERT OR REPLACE INTO active_sessions
            (user_id, guild_id, channel_id, channel_name, is_voice, is_video, is_streaming, voice_start_time, video_start_time, stream_start_time)
            VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
        """, (
            user_id, guild_id, str(after.channel.id), after.channel.name,
            is_video, is_stream, now_ms,
            now_ms if is_video else None,
            now_ms if is_stream else None
        ))
        conn.commit()
        return

    # Case 3: Member Switched Voice Channels
    if before.channel and after.channel and before.channel.id != after.channel.id:
        if active and active["voice_start_time"]:
            dur = max(1, (now_ms - active["voice_start_time"]) // 1000)
            cursor.execute("""
                INSERT INTO member_sessions (id, user_id, guild_id, channel_id, channel_name, activity_type, start_time, end_time, duration_seconds)
                VALUES (?, ?, ?, ?, ?, 'voice', ?, ?, ?)
            """, (f"{user_id}-v-{now_ms}", user_id, guild_id, active["channel_id"], active["channel_name"], active["voice_start_time"], now_ms, dur))

        is_video = 1 if after.self_video else 0
        is_stream = 1 if after.self_stream else 0
        cursor.execute("""
            INSERT OR REPLACE INTO active_sessions
            (user_id, guild_id, channel_id, channel_name, is_voice, is_video, is_streaming, voice_start_time, video_start_time, stream_start_time)
            VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
        """, (
            user_id, guild_id, str(after.channel.id), after.channel.name,
            is_video, is_stream, now_ms,
            now_ms if is_video else None,
            now_ms if is_stream else None
        ))
        conn.commit()
        return

    # Case 4: Camera or Stream State Toggled in Same Channel
    if active and before.channel and after.channel and before.channel.id == after.channel.id:
        old_vid = bool(before.self_video)
        new_vid = bool(after.self_video)
        old_str = bool(before.self_stream)
        new_str = bool(after.self_stream)

        vid_start = active["video_start_time"]
        str_start = active["stream_start_time"]

        if not old_vid and new_vid:
            vid_start = now_ms
        elif old_vid and not new_vid and active["video_start_time"]:
            dur = max(1, (now_ms - active["video_start_time"]) // 1000)
            cursor.execute("""
                INSERT INTO member_sessions (id, user_id, guild_id, channel_id, channel_name, activity_type, start_time, end_time, duration_seconds)
                VALUES (?, ?, ?, ?, ?, 'video', ?, ?, ?)
            """, (f"{user_id}-vid-{now_ms}", user_id, guild_id, active["channel_id"], active["channel_name"], active["video_start_time"], now_ms, dur))
            vid_start = None

        if not old_str and new_str:
            str_start = now_ms
            if LOG_CHANNEL_ID:
                log_chan = guild.get_channel(int(LOG_CHANNEL_ID))
                if log_chan:
                    await log_chan.send(f"🔴 **{member.display_name}** started streaming screen in **#{after.channel.name}**!")
        elif old_str and not new_str and active["stream_start_time"]:
            dur = max(1, (now_ms - active["stream_start_time"]) // 1000)
            cursor.execute("""
                INSERT INTO member_sessions (id, user_id, guild_id, channel_id, channel_name, activity_type, start_time, end_time, duration_seconds)
                VALUES (?, ?, ?, ?, ?, 'stream', ?, ?, ?)
            """, (f"{user_id}-str-{now_ms}", user_id, guild_id, active["channel_id"], active["channel_name"], active["stream_start_time"], now_ms, dur))
            str_start = None

        cursor.execute("""
            UPDATE active_sessions
            SET is_video = ?, is_streaming = ?, video_start_time = ?, stream_start_time = ?
            WHERE user_id = ?
        """, (1 if new_vid else 0, 1 if new_str else 0, vid_start, str_start, user_id))
        conn.commit()

# 4. Slash Commands

@bot.tree.command(name="stats", description="View voice, video call, and streaming activity stats")
@app_commands.describe(user="The member to inspect (default: you)", timeframe="Period: all, daily, weekly, monthly")
async def stats_command(interaction: discord.Interaction, user: discord.Member = None, timeframe: str = "all"):
    target = user or interaction.user
    now_ms = int(time.time() * 1000)

    min_time = 0
    if timeframe == "daily":
        min_time = now_ms - 86400000
    elif timeframe == "weekly":
        min_time = now_ms - 7 * 86400000
    elif timeframe == "monthly":
        min_time = now_ms - 30 * 86400000

    cursor.execute("""
        SELECT 
            SUM(CASE WHEN activity_type = 'voice' THEN duration_seconds ELSE 0 END) as total_voice,
            SUM(CASE WHEN activity_type = 'video' THEN duration_seconds ELSE 0 END) as total_video,
            SUM(CASE WHEN activity_type = 'stream' THEN duration_seconds ELSE 0 END) as total_stream,
            COUNT(*) as session_count
        FROM member_sessions
        WHERE user_id = ? AND start_time >= ?
    """, (str(target.id), min_time))
    row = cursor.fetchone()

    voice_sec = row["total_voice"] or 0
    video_sec = row["total_video"] or 0
    stream_sec = row["total_stream"] or 0
    total_sec = voice_sec + video_sec + stream_sec

    embed = discord.Embed(
        title=f"📊 Activity Stats for {target.display_name}",
        description=f"Detailed activity report for **{timeframe.capitalize()}** timeframe.",
        color=0x5865F2
    )
    if target.display_avatar:
        embed.set_thumbnail(url=target.display_avatar.url)

    embed.add_field(name="🔊 Voice Time", value=f"**{format_duration(voice_sec)}**", inline=True)
    embed.add_field(name="📹 Video Call Time", value=f"**{format_duration(video_sec)}**", inline=True)
    embed.add_field(name="🔴 Screen Share / Stream", value=f"**{format_duration(stream_sec)}**", inline=True)
    embed.add_field(name="📈 Combined Total", value=f"**{format_duration(total_sec)}** across {row['session_count']} sessions", inline=False)
    embed.set_footer(text="Discord Voice & Stream Tracker")

    await interaction.response.send_message(embed=embed)

@bot.tree.command(name="live", description="List all members currently active in voice, video, or stream")
async def live_command(interaction: discord.Interaction):
    cursor.execute("SELECT * FROM active_sessions")
    active_rows = cursor.fetchall()
    now_ms = int(time.time() * 1000)

    streams = [f"• <@{r['user_id']}> in #{r['channel_name']} (⏱️ {format_duration((now_ms - r['stream_start_time'])//1000)})" for r in active_rows if r["is_streaming"]]
    videos = [f"• <@{r['user_id']}> in #{r['channel_name']} (⏱️ {format_duration((now_ms - r['video_start_time'])//1000)})" for r in active_rows if r["is_video"]]
    voice = [f"• <@{r['user_id']}> in #{r['channel_name']} (⏱️ {format_duration((now_ms - r['voice_start_time'])//1000)})" for r in active_rows if not r["is_video"] and not r["is_streaming"]]

    embed = discord.Embed(
        title=f"🔴 Currently Active Voice Members ({len(active_rows)})",
        color=0x57F287 if active_rows else 0xED4245
    )
    embed.add_field(name="🔴 Screen Sharing / Live Streams", value="\\n".join(streams) if streams else "*None*", inline=False)
    embed.add_field(name="📹 Video Cameras Turned On", value="\\n".join(videos) if videos else "*None*", inline=False)
    embed.add_field(name="🔊 Voice Only Connected", value="\\n".join(voice) if voice else "*None*", inline=False)

    await interaction.response.send_message(embed=embed)

@bot.tree.command(name="inactive", description="List members with no voice/video activity in the last X days")
@app_commands.describe(days="Number of days threshold (default: 7)")
async def inactive_command(interaction: discord.Interaction, days: int = 7):
    threshold_ms = int(time.time() * 1000) - days * 86400000
    cursor.execute("""
        SELECT u.user_id, u.username, u.last_seen_at
        FROM users u
        LEFT JOIN active_sessions a ON u.user_id = a.user_id
        WHERE a.user_id IS NULL AND (u.last_seen_at < ? OR u.last_seen_at IS NULL)
        LIMIT 20
    """, (threshold_ms,))
    rows = cursor.fetchall()

    lines = []
    for r in rows:
        days_ago = (int(time.time() * 1000) - r["last_seen_at"]) // 86400000 if r["last_seen_at"] else "Never"
        lines.append(f"• **{r['username']}** (<@{r['user_id']}>) — Last active: {days_ago}d ago")

    embed = discord.Embed(
        title=f"💤 Inactive Members ({days}+ Days)",
        description="\\n".join(lines) if lines else "🎉 No inactive members found!",
        color=0xFEE75C
    )
    await interaction.response.send_message(embed=embed)

if __name__ == "__main__":
    bot.run(TOKEN)
`
  },
  {
    filename: 'requirements.txt',
    language: 'plaintext',
    category: 'python',
    description: 'Python dependencies for discord.py tracker bot',
    content: `discord.py>=2.3.2
python-dotenv>=1.0.1
`
  },
  {
    filename: 'Dockerfile',
    language: 'dockerfile',
    category: 'docker',
    description: 'Multi-stage Dockerfile for Node.js / TypeScript Discord bot 24/7 hosting',
    content: `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist

# Persistent volume for SQLite database
VOLUME ["/app/data"]

CMD ["node", "dist/bot.js"]
`
  },
  {
    filename: 'docker-compose.yml',
    language: 'yaml',
    category: 'docker',
    description: 'Docker Compose configuration for one-command deployment with persistent volume',
    content: `version: '3.8'

services:
  discord-tracker-bot:
    build: .
    restart: always
    environment:
      - DISCORD_BOT_TOKEN=\${DISCORD_BOT_TOKEN}
      - DISCORD_CLIENT_ID=\${DISCORD_CLIENT_ID}
      - DISCORD_GUILD_ID=\${DISCORD_GUILD_ID}
      - DISCORD_LOG_CHANNEL_ID=\${DISCORD_LOG_CHANNEL_ID}
    volumes:
      - ./data:/app/data
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
`
  },
  {
    filename: 'README.md',
    language: 'markdown',
    category: 'docs',
    description: 'Full setup and deployment instructions guide',
    content: `# 🎙️ Discord Voice, Video & Stream Tracker Bot

A 24/7 Discord activity tracking bot that monitors voice presence, camera (video call), and Go Live screen sharing separately, logging duration and timestamps into SQLite / PostgreSQL.

---

## ⚡ 1. Create Your Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** and give it a name (e.g. \`Voice & Stream Tracker\`).
3. In the left sidebar, navigate to **Bot**:
   - Click **Add Bot**.
   - Under **Privileged Gateway Intents**, enable:
     - ✅ **Server Members Intent** (\`GUILD_MEMBERS\`)
     - ✅ **Message Content Intent** (if reading commands)
   - Click **Reset Token** and copy your **Bot Token**.
4. In the left sidebar, navigate to **OAuth2 ➔ URL Generator**:
   - Under **Scopes**, select \`bot\` and \`applications.commands\`.
   - Under **Bot Permissions**, select:
     - \`View Channels\`
     - \`Send Messages\`
     - \`Embed Links\`
     - \`Read Message History\`
     - \`Connect\`
   - Copy the generated URL and paste it in your browser to invite the bot to your server.

---

## 🚀 2. Run with Node.js / TypeScript

\`\`\`bash
# 1. Install dependencies
npm install discord.js better-sqlite3 dotenv
npm install -D typescript @types/node @types/better-sqlite3 tsx

# 2. Configure .env
cp .env.example .env
# Edit .env and paste your DISCORD_BOT_TOKEN & DISCORD_CLIENT_ID

# 3. Run with TypeScript
npx tsx bot.ts
\`\`\`

---

## 🐍 3. Run with Python (discord.py)

\`\`\`bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run bot
python bot.py
\`\`\`

---

## ☁️ 4. 24/7 Hosting (Railway, VPS, Docker)

### Option A: Railway.app (Free / One-Click)
1. Push this repository to GitHub.
2. Link your repo on [Railway.app](https://railway.app).
3. Set the \`DISCORD_BOT_TOKEN\` environment variable in Railway variables.
4. Set start command: \`npx tsx bot.ts\` or \`python bot.py\`.

### Option B: Docker Compose
\`\`\`bash
docker-compose up -d
\`\`\`
`
  }
];
