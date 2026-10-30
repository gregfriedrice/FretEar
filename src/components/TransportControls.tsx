import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Repeat,
  Square,
  BookmarkPlus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Music2,
  ShieldCheck,
} from 'lucide-react';
import { LoopRegion } from '../types';
import { formatTimecode, formatRatePercent } from '../utils/formatters';

interface TransportControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onJumpBackward: () => void;
  onJumpForward: () => void;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  isLoopActive: boolean;
  onToggleLoop: () => void;
  loopRegion: LoopRegion | null;
  onSetPointA: () => void;
  onSetPointB: () => void;
  onNudgePointA: (delta: number) => void;
  onNudgePointB: (delta: number) => void;
  onClearLoop: () => void;
  onOpenSaveModal: () => void;
  currentTime: number;
}

const SPEED_PRESETS = [0.25, 0.5, 0.65, 0.75, 0.85, 0.9, 1.0, 1.25];

export const TransportControls: React.FC<TransportControlsProps> = ({
  isPlaying,
  onPlayPause,
  onStop,
  onJumpBackward,
  onJumpForward,
  playbackRate,
  onPlaybackRateChange,
  isLoopActive,
  onToggleLoop,
  loopRegion,
  onSetPointA,
  onSetPointB,
  onNudgePointA,
  onNudgePointB,
  onClearLoop,
  onOpenSaveModal,
  currentTime,
}) => {
  const handleStepRate = (delta: number) => {
    const newRate = Math.round((playbackRate + delta) * 100) / 100;
    const clamped = Math.max(0.25, Math.min(2.0, newRate));
    onPlaybackRateChange(clamped);
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 shadow-xl space-y-4">
      {/* Top Deck: Primary Playback & Looping Racks */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Playback Transport Buttons (Cols 1-5) */}
        <div className="lg:col-span-5 flex items-center justify-between sm:justify-start gap-2 sm:gap-3 bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800/90 shadow-inner">
          {/* Stop / Reset */}
          <button
            type="button"
            onClick={onStop}
            className="p-2.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition cursor-pointer"
            title="Stop & Reset to Start"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>

          {/* Jump Backward -2s */}
          <button
            type="button"
            onClick={onJumpBackward}
            className="flex items-center gap-1 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 rounded-lg text-xs font-mono text-zinc-200 transition cursor-pointer"
            title="Jump Back 2s (Left Arrow)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>-2s</span>
          </button>

          {/* Big Play / Pause Primary Button */}
          <button
            type="button"
            onClick={onPlayPause}
            className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition shadow-lg cursor-pointer ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-amber-500/20 ring-2 ring-amber-400/50'
                : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-emerald-500/20'
            }`}
            title="Play / Pause (Space)"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>PAUSE</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>PLAY</span>
              </>
            )}
          </button>

          {/* Jump Forward +2s */}
          <button
            type="button"
            onClick={onJumpForward}
            className="flex items-center gap-1 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 rounded-lg text-xs font-mono text-zinc-200 transition cursor-pointer"
            title="Jump Forward 2s (Right Arrow)"
          >
            <span>+2s</span>
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* A/B Looping Cockpit (Cols 6-12) */}
        <div className="lg:col-span-7 flex flex-wrap items-center justify-between gap-2.5 bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800/90 shadow-inner">
          {/* Point A Control */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onSetPointA}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-mono font-bold transition cursor-pointer"
              title="Set Point A to Current Playhead ([)"
            >
              <span>Set [A]</span>
            </button>
            {loopRegion && (
              <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg px-1 text-zinc-400 font-mono text-[11px]">
                <button
                  type="button"
                  onClick={() => onNudgePointA(-0.1)}
                  className="px-1 py-1 hover:text-amber-400 cursor-pointer"
                  title="Nudge A -100ms"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <span className="px-1 text-zinc-200 font-semibold">
                  {formatTimecode(loopRegion.start)}
                </span>
                <button
                  type="button"
                  onClick={() => onNudgePointA(0.1)}
                  className="px-1 py-1 hover:text-amber-400 cursor-pointer"
                  title="Nudge A +100ms"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Point B Control */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onSetPointB}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-mono font-bold transition cursor-pointer"
              title="Set Point B to Current Playhead (])"
            >
              <span>Set [B]</span>
            </button>
            {loopRegion && (
              <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg px-1 text-zinc-400 font-mono text-[11px]">
                <button
                  type="button"
                  onClick={() => onNudgePointB(-0.1)}
                  className="px-1 py-1 hover:text-amber-400 cursor-pointer"
                  title="Nudge B -100ms"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <span className="px-1 text-zinc-200 font-semibold">
                  {formatTimecode(loopRegion.end)}
                </span>
                <button
                  type="button"
                  onClick={() => onNudgePointB(0.1)}
                  className="px-1 py-1 hover:text-amber-400 cursor-pointer"
                  title="Nudge B +100ms"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Loop Active Toggle */}
          <button
            type="button"
            onClick={onToggleLoop}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
              isLoopActive
                ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-md shadow-amber-500/20 ring-2 ring-amber-400/40'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-700/80'
            }`}
            title="Toggle Repeat Loop (L)"
          >
            <Repeat className={`w-3.5 h-3.5 ${isLoopActive ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
            <span>{isLoopActive ? 'LOOP ON' : 'LOOP OFF'}</span>
          </button>

          {/* Clear Loop */}
          {loopRegion && (
            <button
              type="button"
              onClick={onClearLoop}
              className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition cursor-pointer"
              title="Clear Loop Region (Escape)"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Bookmark Section */}
          <button
            type="button"
            onClick={onOpenSaveModal}
            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold transition cursor-pointer ml-auto"
            title="Bookmark Current Phrase (S)"
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-amber-400" />
            <span>Save Phrase</span>
          </button>
        </div>
      </div>

      {/* Bottom Deck: Continuous Variable Pitch-Preserved Speed Engine */}
      <div className="bg-zinc-950/80 p-3.5 rounded-xl border border-zinc-800/90 space-y-2.5 shadow-inner">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Label & Pitch Lock Status */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
              <Gauge className="w-4 h-4 text-amber-400" />
              <span>Playback Tempo</span>
            </div>

            {/* Pitch preservation badge */}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-mono text-emerald-400">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Pitch Lock (Original Key Kept)</span>
            </div>
          </div>

          {/* Step Controls (-5% / +5%) & Readout */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleStepRate(-0.05)}
              className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded text-xs font-mono font-bold text-zinc-300 transition cursor-pointer"
              title="Slow down 5% (-)"
            >
              -5%
            </button>

            <span className="font-mono text-base font-bold text-amber-400 w-14 text-center">
              {formatRatePercent(playbackRate)}
            </span>

            <button
              type="button"
              onClick={() => handleStepRate(0.05)}
              className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded text-xs font-mono font-bold text-zinc-300 transition cursor-pointer"
              title="Speed up 5% (+)"
            >
              +5%
            </button>
          </div>
        </div>

        {/* Continuous Slider & Speed Preset Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Slider */}
          <div className="md:col-span-5 flex items-center gap-3">
            <span className="text-[11px] font-mono text-zinc-500">25%</span>
            <input
              type="range"
              min="0.25"
              max="2.0"
              step="0.01"
              value={playbackRate}
              onChange={(e) => onPlaybackRateChange(parseFloat(e.target.value))}
              className="flex-1 accent-amber-500 h-2 bg-zinc-800 rounded-lg cursor-pointer"
            />
            <span className="text-[11px] font-mono text-zinc-500">200%</span>
          </div>

          {/* Quick Presets */}
          <div className="md:col-span-7 flex flex-wrap items-center justify-end gap-1.5">
            {SPEED_PRESETS.map((preset) => {
              const isSelected = Math.abs(playbackRate - preset) < 0.01;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onPlaybackRateChange(preset)}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-zinc-950 font-bold border border-amber-400 shadow-sm'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
                  }`}
                >
                  {formatRatePercent(preset)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
