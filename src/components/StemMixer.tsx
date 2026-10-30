import React, { useState, useEffect, useRef } from 'react';
import {
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Sparkles,
  Loader2,
  Disc,
  Radio,
  CheckCircle,
  Headphones,
  Music4,
  Flame,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { StemInfo, TrackStems, Track } from '../types';

interface StemMixerProps {
  track: Track;
  isPlaying: boolean;
  currentTime: number;
  playbackRate: number;
  onStemMixChange?: (stemLevels: Record<string, number>) => void;
  audioElementRef?: HTMLAudioElement | null;
}

const DEFAULT_STEMS: Record<'guitar' | 'backing' | 'bass' | 'drums', StemInfo> = {
  guitar: {
    id: 'guitar',
    name: 'Lead Guitar',
    url: '',
    volume: 1.0,
    isMuted: false,
    isSolo: false,
    color: '#f59e0b', // amber
    icon: '🎸',
  },
  backing: {
    id: 'backing',
    name: 'Backing Band (Minus Guitar)',
    url: '',
    volume: 1.0,
    isMuted: false,
    isSolo: false,
    color: '#06b6d4', // cyan
    icon: '🎹',
  },
  bass: {
    id: 'bass',
    name: 'Bass Line',
    url: '',
    volume: 1.0,
    isMuted: false,
    isSolo: false,
    color: '#10b981', // emerald
    icon: '🎸',
  },
  drums: {
    id: 'drums',
    name: 'Drums & Percussion',
    url: '',
    volume: 1.0,
    isMuted: false,
    isSolo: false,
    color: '#ec4899', // pink
    icon: '🥁',
  },
};

export const StemMixer: React.FC<StemMixerProps> = ({
  track,
  isPlaying,
  currentTime,
  playbackRate,
}) => {
  const [isSeparated, setIsSeparated] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [stems, setStems] = useState<Record<string, StemInfo>>(DEFAULT_STEMS);
  const [activePreset, setActivePreset] = useState<'full' | 'guitar_solo' | 'jam_backing' | 'rhythm'>('full');
  const [isExpanded, setIsExpanded] = useState(true);

  // Audio elements for each stem
  const stemAudiosRef = useRef<Record<string, HTMLAudioElement>>({});

  // Check if track stems already exist in cache
  useEffect(() => {
    let isMounted = true;
    const checkStems = async () => {
      try {
        const res = await fetch(`/api/stems/${encodeURIComponent(track.id)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.isSeparated && data.stems && isMounted) {
            setIsSeparated(true);
            setStems((prev) => ({
              guitar: { ...prev.guitar, url: data.stems.guitar.url },
              backing: { ...prev.backing, url: data.stems.backing.url },
              bass: { ...prev.bass, url: data.stems.bass.url },
              drums: { ...prev.drums, url: data.stems.drums.url },
            }));
          } else if (isMounted) {
            setIsSeparated(false);
          }
        }
      } catch (e) {
        // ignore
      }
    };

    checkStems();
    return () => {
      isMounted = false;
      // Clean up audio elements
      Object.values(stemAudiosRef.current).forEach((aud) => {
        aud.pause();
        aud.src = '';
      });
      stemAudiosRef.current = {};
    };
  }, [track.id]);

  // Synchronize audio playback across stems
  useEffect(() => {
    if (!isSeparated) return;

    Object.entries(stems).forEach(([id, stem]) => {
      if (!stem.url) return;
      let aud = stemAudiosRef.current[id];
      if (!aud) {
        aud = new Audio(stem.url);
        aud.preservesPitch = true;
        (aud as any).mozPreservesPitch = true;
        (aud as any).webkitPreservesPitch = true;
        stemAudiosRef.current[id] = aud;
      }

      // Check solo condition
      const anySolo = Object.values(stems).some((s) => s.isSolo);
      let targetVolume = stem.volume;
      if (anySolo) {
        targetVolume = stem.isSolo ? stem.volume : 0;
      } else if (stem.isMuted) {
        targetVolume = 0;
      }

      aud.volume = Math.max(0, Math.min(1, targetVolume));
      aud.playbackRate = playbackRate;
    });
  }, [stems, isSeparated, playbackRate]);

  // Sync play/pause and time alignment with master
  useEffect(() => {
    if (!isSeparated) return;

    Object.values(stemAudiosRef.current).forEach((aud) => {
      // Time sync if drift > 0.15s
      if (Math.abs(aud.currentTime - currentTime) > 0.15) {
        aud.currentTime = currentTime;
      }

      if (isPlaying && aud.paused) {
        aud.play().catch(() => {});
      } else if (!isPlaying && !aud.paused) {
        aud.pause();
      }
    });
  }, [isPlaying, currentTime, isSeparated]);

  // Request Stem Separation
  const handleSeparateStems = async () => {
    setIsProcessing(true);
    setProgressMsg('Extracting high-resolution multi-track stems...');

    try {
      // If it's a local file or preset with blob, upload to server cache first
      if (track.blob) {
        setProgressMsg('Uploading audio buffer to DSP stem engine...');
        await fetch(`/api/upload-for-stems?trackId=${encodeURIComponent(track.id)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: track.blob,
        });
      }

      setProgressMsg('Demixing Lead Guitar, Backing Track, Bass, & Drums with FFmpeg...');

      const res = await fetch('/api/stems/separate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to separate stems.');
      }

      setStems((prev) => ({
        guitar: { ...prev.guitar, url: data.stems.guitar.url },
        backing: { ...prev.backing, url: data.stems.backing.url },
        bass: { ...prev.bass, url: data.stems.bass.url },
        drums: { ...prev.drums, url: data.stems.drums.url },
      }));

      setIsSeparated(true);
      setProgressMsg('Separation complete! 4 multi-track stems ready.');
      setTimeout(() => setProgressMsg(null), 3500);
    } catch (err: any) {
      alert(`Stem separation error: ${err.message}`);
      setProgressMsg(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle Solo
  const handleToggleSolo = (id: string) => {
    setStems((prev) => {
      const isCurrentlySolo = prev[id]?.isSolo;
      return {
        ...prev,
        [id]: {
          ...prev[id],
          isSolo: !isCurrentlySolo,
        },
      };
    });
    setActivePreset('full');
  };

  // Toggle Mute
  const handleToggleMute = (id: string) => {
    setStems((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        isMuted: !prev[id].isMuted,
      },
    }));
    setActivePreset('full');
  };

  // Change Volume
  const handleVolumeChange = (id: string, vol: number) => {
    setStems((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        volume: vol,
      },
    }));
  };

  // Preset Handlers
  const applyPreset = (preset: 'full' | 'guitar_solo' | 'jam_backing' | 'rhythm') => {
    setActivePreset(preset);
    if (preset === 'full') {
      setStems((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          next[k] = { ...next[k], isSolo: false, isMuted: false, volume: 1.0 };
        });
        return next;
      });
    } else if (preset === 'guitar_solo') {
      // Solo guitar
      setStems((prev) => ({
        guitar: { ...prev.guitar, isSolo: true, isMuted: false, volume: 1.0 },
        backing: { ...prev.backing, isSolo: false, isMuted: true, volume: 0 },
        bass: { ...prev.bass, isSolo: false, isMuted: true, volume: 0 },
        drums: { ...prev.drums, isSolo: false, isMuted: true, volume: 0 },
      }));
    } else if (preset === 'jam_backing') {
      // Mute guitar, keep band
      setStems((prev) => ({
        guitar: { ...prev.guitar, isSolo: false, isMuted: true, volume: 0 },
        backing: { ...prev.backing, isSolo: false, isMuted: false, volume: 1.0 },
        bass: { ...prev.bass, isSolo: false, isMuted: false, volume: 1.0 },
        drums: { ...prev.drums, isSolo: false, isMuted: false, volume: 1.0 },
      }));
    } else if (preset === 'rhythm') {
      // Drums and bass only
      setStems((prev) => ({
        guitar: { ...prev.guitar, isSolo: false, isMuted: true, volume: 0 },
        backing: { ...prev.backing, isSolo: false, isMuted: true, volume: 0 },
        bass: { ...prev.bass, isSolo: false, isMuted: false, volume: 1.0 },
        drums: { ...prev.drums, isSolo: false, isMuted: false, volume: 1.0 },
      }));
    }
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden shadow-xl transition-all">
      {/* Console Top Header */}
      <div className="bg-zinc-950/90 px-4 py-3 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-100 tracking-tight">
                AI Stem Separation & Multi-Track Mixer
              </h3>
              {isSeparated && (
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Stems Active
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 font-mono">
              Isolate lead guitar to transcribe phrase-by-phrase, or mute guitar to jam along with the band.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isSeparated ? (
            <button
              type="button"
              onClick={handleSeparateStems}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 text-xs font-bold rounded-lg shadow-md transition cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Demixing Audio...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Separate Stems</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/60 cursor-pointer"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Progress banner */}
      {progressMsg && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2 text-xs font-mono text-amber-300">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-amber-400" />
          <span>{progressMsg}</span>
        </div>
      )}

      {/* Main Channel Strips Rack */}
      {isSeparated && isExpanded && (
        <div className="p-4 space-y-4">
          {/* Quick Practice Mode Presets */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80">
            <span className="text-xs font-mono text-zinc-400 font-medium">
              Quick Ear-Training Modes:
            </span>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyPreset('guitar_solo')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-semibold transition cursor-pointer border ${
                  activePreset === 'guitar_solo'
                    ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-amber-400 border-zinc-800'
                }`}
                title="Isolate lead guitar only so every note and bend is audible"
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>Solo Guitar (Transcribe)</span>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('jam_backing')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-semibold transition cursor-pointer border ${
                  activePreset === 'jam_backing'
                    ? 'bg-cyan-500 text-zinc-950 border-cyan-400 shadow'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-cyan-400 border-zinc-800'
                }`}
                title="Mute original lead guitar and jam over the rest of the band"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Backing Jam (Minus Guitar)</span>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('rhythm')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-semibold transition cursor-pointer border ${
                  activePreset === 'rhythm'
                    ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border-zinc-800'
                }`}
                title="Listen to drums and bass only for tight pocket timing"
              >
                <Music4 className="w-3.5 h-3.5" />
                <span>Rhythm Section</span>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('full')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-semibold transition cursor-pointer border ${
                  activePreset === 'full'
                    ? 'bg-zinc-700 text-white border-zinc-600'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Full Mix</span>
              </button>
            </div>
          </div>

          {/* 4 Channel Strips Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.values(stems).map((stem) => {
              const isEffectiveMuted =
                stem.isMuted ||
                (Object.values(stems).some((s) => s.isSolo) && !stem.isSolo);

              return (
                <div
                  key={stem.id}
                  className={`bg-zinc-950 border rounded-xl p-3.5 transition flex flex-col justify-between ${
                    stem.isSolo
                      ? 'border-amber-500/80 shadow-md shadow-amber-500/10 ring-1 ring-amber-500/30'
                      : 'border-zinc-800/90'
                  }`}
                  style={{ borderTopWidth: '3px', borderTopColor: stem.color }}
                >
                  {/* Stem Title & Icon */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{stem.icon}</span>
                        <h4 className="font-bold text-xs text-zinc-200 tracking-tight">
                          {stem.name}
                        </h4>
                      </div>
                      <span className="font-mono text-[11px] text-zinc-400 font-bold">
                        {isEffectiveMuted ? 'MUTED' : `${Math.round(stem.volume * 100)}%`}
                      </span>
                    </div>

                    {/* Mute & Solo Buttons */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => handleToggleMute(stem.id)}
                        className={`py-1.5 rounded text-xs font-mono font-bold transition cursor-pointer border flex items-center justify-center gap-1 ${
                          stem.isMuted
                            ? 'bg-red-500 text-white border-red-400 shadow-sm'
                            : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-800'
                        }`}
                      >
                        {stem.isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        <span>MUTE</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleSolo(stem.id)}
                        className={`py-1.5 rounded text-xs font-mono font-bold transition cursor-pointer border flex items-center justify-center gap-1 ${
                          stem.isSolo
                            ? 'bg-amber-400 text-zinc-950 border-amber-300 shadow-sm ring-1 ring-amber-300'
                            : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-800'
                        }`}
                      >
                        <Radio className="w-3.5 h-3.5" />
                        <span>SOLO</span>
                      </button>
                    </div>
                  </div>

                  {/* Volume Slider */}
                  <div className="space-y-1 pt-1 border-t border-zinc-800/80">
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                      <span>Volume</span>
                      <span>{Math.round(stem.volume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={stem.volume}
                      onChange={(e) => handleVolumeChange(stem.id, parseFloat(e.target.value))}
                      className="w-full accent-amber-500 h-1.5 bg-zinc-800 rounded cursor-pointer"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
