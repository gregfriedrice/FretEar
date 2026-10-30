import React from 'react';
import { Disc3, Music, Youtube, Sparkles, Database, Volume2 } from 'lucide-react';

interface HeaderProps {
  activeTab: 'local' | 'youtube' | 'preset' | 'cache';
  setActiveTab: (tab: 'local' | 'youtube' | 'preset' | 'cache') => void;
  trackTitle?: string;
  isPlaying: boolean;
  cacheCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  trackTitle,
  isPlaying,
  cacheCount,
}) => {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur px-4 py-3 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Track Info */}
        <div className="flex items-center gap-3.5 w-full md:w-auto">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-600/30 border border-amber-500/40 text-amber-400 shadow-inner">
            <Disc3 className={`w-5 h-5 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
            {isPlaying && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-zinc-950 animate-pulse" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-zinc-100 text-lg">FretEar</span>
              <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400/90 font-semibold border border-amber-500/30 px-1.5 py-0.5 rounded bg-amber-500/10">
                Guitar Ear Trainer
              </span>
            </div>
            <p className="text-xs text-zinc-400 truncate max-w-xs md:max-w-md font-mono">
              {trackTitle ? (
                <span className="text-zinc-300 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0 inline" />
                  <span className="truncate">{trackTitle}</span>
                </span>
              ) : (
                'Load a track or select a guitar preset to begin'
              )}
            </p>
          </div>
        </div>

        {/* Source Navigation Tabs */}
        <div className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-800/80 p-1 rounded-lg w-full md:w-auto overflow-x-auto text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('local')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition cursor-pointer shrink-0 ${
              activeTab === 'local'
                ? 'bg-zinc-800 text-amber-400 shadow-sm border border-zinc-700/60 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Local Audio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('youtube')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition cursor-pointer shrink-0 ${
              activeTab === 'youtube'
                ? 'bg-zinc-800 text-red-400 shadow-sm border border-zinc-700/60 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            <Youtube className="w-3.5 h-3.5 text-red-500" />
            <span>YouTube Stream</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preset')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition cursor-pointer shrink-0 ${
              activeTab === 'preset'
                ? 'bg-zinc-800 text-cyan-400 shadow-sm border border-zinc-700/60 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Guitar Presets</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cache')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition cursor-pointer shrink-0 ${
              activeTab === 'cache'
                ? 'bg-zinc-800 text-emerald-400 shadow-sm border border-zinc-700/60 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cache {cacheCount > 0 && `(${cacheCount})`}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
