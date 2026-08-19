import React from 'react';
import {
  Mic,
  Video,
  Radio,
  Clock,
  Users,
  Activity,
  Zap,
  TrendingUp,
  ShieldCheck,
  Play,
  ArrowUpRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import { AlertLogItem, VoiceChannelData, ActiveMemberState } from '../types';

interface OverviewTabProps {
  overviewData: any;
  alerts: AlertLogItem[];
  channels: VoiceChannelData[];
  onTriggerQuickAction: (action: string, userId?: string, channelId?: string) => void;
  onNavigateToTab: (tab: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  overviewData,
  alerts,
  channels,
  onTriggerQuickAction,
  onNavigateToTab,
}) => {
  const chartData = overviewData?.dailyBreakdown || [];

  const activeMembers: ActiveMemberState[] = [];
  channels.forEach((c) => {
    c.members.forEach((m) => activeMembers.push(m));
  });

  const streamers = activeMembers.filter((m) => m.isStreaming);
  const videoUsers = activeMembers.filter((m) => m.isVideo);
  const voiceOnlyUsers = activeMembers.filter((m) => !m.isVideo && !m.isStreaming);

  return (
    <div className="space-y-8">
      {/* 01. High-Impact Bold Metric Tiles */}
      <div>
        <div className="flex items-baseline justify-between mb-3 border-b border-zinc-800 pb-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
            01. Aggregated Metrics
          </h2>
          <span className="text-[10px] uppercase font-mono text-zinc-500">24/7 Engine Snapshot</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Primary High-Contrast Tile */}
          <div className="bg-zinc-100 text-zinc-950 p-5 border border-zinc-200 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-800">
                  Weekly Stream
                </span>
                <span className="text-[10px] font-bold bg-zinc-900 text-zinc-100 px-1.5 py-0.5 uppercase">
                  Active
                </span>
              </div>
              <div className="mt-3">
                <span className="text-4xl sm:text-5xl font-black tracking-tighter leading-none block">
                  {overviewData?.totalStreamHours || 0}h
                </span>
                <p className="text-[11px] font-bold mt-1 text-zinc-700">
                  {overviewData?.activeStreamCount || 0} Go Live streams running now
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-300/80 flex items-center justify-between text-[10px] font-mono font-bold text-zinc-600 uppercase">
              <span>Screen Share</span>
              <span>{overviewData?.totalStreamHours > 0 ? 'Active' : 'No data'}</span>
            </div>
          </div>

          {/* Voice Presence Tile */}
          <div className="bg-zinc-900 text-zinc-100 p-5 border border-zinc-800 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                  Voice Presence
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              </div>
              <div className="mt-3">
                <span className="text-4xl sm:text-5xl font-black tracking-tighter leading-none block font-mono">
                  {overviewData?.totalVoiceHours || 0}h
                </span>
                <p className="text-[11px] font-bold mt-1 text-emerald-400">
                  {overviewData?.activeVoiceCount || 0} members connected in channels
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-[10px] font-mono text-zinc-500 uppercase">
              <span>Voice Time</span>
              <span className="text-emerald-400 font-bold">{overviewData?.activeVoiceCount > 0 ? '● Active' : '○ Idle'}</span>
            </div>
          </div>

          {/* Video Calls Tile */}
          <div className="bg-zinc-900 text-zinc-100 p-5 border border-zinc-800 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                  Video Calls
                </span>
                <Video className="w-4 h-4 text-sky-400" />
              </div>
              <div className="mt-3">
                <span className="text-4xl sm:text-5xl font-black tracking-tighter leading-none block font-mono">
                  {overviewData?.totalVideoHours || 0}h
                </span>
                <p className="text-[11px] font-bold mt-1 text-sky-400">
                  {overviewData?.activeVideoCount || 0} webcams broadcasted
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-[10px] font-mono text-zinc-500 uppercase">
              <span>Camera Time</span>
              <span>{overviewData?.totalVideoHours > 0 ? 'Active' : 'No data'}</span>
            </div>
          </div>

          {/* Sessions Logged Tile */}
          <div className="bg-zinc-900 text-zinc-100 p-5 border border-zinc-800 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                  Total Sessions
                </span>
                <Users className="w-4 h-4 text-zinc-500" />
              </div>
              <div className="mt-3">
                <span className="text-4xl sm:text-5xl font-black tracking-tighter leading-none block font-mono">
                  {overviewData?.totalSessionsCount || 0}
                </span>
                <p className="text-[11px] font-bold mt-1 text-zinc-400">
                  {overviewData?.totalGuildMembersCount || 10} tracked members
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-[10px] font-mono text-zinc-500 uppercase">
              <span>Supabase Store</span>
              <span className="text-zinc-400 font-bold">{overviewData?.totalSessionsCount > 0 ? '100% PERSISTED' : 'Waiting for data'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 02. Live Activity & Leaderboard Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Presence Feed with Bold Left-Border Accents */}
        <section className="lg:col-span-4 border border-zinc-800 bg-zinc-900/60 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-2">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                02. Live Channel Presence
              </h2>
              <button
                onClick={() => onNavigateToTab('live')}
                className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 hover:text-zinc-100 flex items-center gap-1"
              >
                Rooms <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3">
              {activeMembers.length === 0 ? (
                <div className="p-6 bg-zinc-950 border border-zinc-800 text-center text-xs text-zinc-500 uppercase font-mono">
                  No active voice presence at the moment
                </div>
              ) : (
                activeMembers.map((m) => {
                  let borderClass = 'border-l-4 border-zinc-700 bg-zinc-950/70';
                  let badgeText = 'VOICE: ' + m.channelName;
                  let badgeColor = 'text-zinc-400';

                  if (m.isStreaming) {
                    borderClass = 'border-l-4 border-emerald-500 bg-zinc-950';
                    badgeText = 'STREAMING: ' + (m.streamTitle || m.channelName);
                    badgeColor = 'text-emerald-400';
                  } else if (m.isVideo) {
                    borderClass = 'border-l-4 border-sky-500 bg-zinc-950';
                    badgeText = 'VIDEO: ' + m.channelName;
                    badgeColor = 'text-sky-400';
                  }

                  return (
                    <div
                      key={m.userId}
                      className={`flex items-center gap-3 p-3.5 ${borderClass} border-r border-t border-b border-zinc-800/80 transition-all`}
                    >
                      <img
                        src={m.avatarUrl}
                        alt={m.username}
                        className="w-9 h-9 bg-zinc-800 rounded-full shrink-0 border border-zinc-700 object-cover"
                      />
                      <div className="flex-grow min-w-0">
                        <p className="font-bold text-sm text-zinc-100 truncate">@{m.username}</p>
                        <p className={`text-[10px] uppercase font-bold truncate ${badgeColor}`}>
                          {badgeText}
                        </p>
                      </div>
                      <span className="text-xs font-mono font-bold text-zinc-400 shrink-0">
                        {new Date(m.voiceStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-between items-end">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Active Now</p>
              <p className="text-4xl font-black text-zinc-100">{activeMembers.length}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Inactive (7d)</p>
              <p className="text-4xl font-black text-zinc-600">
                {Math.max(0, (overviewData?.totalGuildMembersCount || 10) - activeMembers.length)}
              </p>
            </div>
          </div>
        </section>

        {/* Center / Right Column: Leaderboard & Chart */}
        <section className="lg:col-span-8 space-y-6">
          {/* Daily Activity Hours Chart */}
          <div className="border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="flex items-baseline justify-between mb-4 border-b border-zinc-800 pb-2">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                03. Activity Trend Chart (7-Day Aggregate)
              </h2>
              <span className="text-[10px] uppercase font-mono text-zinc-500">Voice / Video / Stream</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#27272a" />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={11} tickLine={false} />
                  <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '0px', color: '#f4f4f5' }}
                    itemStyle={{ fontSize: '11px', fontFamily: 'monospace' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px', fontFamily: 'monospace', textTransform: 'uppercase' }} />
                  <Bar dataKey="voiceHours" name="Voice" fill="#10b981" />
                  <Bar dataKey="videoHours" name="Video" fill="#38bdf8" />
                  <Bar dataKey="streamHours" name="Stream" fill="#f43f5e" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Simulator Bar */}
          <div className="border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-zinc-100" />
                Quick Voice State Simulator
              </h3>
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Instant Event Dispatcher</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => onTriggerQuickAction('join_voice', '101', 'vc-1')}
                className="p-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 text-xs font-bold uppercase tracking-wider border border-zinc-800 hover:border-zinc-700 transition-colors"
              >
                + Join Voice
              </button>
              <button
                onClick={() => onTriggerQuickAction('toggle_stream', '101')}
                className="p-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider transition-colors"
              >
                ● Stream Live
              </button>
              <button
                onClick={() => onTriggerQuickAction('toggle_camera', '102')}
                className="p-2.5 bg-zinc-900 hover:bg-zinc-800 text-sky-400 text-xs font-bold uppercase tracking-wider border border-zinc-800 hover:border-zinc-700 transition-colors"
              >
                📹 Toggle Cam
              </button>
              <button
                onClick={() => onTriggerQuickAction('leave_voice', '101')}
                className="p-2.5 bg-zinc-900 hover:bg-red-950/60 text-red-400 text-xs font-bold uppercase tracking-wider border border-zinc-800 hover:border-red-900/60 transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* 04. System Event Logs with Monospace Layout */}
      <section className="border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
            04. System Event Logs (voiceStateUpdate)
          </h2>
          <span className="text-[10px] uppercase font-mono text-zinc-500">Real-time Ingestion</span>
        </div>

        <div className="font-mono text-xs space-y-2.5 max-h-60 overflow-y-auto pr-2">
          {alerts.length === 0 ? (
            <p className="text-zinc-600 text-center py-4 uppercase">[12:00:00] System: No event triggers logged yet.</p>
          ) : (
            alerts.slice(0, 10).map((alert) => (
              <div
                key={alert.id}
                className="flex flex-wrap items-baseline justify-between border-b border-zinc-900 pb-2 gap-2"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-zinc-500">
                    [{new Date(alert.timestamp).toLocaleTimeString()}]
                  </span>
                  <span className="text-zinc-200">
                    {alert.type === 'stream_start' && <span className="text-emerald-400 uppercase font-bold mr-1">Stream Start:</span>}
                    {alert.type === 'stream_stop' && <span className="text-zinc-400 uppercase font-bold mr-1">Stream Stop:</span>}
                    {alert.type === 'video_start' && <span className="text-sky-400 uppercase font-bold mr-1">Video On:</span>}
                    {alert.type === 'video_stop' && <span className="text-zinc-400 uppercase font-bold mr-1">Video Off:</span>}
                    {alert.type === 'voice_join' && <span className="text-zinc-300 uppercase font-bold mr-1">Voice Join:</span>}
                    {alert.type === 'voice_leave' && <span className="text-red-400 uppercase font-bold mr-1">Voice Leave:</span>}
                    {alert.type === 'channel_switch' && <span className="text-indigo-400 uppercase font-bold mr-1">Switch:</span>}
                    {alert.message}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-600 uppercase font-mono">OK</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};
