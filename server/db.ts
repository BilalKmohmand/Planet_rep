import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import {
  MemberSession,
  ActiveMemberState,
  GuildMemberSummary,
  ActivityType,
  AlertLogItem,
  VoiceChannelData
} from '../src/types';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials in environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);



class DatabaseManager {
  constructor() {
    this.initializeDatabase();
  }

  private async initializeDatabase() {
    try {
      // Test connection
      const { error } = await supabase.from('guild_members').select('count').limit(1);
      if (error) {
        console.error('[Supabase] Connection test failed:', error.message);
      } else {
        console.log('[Supabase] Connected successfully');
      }
    } catch (e) {
      console.error('[Supabase] Initialization error:', e);
    }
  }





  // --- Member Management ---
  public async upsertMember(user: { userId: string; username: string; userTag: string; avatarUrl?: string }) {
    const { error } = await supabase
      .from('guild_members')
      .upsert({
        user_id: user.userId,
        username: user.username,
        user_tag: user.userTag,
        avatar_url: user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&h=128&fit=crop&crop=faces',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });
    
    if (error) console.error('[Supabase] upsertMember error:', error);
  }

  public async getGuildMembers() {
    const { data, error } = await supabase
      .from('guild_members')
      .select('*');
    
    if (error) {
      console.error('[Supabase] getGuildMembers error:', error);
      return [];
    }
    
    return (data || []).map(m => ({
      userId: m.user_id,
      username: m.username,
      userTag: m.user_tag,
      avatarUrl: m.avatar_url,
      joinedServerAt: new Date(m.joined_server_at).getTime(),
    }));
  }

  // --- Voice Channels ---
  public async getChannels(): Promise<VoiceChannelData[]> {
    const { data: channels, error: channelsError } = await supabase
      .from('voice_channels')
      .select('*');
    
    if (channelsError) {
      console.error('[Supabase] getChannels error:', channelsError);
      return [];
    }
    
    const { data: activeStates } = await supabase
      .from('active_states')
      .select('*');
    
    return (channels || []).map(c => {
      const membersInChannel = (activeStates || []).filter((m: any) => m.channel_id === c.id).map((m: any) => ({
        userId: m.user_id,
        username: m.username,
        userTag: m.user_tag,
        avatarUrl: m.avatar_url,
        channelId: m.channel_id,
        channelName: m.channel_name,
        guildId: m.guild_id,
        isVoice: m.is_voice,
        isVideo: m.is_video,
        isStreaming: m.is_streaming,
        selfMute: m.self_mute,
        selfDeaf: m.self_deaf,
        voiceStartTime: m.voice_start_time ? new Date(m.voice_start_time).getTime() : null,
        videoStartTime: m.video_start_time ? new Date(m.video_start_time).getTime() : null,
        streamStartTime: m.stream_start_time ? new Date(m.stream_start_time).getTime() : null,
        streamTitle: m.stream_title,
      }));
      return {
        id: c.id,
        name: c.name,
        members: membersInChannel,
      };
    });
  }

  public async addChannel(id: string, name: string) {
    const { error } = await supabase
      .from('voice_channels')
      .upsert({ id, name }, {
        onConflict: 'id'
      });
    
    if (error) console.error('[Supabase] addChannel error:', error);
  }

  // --- Active States & Transitions ---
  public async getActiveState(userId: string): Promise<ActiveMemberState | undefined> {
    const { data, error } = await supabase
      .from('active_states')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) return undefined;
    
    return {
      userId: data.user_id,
      username: data.username,
      userTag: data.user_tag,
      avatarUrl: data.avatar_url,
      channelId: data.channel_id,
      channelName: data.channel_name,
      guildId: data.guild_id,
      isVoice: data.is_voice,
      isVideo: data.is_video,
      isStreaming: data.is_streaming,
      selfMute: data.self_mute,
      selfDeaf: data.self_deaf,
      voiceStartTime: data.voice_start_time ? new Date(data.voice_start_time).getTime() : null,
      videoStartTime: data.video_start_time ? new Date(data.video_start_time).getTime() : null,
      streamStartTime: data.stream_start_time ? new Date(data.stream_start_time).getTime() : null,
      streamTitle: data.stream_title,
    };
  }

  public async getAllActiveStates(): Promise<ActiveMemberState[]> {
    const { data, error } = await supabase
      .from('active_states')
      .select('*');
    
    if (error) {
      console.error('[Supabase] getAllActiveStates error:', error);
      return [];
    }
    
    return (data || []).map((m: any) => ({
      userId: m.user_id,
      username: m.username,
      userTag: m.user_tag,
      avatarUrl: m.avatar_url,
      channelId: m.channel_id,
      channelName: m.channel_name,
      guildId: m.guild_id,
      isVoice: m.is_voice,
      isVideo: m.is_video,
      isStreaming: m.is_streaming,
      selfMute: m.self_mute,
      selfDeaf: m.self_deaf,
      voiceStartTime: m.voice_start_time ? new Date(m.voice_start_time).getTime() : null,
      videoStartTime: m.video_start_time ? new Date(m.video_start_time).getTime() : null,
      streamStartTime: m.stream_start_time ? new Date(m.stream_start_time).getTime() : null,
      streamTitle: m.stream_title,
    }));
  }

  public async setActiveState(state: ActiveMemberState) {
    await this.upsertMember(state);
    
    const { error } = await supabase
      .from('active_states')
      .upsert({
        user_id: state.userId,
        username: state.username,
        user_tag: state.userTag,
        avatar_url: state.avatarUrl,
        channel_id: state.channelId,
        channel_name: state.channelName,
        guild_id: state.guildId,
        is_voice: state.isVoice,
        is_video: state.isVideo,
        is_streaming: state.isStreaming,
        self_mute: state.selfMute,
        self_deaf: state.selfDeaf,
        voice_start_time: state.voiceStartTime ? new Date(state.voiceStartTime).toISOString() : null,
        video_start_time: state.videoStartTime ? new Date(state.videoStartTime).toISOString() : null,
        stream_start_time: state.streamStartTime ? new Date(state.streamStartTime).toISOString() : null,
        stream_title: state.streamTitle,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });
    
    if (error) console.error('[Supabase] setActiveState error:', error);
  }

  public async removeActiveState(userId: string) {
    const { error } = await supabase
      .from('active_states')
      .delete()
      .eq('user_id', userId);
    
    if (error) console.error('[Supabase] removeActiveState error:', error);
  }

  // --- Completed Sessions ---
  public async addCompletedSession(session: MemberSession) {
    const { error } = await supabase
      .from('sessions')
      .insert({
        id: session.id,
        user_id: session.userId,
        username: session.username,
        user_tag: session.userTag,
        avatar_url: session.avatarUrl,
        guild_id: session.guildId,
        guild_name: session.guildName,
        channel_id: session.channelId,
        channel_name: session.channelName,
        activity_type: session.activityType,
        start_time: new Date(session.startTime).toISOString(),
        end_time: new Date(session.endTime).toISOString(),
        duration_seconds: session.durationSeconds,
        is_ongoing: session.isOngoing,
        metadata: session.metadata || null,
      });
    
    if (error) console.error('[Supabase] addCompletedSession error:', error);
  }

  // --- Alert Logs ---
  public async addAlertLog(item: AlertLogItem) {
    const { error } = await supabase
      .from('alert_logs')
      .insert({
        id: item.id,
        timestamp: new Date(item.timestamp).toISOString(),
        type: item.type,
        user_id: item.userId,
        username: item.username,
        user_tag: item.userTag,
        avatar_url: item.avatarUrl,
        channel_name: item.channelName,
        message: item.message,
        duration_formatted: item.durationFormatted || null,
      });
    
    if (error) console.error('[Supabase] addAlertLog error:', error);
    
    // Clean up old logs (keep only 200 most recent)
    const { data: allLogs } = await supabase
      .from('alert_logs')
      .select('id')
      .order('created_at', { ascending: false });
    
    if (allLogs && allLogs.length > 200) {
      const toDelete = allLogs.slice(200).map((l: any) => l.id);
      await supabase
        .from('alert_logs')
        .delete()
        .in('id', toDelete);
    }
  }

  public async getAlertLogs(limit = 50): Promise<AlertLogItem[]> {
    const { data, error } = await supabase
      .from('alert_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('[Supabase] getAlertLogs error:', error);
      return [];
    }
    
    return (data || []).map((log: any) => ({
      id: log.id,
      timestamp: new Date(log.timestamp).getTime(),
      type: log.type,
      userId: log.user_id,
      username: log.username,
      userTag: log.user_tag,
      avatarUrl: log.avatar_url,
      channelName: log.channel_name,
      message: log.message,
      durationFormatted: log.duration_formatted,
    }));
  }

  // --- Queries & Stats ---
  public async getSessionHistory(filters: {
    userId?: string;
    channelId?: string;
    activityType?: ActivityType | 'all';
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from('sessions')
      .select('*', { count: 'exact' })
      .order('start_time', { ascending: false });
    
    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters.channelId) {
      query = query.eq('channel_id', filters.channelId);
    }
    if (filters.activityType && filters.activityType !== 'all') {
      query = query.eq('activity_type', filters.activityType);
    }
    
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;
    
    query = query.range(offset, offset + limit - 1);
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('[Supabase] getSessionHistory error:', error);
      return { sessions: [], total: 0, hasMore: false };
    }
    
    const sessions = (data || []).map((s: any) => ({
      id: s.id,
      userId: s.user_id,
      username: s.username,
      userTag: s.user_tag,
      avatarUrl: s.avatar_url,
      guildId: s.guild_id,
      guildName: s.guild_name,
      channelId: s.channel_id,
      channelName: s.channel_name,
      activityType: s.activity_type,
      startTime: new Date(s.start_time).getTime(),
      endTime: new Date(s.end_time).getTime(),
      durationSeconds: s.duration_seconds,
      isOngoing: s.is_ongoing,
      metadata: s.metadata,
    }));
    
    const total = count || 0;
    return {
      sessions,
      total,
      hasMore: offset + limit < total,
    };
  }

