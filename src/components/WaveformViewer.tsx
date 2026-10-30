import React, { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js';
import HoverPlugin from 'wavesurfer.js/dist/plugins/hover.esm.js';
import { ZoomIn, ZoomOut, Maximize2, Repeat, Scissors, Clock } from 'lucide-react';
import { LoopRegion } from '../types';
import { formatTimecode } from '../utils/formatters';

interface WaveformViewerProps {
  audioUrl: string;
  playbackRate: number;
  isLoopActive: boolean;
  loopRegion: LoopRegion | null;
  onLoopRegionChange: (region: LoopRegion | null) => void;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  duration: number;
  setDuration: (duration: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  onWaveSurferReady?: (ws: WaveSurfer) => void;
}

export const WaveformViewer: React.FC<WaveformViewerProps> = ({
  audioUrl,
  playbackRate,
  isLoopActive,
  loopRegion,
  onLoopRegionChange,
  currentTime,
  setCurrentTime,
  duration,
  setDuration,
  isPlaying,
  setIsPlaying,
  onWaveSurferReady,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const regionsPluginRef = useRef<any>(null);
  const activeRegionRef = useRef<any>(null);

  const [zoomLevel, setZoomLevel] = useState<number>(30); // px per second
  const [isReady, setIsReady] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current || !timelineRef.current || !audioUrl) return;

    setIsReady(false);

    // Create regions plugin
    const wsRegions = RegionsPlugin.create();
    regionsPluginRef.current = wsRegions;

    // Create timeline plugin
    const wsTimeline = TimelinePlugin.create({
      container: timelineRef.current,
      timeInterval: 1,
      primaryLabelInterval: 5,
      secondaryLabelInterval: 1,
      style: {
        fontSize: '10px',
        color: '#71717a',
        fontFamily: 'JetBrains Mono, monospace',
      },
    });

    // Create hover plugin
    const wsHover = HoverPlugin.create({
      lineColor: '#f59e0b',
      lineWidth: 2,
      labelBackground: '#18181b',
      labelColor: '#f4f4f5',
      labelSize: '11px',
    });

    const ws = WaveSurfer.create({
      container: containerRef.current,
      url: audioUrl,
      waveColor: '#38bdf8',
      progressColor: '#f59e0b',
      cursorColor: '#f97316',
      cursorWidth: 2,
      height: 120,
      barWidth: 2,
      barGap: 1.5,
      barRadius: 2,
      minPxPerSec: zoomLevel,
      plugins: [wsRegions, wsTimeline, wsHover],
    });

    waveSurferRef.current = ws;

    ws.on('ready', () => {
      const dur = ws.getDuration();
      setDuration(dur);
      setIsReady(true);
      // Ensure pitch is preserved on the audio element
      const media = ws.getMediaElement();
      if (media) {
        media.preservesPitch = true;
        (media as any).mozPreservesPitch = true;
        (media as any).webkitPreservesPitch = true;
      }
      ws.setPlaybackRate(playbackRate, true);
      if (onWaveSurferReady) {
        onWaveSurferReady(ws);
      }
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => {
      setIsPlaying(false);
      if (isLoopActive && loopRegion) {
        ws.setTime(loopRegion.start);
        ws.play();
      }
    });

    // Real-time timecode updates and strict A/B loop enforcement
    ws.on('timeupdate', (time) => {
      setCurrentTime(time);
      if (isLoopActive && loopRegion && loopRegion.end > loopRegion.start) {
        if (time >= loopRegion.end || time < loopRegion.start - 0.25) {
          ws.setTime(loopRegion.start);
        }
      }
    });

    ws.on('seeking', (time) => {
      setCurrentTime(time);
    });

    // Region drag / resize updates
    wsRegions.on('region-updated', (region: any) => {
      if (region.id === 'ab-loop') {
        onLoopRegionChange({
          start: region.start,
          end: region.end,
          active: isLoopActive,
        });
      }
    });

    return () => {
      ws.destroy();
      waveSurferRef.current = null;
      regionsPluginRef.current = null;
      activeRegionRef.current = null;
    };
  }, [audioUrl]);

  // Sync playback rate with pitch preservation
  useEffect(() => {
    if (waveSurferRef.current && isReady) {
      const media = waveSurferRef.current.getMediaElement();
      if (media) {
        media.preservesPitch = true;
      }
      waveSurferRef.current.setPlaybackRate(playbackRate, true);
    }
  }, [playbackRate, isReady]);

  // Sync zoom level
  useEffect(() => {
    if (waveSurferRef.current && isReady) {
      waveSurferRef.current.zoom(zoomLevel);
    }
  }, [zoomLevel, isReady]);

  // Sync A/B Loop region visually in WaveSurfer Regions Plugin
  useEffect(() => {
    const wsRegions = regionsPluginRef.current;
    if (!wsRegions || !isReady) return;

    if (!loopRegion) {
      // Clear visual region
      if (activeRegionRef.current) {
        activeRegionRef.current.remove();
        activeRegionRef.current = null;
      }
      return;
    }

    const { start, end } = loopRegion;
    if (start >= end) return;

    if (activeRegionRef.current) {
      // Update existing
      activeRegionRef.current.setOptions({
        start,
        end,
        color: isLoopActive ? 'rgba(245, 158, 11, 0.28)' : 'rgba(113, 113, 122, 0.22)',
      });
    } else {
      // Add new region
      activeRegionRef.current = wsRegions.addRegion({
        id: 'ab-loop',
        start,
        end,
        color: isLoopActive ? 'rgba(245, 158, 11, 0.28)' : 'rgba(113, 113, 122, 0.22)',
        drag: true,
        resize: true,
      });
    }
  }, [loopRegion, isLoopActive, isReady]);

  const handleZoomChange = (newZoom: number) => {
    const clamped = Math.max(10, Math.min(250, newZoom));
    setZoomLevel(clamped);
  };

  const handleZoomFit = () => {
    if (!containerRef.current || duration <= 0) return;
    const width = containerRef.current.clientWidth;
    const fitZoom = Math.max(10, Math.floor(width / duration));
    setZoomLevel(fitZoom);
  };

  const loopDuration = loopRegion && loopRegion.end > loopRegion.start
    ? loopRegion.end - loopRegion.start
    : 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl relative">
      {/* Studio Header Bar: LCD Displays & Waveform Toolbar */}
      <div className="bg-zinc-950/80 px-4 py-3 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        {/* Real-time Digital Timecode Display */}
        <div className="flex items-center gap-4">
          <div className="bg-black/90 border border-zinc-800/90 rounded-lg px-3.5 py-1.5 flex items-center gap-3 shadow-inner">
            <div>
              <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-500 block leading-tight">
                Position
              </span>
              <span className="font-mono text-xl font-bold tracking-tight text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.4)]">
                {formatTimecode(currentTime)}
              </span>
            </div>
            <div className="h-7 w-[1px] bg-zinc-800" />
            <div>
              <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-500 block leading-tight">
                Total
              </span>
              <span className="font-mono text-sm font-semibold tracking-tight text-zinc-400">
                {formatTimecode(duration, false)}
              </span>
            </div>
          </div>

          {/* Loop A/B Range Indicator */}
          {loopRegion && (
            <div className="hidden sm:flex items-center gap-2 bg-zinc-950 border border-amber-500/30 px-3 py-1.5 rounded-lg shadow-inner">
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-amber-400 font-bold">A:</span>
                <span className="text-zinc-200">{formatTimecode(loopRegion.start)}</span>
                <span className="text-zinc-600">→</span>
                <span className="text-amber-400 font-bold">B:</span>
                <span className="text-zinc-200">{formatTimecode(loopRegion.end)}</span>
              </div>
              <span className="text-[11px] font-mono text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                Δ {loopDuration.toFixed(2)}s
              </span>
              <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                isLoopActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
              }`}>
                {isLoopActive ? 'Loop ON' : 'Loop OFF'}
              </span>
            </div>
          )}
        </div>

        {/* Zoom & View Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-lg p-1">
            <button
              type="button"
              onClick={() => handleZoomChange(zoomLevel - 15)}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition cursor-pointer"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <input
              type="range"
              min="10"
              max="200"
              step="5"
              value={zoomLevel}
              onChange={(e) => handleZoomChange(Number(e.target.value))}
              className="w-20 md:w-28 accent-amber-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
              title={`Zoom: ${zoomLevel} px/sec`}
            />
            <button
              type="button"
              onClick={() => handleZoomChange(zoomLevel + 15)}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition cursor-pointer"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleZoomFit}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-300 transition cursor-pointer"
            title="Fit Waveform to Width"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Fit</span>
          </button>
        </div>
      </div>

      {/* Main Waveform Canvas & Ruler Container */}
      <div className="relative p-4 bg-zinc-950/40">
        {/* Timeline ruler */}
        <div ref={timelineRef} className="w-full mb-1 opacity-80" />

        {/* WaveSurfer canvas container */}
        <div
          ref={containerRef}
          className="w-full relative cursor-pointer select-none rounded overflow-hidden"
          style={{ minHeight: '120px' }}
        />

        {/* Loading overlay */}
        {!isReady && (
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-20">
            <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono text-zinc-400">
              Generating interactive waveform & audio buffer...
            </span>
          </div>
        )}
      </div>

      {/* Quick A/B boundary helper cues */}
      <div className="px-4 py-2 bg-zinc-950/90 border-t border-zinc-800/80 flex flex-wrap items-center justify-between text-[11px] font-mono text-zinc-500">
        <div className="flex items-center gap-3">
          <span>Click / drag waveform to scrub</span>
          <span>•</span>
          <span>Drag amber handles to resize A/B phrase loop</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Speed: <strong className="text-amber-400">{(playbackRate * 100).toFixed(0)}%</strong></span>
          <span>•</span>
          <span className="text-emerald-400 font-semibold">Tuning Lock Active</span>
        </div>
      </div>
    </div>
  );
};
