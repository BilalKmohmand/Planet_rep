import React, { useState } from 'react';
import {
  Terminal,
  Play,
  Copy,
  Check,
  Command,
  Hash
} from 'lucide-react';
import { SlashCommandResponse, DiscordEmbed } from '../types';

interface SlashCommandsTabProps {
  allMembers: any[];
  initialCommand?: { command: string; args?: any } | null;
}

export const SlashCommandsTab: React.FC<SlashCommandsTabProps> = ({
  allMembers,
  initialCommand,
}) => {
  const [selectedCommand, setSelectedCommand] = useState<string>(initialCommand?.command || 'stats');
  const [userId, setUserId] = useState<string>(initialCommand?.args?.userId || allMembers[0]?.userId || '101');
  const [timeframe, setTimeframe] = useState<string>(initialCommand?.args?.timeframe || 'all');
  const [days, setDays] = useState<number>(initialCommand?.args?.days || 7);
  const [leaderboardType, setLeaderboardType] = useState<string>('stream');
  const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<string>('weekly');

  const [executing, setExecuting] = useState(false);
  const [response, setResponse] = useState<SlashCommandResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const executeCommand = async (cmdName = selectedCommand) => {
    setExecuting(true);
    try {
      let args: any = {};
      if (cmdName === 'stats') {
        args = { userId, timeframe };
      } else if (cmdName === 'inactive') {
        args = { days };
      } else if (cmdName === 'leaderboard') {
        args = { type: leaderboardType, timeframe: leaderboardTimeframe };
      }

      const res = await fetch('/api/command/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmdName, args }),
      });

      const data = await res.json();
      setResponse(data);
    } catch (e) {
      console.error('Failed to execute command:', e);
    } finally {
      setExecuting(false);
    }
  };

  React.useEffect(() => {
    executeCommand(selectedCommand);
  }, [selectedCommand]);

  const copyCommandText = () => {
    if (!response) return;
    navigator.clipboard.writeText(response.command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const decimalToHex = (colorNum?: number) => {
    if (!colorNum) return '#5865F2';
    return `#${colorNum.toString(16).padStart(6, '0')}`;
  };

  return (
    <div className="space-y-8">
      {/* 01. Header & Command Selector */}
      <section className="bg-zinc-900 border border-zinc-800 p-6 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-zinc-800 pb-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              01. Slash Command Console
            </h2>
            <p className="text-sm font-bold text-zinc-200 mt-1 uppercase tracking-tight">
              Test & Preview Discord Bot Interactions & Rich Embeds
            </p>
          </div>
          <span className="text-[10px] uppercase font-mono text-zinc-500">Discord API v10 Protocol</span>
        </div>

        {/* Command Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {[
            { id: 'stats', label: '/stats', desc: 'Member breakdown' },
            { id: 'live', label: '/live', desc: 'Real-time rooms' },
            { id: 'inactive', label: '/inactive', desc: 'Inactivity audit' },
            { id: 'leaderboard', label: '/leaderboard', desc: 'Top rankings' },
          ].map((cmd) => (
            <button
              key={cmd.id}
              onClick={() => {
                setSelectedCommand(cmd.id);
              }}
              className={`p-3 text-left border transition-all ${
                selectedCommand === cmd.id
                  ? 'bg-zinc-100 border-zinc-100 text-zinc-950 font-black'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <span className="font-mono text-xs font-black uppercase block">{cmd.label}</span>
              <span className={`text-[10px] uppercase font-bold block mt-0.5 ${
                selectedCommand === cmd.id ? 'text-zinc-700' : 'text-zinc-500'
              }`}>
                {cmd.desc}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 02. Parameters & Discord Embed Live Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Parameters Form */}
        <div className="bg-zinc-900 border border-zinc-800 p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-1.5 border-b border-zinc-800 pb-2">
            <Command className="w-3.5 h-3.5 text-zinc-100" />
            Command Arguments
          </h3>

          {selectedCommand === 'stats' && (
            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                  Target Member (@user)
                </label>
                <select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-500 font-bold uppercase"
                >
                  {allMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      @{m.username} ({m.userTag})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                  Timeframe
                </label>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-500 font-bold uppercase"
                >
                  <option value="all">All Time</option>
                  <option value="weekly">This Week (7 Days)</option>
                  <option value="monthly">This Month (30 Days)</option>
                  <option value="daily">Today (24 Hours)</option>
                </select>
              </div>
            </div>
          )}

          {selectedCommand === 'live' && (
            <div className="p-3 bg-zinc-950 border border-zinc-800 text-xs font-mono uppercase text-zinc-400">
              The <code className="text-emerald-400">/live</code> command takes no arguments. It scans all voice channels and reports real-time streams and cameras.
            </div>
          )}

          {selectedCommand === 'inactive' && (
            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                  Days Threshold (days: {days})
                </label>
                <input
                  type="range"
                  min="1"
                  max="60"
                  value={days}
                  onChange={(e) => setDays(parseInt(e.target.value, 10))}
                  className="w-full accent-zinc-100 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 mt-1 uppercase">
                  <span>1 day</span>
                  <span>7 days</span>
                  <span>30 days</span>
                  <span>60 days</span>
                </div>
              </div>
            </div>
          )}

          {selectedCommand === 'leaderboard' && (
            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                  Activity Type
                </label>
                <select
                  value={leaderboardType}
                  onChange={(e) => setLeaderboardType(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-500 font-bold uppercase"
                >
                  <option value="stream">🔴 Screen Sharing / Go Live Streams</option>
                  <option value="video">📹 Video Calls (Camera ON)</option>
                  <option value="voice">🔊 Voice Presence Only</option>
                  <option value="all">📈 Combined Total Time</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                  Timeframe
                </label>
                <select
                  value={leaderboardTimeframe}
                  onChange={(e) => setLeaderboardTimeframe(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-500 font-bold uppercase"
                >
                  <option value="weekly">This Week (7 Days)</option>
                  <option value="monthly">This Month (30 Days)</option>
                  <option value="daily">Today</option>
                  <option value="all">All Time</option>
                </select>
              </div>
            </div>
          )}

          <button
            onClick={() => executeCommand()}
            disabled={executing}
            className="w-full py-3 px-4 bg-zinc-100 hover:bg-white disabled:opacity-50 text-zinc-950 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
          >
            <Play className="w-4 h-4 fill-current" />
            {executing ? 'Executing Slash Command...' : 'Execute Slash Command'}
          </button>
        </div>

        {/* Discord Preview */}
        <div className="lg:col-span-2 bg-[#313338] border border-[#1e1f22] p-5 space-y-4 text-slate-200">
          <div className="flex items-center justify-between pb-3 border-b border-[#3f4147]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#b5bac1] flex items-center gap-1">
                <Hash className="w-4 h-4 text-[#80848e]" />
                bot-commands
              </span>
              <span className="text-[10px] bg-[#232428] text-[#949ba4] px-1.5 py-0.5 uppercase font-mono">
                Discord Client Preview
              </span>
            </div>

            {response && (
              <button
                onClick={copyCommandText}
                className="flex items-center gap-1 text-xs text-[#949ba4] hover:text-[#dbdee1] transition-colors"
                title="Copy slash command"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="font-mono text-xs">{response.command}</span>
              </button>
            )}
          </div>

          {/* Discord Message Container */}
          <div className="flex gap-3 items-start">
            <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center text-white shrink-0 font-bold text-sm shadow">
              🤖
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Voice & Stream Tracker</span>
                <span className="bg-[#5865F2] text-white text-[10px] font-bold px-1.5 py-0.2 rounded uppercase">
                  BOT
                </span>
                <span className="text-[11px] text-[#949ba4]">Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              {response?.embeds.map((embed: DiscordEmbed, idx: number) => {
                const borderHex = decimalToHex(embed.color);

                return (
                  <div
                    key={idx}
                    className="bg-[#2b2d31] rounded-r-lg p-4 border-l-4 space-y-3 max-w-xl shadow-md"
                    style={{ borderLeftColor: borderHex }}
                  >
                    {embed.author && (
                      <div className="flex items-center gap-2">
                        {embed.author.icon_url && (
                          <img
                            src={embed.author.icon_url}
                            alt=""
                            className="w-5 h-5 rounded-full object-cover"
                          />
                        )}
                        <span className="text-xs font-semibold text-white">{embed.author.name}</span>
                      </div>
                    )}

                    {embed.title && (
                      <h4 className="text-sm font-bold text-white leading-snug">{embed.title}</h4>
                    )}

                    {embed.description && (
                      <p className="text-xs text-[#dbdee1] whitespace-pre-line leading-relaxed">
                        {embed.description}
                      </p>
                    )}

                    {embed.fields && embed.fields.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {embed.fields.map((f, fIdx) => (
                          <div
                            key={fIdx}
                            className={f.inline ? '' : 'sm:col-span-2'}
                          >
                            <span className="text-xs font-bold text-[#b5bac1] block font-mono">
                              {f.name}
                            </span>
                            <span className="text-xs text-[#dbdee1] block whitespace-pre-line font-medium mt-0.5 font-mono">
                              {f.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {embed.footer && (
                      <div className="pt-2 text-[10px] text-[#949ba4] border-t border-[#35373c] flex items-center justify-between font-mono">
                        <span>{embed.footer.text}</span>
                        {embed.timestamp && (
                          <span>{new Date(embed.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