  public async getUserStats(userId: string, timeframe: 'all' | 'daily' | 'weekly' | 'monthly' = 'all') {
    const now = new Date();
    let minDate: Date | null = null;

    if (timeframe === 'daily') {
      minDate = new Date(now.getTime() - 24 * 3600 * 1000);
    } else if (timeframe === 'weekly') {
      minDate = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    } else if (timeframe === 'monthly') {
      minDate = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    }

    let query = supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId);
    
    if (minDate) {
      query = query.gte('start_time', minDate.toISOString());
    }
    
    const { data: sessions, error: sessionsError } = await query;
    
    if (sessionsError) {
      console.error('[Supabase] getUserStats error:', sessionsError);
    }
    
    let voiceSec = 0;
    let videoSec = 0;
    let streamSec = 0;

    (sessions || []).forEach((s: any) => {
      if (s.activity_type === 'voice') voiceSec += s.duration_seconds;
      if (s.activity_type === 'video') videoSec += s.duration_seconds;
      if (s.activity_type === 'stream') streamSec += s.duration_seconds;
    });

    // Add ongoing active session time
    const { data: active } = await supabase
      .from('active_states')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (active) {
      const nowMs = now.getTime();
      if (active.is_voice && active.voice_start_time) {
        const curSec = Math.floor((nowMs - new Date(active.voice_start_time).getTime()) / 1000);
        voiceSec += curSec;
      }
      if (active.is_video && active.video_start_time) {
        const curSec = Math.floor((nowMs - new Date(active.video_start_time).getTime()) / 1000);
        videoSec += curSec;
      }
      if (active.is_streaming && active.stream_start_time) {
        const curSec = Math.floor((nowMs - new Date(active.stream_start_time).getTime()) / 1000);
        streamSec += curSec;
      }
    }

