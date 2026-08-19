import React, { useState } from 'react';
import {
  Code2,
  Copy,
  Check,
  Download,
  Terminal,
  FileCode,
  Shield,
  Sparkles
} from 'lucide-react';
import { BOT_SOURCE_CODE, CodeFile } from '../data/botSourceCode';

export const CodeExportTab: React.FC = () => {
  const [activeFileIndex, setActiveFileIndex] = useState(1); // Default to bot.ts
  const [copied, setCopied] = useState(false);
  const [customToken, setCustomToken] = useState('');
  const [connectMsg, setConnectMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const activeFile = BOT_SOURCE_CODE[activeFileIndex] || BOT_SOURCE_CODE[0];

  const copyToClipboard = () => {
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = (file: CodeFile) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAllZip = () => {
    BOT_SOURCE_CODE.forEach((f) => {
      setTimeout(() => downloadFile(f), 100);
    });
  };

  const handleConnectLiveBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customToken) return;
    setIsConnecting(true);
    setConnectMsg(null);
    try {
      const res = await fetch('/api/bot/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: customToken }),
      });
      const data = await res.json();
      if (data.success) {
        setConnectMsg({ text: `Bot connected as ${data.status.botTag}! Tracking live voice states.`, success: true });
      } else {
        setConnectMsg({ text: data.error || 'Failed to connect.', success: false });
      }
    } catch (err: any) {
      setConnectMsg({ text: err.message || 'Error connecting bot.', success: false });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 01. Top Banner & Quick Connect */}
      <section className="bg-zinc-900 border border-zinc-800 p-6 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-zinc-800 pb-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              01. Production Bot Source Code & Deployment Hub
            </h2>
            <p className="text-sm font-bold text-zinc-200 mt-1 uppercase tracking-tight">
              Self-contained Node.js & Python 3.10+ Discord Bot Implementations
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={downloadAllZip}
              className="px-4 py-2 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download All Files
            </button>
          </div>
        </div>

        {/* Live Bot Token Ingestion */}
        <div className="pt-2">
          <form onSubmit={handleConnectLiveBot} className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[280px]">
              <input
                type="password"
                placeholder="PASTE DISCORD BOT TOKEN (OPTIONAL - CONNECTS TO YOUR REAL DISCORD SERVER)..."
                value={customToken}
                onChange={(e) => setCustomToken(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isConnecting || !customToken}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isConnecting ? 'CONNECTING...' : 'CONNECT LIVE BOT'}
            </button>
          </form>

          {connectMsg && (
            <p className={`text-xs mt-2 font-mono font-bold uppercase ${connectMsg.success ? 'text-emerald-400' : 'text-red-400'}`}>
              {connectMsg.text}
            </p>
          )}
        </div>
      </section>

      {/* 02. Code Browser Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* File Navigation List */}
        <div className="space-y-4">
          <div className="flex items-baseline justify-between border-b border-zinc-800 pb-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              02. Project Files ({BOT_SOURCE_CODE.length})
            </span>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-2 space-y-1">
            {BOT_SOURCE_CODE.map((file, idx) => {
              const isActive = activeFileIndex === idx;
              return (
                <button
                  key={file.filename}
                  onClick={() => setActiveFileIndex(idx)}
                  className={`w-full text-left p-2.5 text-xs font-mono transition-all flex items-center justify-between ${
                    isActive
                      ? 'bg-zinc-100 text-zinc-950 font-black'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-950'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode className={`w-4 h-4 shrink-0 ${isActive ? 'text-zinc-950' : 'text-zinc-500'}`} />
                    <span className="truncate">{file.filename}</span>
                  </div>
                  <span className={`text-[9px] uppercase font-mono px-1.5 py-0.2 ${
                    isActive ? 'bg-zinc-900 text-zinc-100 font-bold' : 'bg-zinc-950 text-zinc-500'
                  }`}>
                    {file.category}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Gateway Requirements Card */}
          <div className="bg-zinc-900 border border-zinc-800 p-4 space-y-2 text-xs font-mono">
            <h4 className="font-bold text-zinc-100 uppercase flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              Gateway Intents
            </h4>
            <ul className="space-y-1 text-zinc-400 text-[11px] list-disc list-inside">
              <li><strong className="text-zinc-200">GUILD_VOICE_STATES</strong></li>
              <li><strong className="text-zinc-200">GUILD_MEMBERS</strong></li>
              <li><strong className="text-zinc-200">GUILDS</strong></li>
            </ul>
          </div>
        </div>

        {/* Code Viewer Body */}
        <div className="lg:col-span-3 bg-zinc-900 border border-zinc-800 overflow-hidden flex flex-col justify-between">
          <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="font-mono text-xs font-black text-zinc-100 uppercase">{activeFile.filename}</span>
              <p className="text-[11px] font-mono text-zinc-500 mt-0.5">{activeFile.description}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-bold uppercase tracking-wider border border-zinc-800 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'COPIED!' : 'COPY CODE'}
              </button>

              <button
                onClick={() => downloadFile(activeFile)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-black uppercase tracking-wider transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                DOWNLOAD
              </button>
            </div>
          </div>

          <div className="p-5 bg-zinc-950 flex-1 overflow-x-auto max-h-[600px] overflow-y-auto font-mono text-xs text-zinc-300 leading-relaxed scrollbar-thin">
            <pre className="whitespace-pre">{activeFile.content}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};