    const { data: member } = await supabase
      .from('guild_members')
      .select('*')
      .eq('user_id', userId)
      .single();

    const memberData = member || {
      user_id: userId,
      username: active?.username || 'Unknown',
      user_tag: active?.user_tag || 'User#' + userId,
      avatar_url: active?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&h=128&fit=crop&crop=faces',
    };

    return {
      user: {
        userId: memberData.user_id,
        username: memberData.username,
        userTag: memberData.user_tag,
        avatarUrl: memberData.avatar_url,
      },
      timeframe,
      totalVoiceSeconds: voiceSec,
      totalVideoSeconds: videoSec,
      totalStreamSeconds: streamSec,
      totalSeconds: voiceSec + videoSec + streamSec,
      sessionCount: (sessions || []).length + (active ? 1 : 0),
      isCurrentlyActive: !!active,
      currentChannel: active?.channel_name,
      recentSessions: (sessions || []).slice(0, 10).map((s: any) => ({
        id: s.id,
        userId: s.user_id,
        username: s.username,
        userTag: s.user_tag,
        avatarUrl: s.avatar_url,
        guildId: s.guild_id,
        guildName: s.guild_name,
        channelId: s.channel_id,
        channelName: s.channel_name,
        activityType: s.activity_type,
        startTime: new Date(s.start_time).getTime(),
        endTime: new Date(s.end_time).getTime(),
        durationSeconds: s.duration_seconds,
        isOngoing: s.is_ongoing,
        metadata: s.metadata,
      })),
    };
  }

  public async getLeaderboard(
    activityType: ActivityType | 'all' = 'stream',
    timeframe: 'daily' | 'weekly' | 'monthly' | 'all' = 'weekly'
  ) {
    const { data: members } = await supabase
      .from('guild_members')
      .select('*');
    
    const results = await Promise.all((members || []).map(async (m: any) => {
      const stats = await this.getUserStats(m.user_id, timeframe);
      let score = 0;
      if (activityType === 'stream') score = stats.totalStreamSeconds;
      else if (activityType === 'video') score = stats.totalVideoSeconds;
      else if (activityType === 'voice') score = stats.totalVoiceSeconds;
      else score = stats.totalVoiceSeconds + stats.totalVideoSeconds + stats.totalStreamSeconds;

      return {
        ...stats,
        score,
      };
    }));

    // Sort descending by score
    results.sort((a, b) => b.score - a.score);
    return results;
  }

  public async getInactiveMembers(thresholdDays = 7) {
    const now = new Date();
    const thresholdDate = new Date(now.getTime() - thresholdDays * 24 * 3600 * 1000);
    
    const { data: activeStates } = await supabase
      .from('active_states')
      .select('user_id');
    
    const activeUserIds = new Set((activeStates || []).map((a: any) => a.user_id));
    
    const { data: members } = await supabase
      .from('guild_members')
      .select('*');

    const summaries = await Promise.all((members || []).map(async (m: any) => {
      // Find latest session
      const { data: userSessions } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', m.user_id)
        .order('end_time', { ascending: false })
        .limit(1);
      
      let lastActive = m.joined_server_at ? new Date(m.joined_server_at).getTime() : (now.getTime() - 30 * 86400000);
      let totalVoice = 0;
      let totalVideo = 0;
      let totalStream = 0;

      if (userSessions && userSessions.length > 0) {
        const session = userSessions[0];
        if (session.end_time) {
          const endTime = new Date(session.end_time).getTime();
          if (endTime > lastActive) lastActive = endTime;
        }
        if (session.activity_type === 'voice') totalVoice += session.duration_seconds;
        if (session.activity_type === 'video') totalVideo += session.duration_seconds;
        if (session.activity_type === 'stream') totalStream += session.duration_seconds;
      }

      const isActiveNow = activeUserIds.has(m.user_id);
      if (isActiveNow) lastActive = now.getTime();

      const daysSince = Math.floor((now.getTime() - lastActive) / 86400000);

      const { data: activeState } = await supabase
        .from('active_states')
        .select('*')
        .eq('user_id', m.user_id)
        .single();
      
      const currentActivities: ActivityType[] = [];
      if (activeState?.is_voice) currentActivities.push('voice');
      if (activeState?.is_video) currentActivities.push('video');
      if (activeState?.is_streaming) currentActivities.push('stream');

      return {
        userId: m.user_id,
        username: m.username,
        userTag: m.user_tag,
        avatarUrl: m.avatar_url,
        totalVoiceSeconds: totalVoice,
        totalVideoSeconds: totalVideo,
        totalStreamSeconds: totalStream,
        totalSessions: (userSessions || []).length,
        lastActiveTimestamp: lastActive,
        isCurrentlyActive: isActiveNow,
        currentChannelName: activeState?.channel_name,
        currentActivities,
        daysSinceLastActive: daysSince,
      };
    }));

    const inactiveOnly = summaries.filter(
      m => !m.isCurrentlyActive && (now.getTime() - m.lastActiveTimestamp) >= thresholdDays * 24 * 3600 * 1000
    );

    inactiveOnly.sort((a, b) => b.daysSinceLastActive - a.daysSinceLastActive);

    return {
      thresholdDays,
      totalGuildMembers: (members || []).length,
      inactiveCount: inactiveOnly.length,
      inactiveMembers: inactiveOnly,
      allMembers: summaries,
    };
  }

  public async getOverviewAnalytics() {
    const now = new Date();
    
    const { data: activeStates } = await supabase
      .from('active_states')
      .select('*');
    
    const activeVoiceCount = (activeStates || []).length;
    const activeVideoCount = (activeStates || []).filter((s: any) => s.is_video).length;
    const activeStreamCount = (activeStates || []).filter((s: any) => s.is_streaming).length;

    const { data: sessions } = await supabase
      .from('sessions')
      .select('*');
    
    let totalVoiceSec = 0;
    let totalVideoSec = 0;
    let totalStreamSec = 0;

    (sessions || []).forEach((s: any) => {
      if (s.activity_type === 'voice') totalVoiceSec += s.duration_seconds;
      if (s.activity_type === 'video') totalVideoSec += s.duration_seconds;
      if (s.activity_type === 'stream') totalStreamSec += s.duration_seconds;
    });

    // Daily breakdown for the last 7 days chart
    const dailyBreakdown: { date: string; voiceHours: number; videoHours: number; streamHours: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();

      const { data: daySessions } = await supabase
        .from('sessions')
        .select('*')
        .gte('start_time', dayStart)
        .lt('start_time', dayEnd);
      
      let vH = 0;
      let vidH = 0;
      let sH = 0;
      (daySessions || []).forEach((s: any) => {
        if (s.activity_type === 'voice') vH += s.duration_seconds / 3600;
        if (s.activity_type === 'video') vidH += s.duration_seconds / 3600;
        if (s.activity_type === 'stream') sH += s.duration_seconds / 3600;
      });

      dailyBreakdown.push({
        date: dateStr,
        voiceHours: Number(vH.toFixed(1)),
        videoHours: Number(vidH.toFixed(1)),
        streamHours: Number(sH.toFixed(1)),
      });
    }

    const { data: members } = await supabase
      .from('guild_members')
      .select('count', { count: 'exact', head: true });
    
    const { count: memberCount } = members || { count: 0 };

    return {
      activeVoiceCount,
      activeVideoCount,
      activeStreamCount,
      totalSessionsCount: (sessions || []).length,
      totalGuildMembersCount: memberCount || 0,
      totalVoiceHours: Number((totalVoiceSec / 3600).toFixed(1)),
      totalVideoHours: Number((totalVideoSec / 3600).toFixed(1)),
      totalStreamHours: Number((totalStreamSec / 3600).toFixed(1)),
      dailyBreakdown,
      channels: await this.getChannels(),
    };
  }
}

export const db = new DatabaseManager();
