import React, { useState, useEffect, useRef, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Header } from './components/Header';
import { SourceSelector } from './components/SourceSelector';
import { WaveformViewer } from './components/WaveformViewer';
import { TransportControls } from './components/TransportControls';
import { StemMixer } from './components/StemMixer';
import { SectionsManager } from './components/SectionsManager';
import { KeyboardCheatSheet } from './components/KeyboardCheatSheet';
import { AudioVUMeter } from './components/AudioVUMeter';
import { Track, PhraseSection, LoopRegion } from './types';
import { GUITAR_PRESETS, generatePresetAudio } from './utils/audioSynthesizer';

export default function App() {
  const [activeTab, setActiveTab] = useState<'local' | 'youtube' | 'preset' | 'cache'>('preset');
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isLoopActive, setIsLoopActive] = useState(true);
  const [loopRegion, setLoopRegion] = useState<LoopRegion | null>(null);
  const [sections, setSections] = useState<PhraseSection[]>([]);
  const [cachedTracks, setCachedTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());

  const waveSurferRef = useRef<WaveSurfer | null>(null);

  // Fetch cached tracks on mount
  const fetchCachedTracks = useCallback(async () => {
    try {
      const res = await fetch('/api/cached-tracks');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.tracks)) {
          setCachedTracks(data.tracks);
        }
      }
    } catch (err) {
      console.warn('Could not fetch cached tracks:', err);
    }
  }, []);

  useEffect(() => {
    fetchCachedTracks();
  }, [fetchCachedTracks]);

  // Initial load: automatically load first guitar preset for immediate gratification
  useEffect(() => {
    const initDefaultPreset = async () => {
      try {
        setIsLoading(true);
        const defaultPreset = GUITAR_PRESETS[0];
        const wavBlob = await generatePresetAudio(defaultPreset.id);
        const audioUrl = URL.createObjectURL(wavBlob);
        const track: Track = {
          id: defaultPreset.id,
          title: defaultPreset.title,
          sourceType: 'preset',
          duration: 16,
          durationFormatted: '00:16',
          audioUrl,
          blob: wavBlob,
        };
        handleTrackLoaded(track, defaultPreset.suggestedPhrases);
      } catch (err) {
        console.error('Failed to init default preset:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initDefaultPreset();
  }, []);

  // Load saved phrases from localStorage whenever currentTrack changes
  useEffect(() => {
    if (!currentTrack) return;
    const storageKey = `fretear_phrases_${currentTrack.id}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSections(parsed);
          return;
        }
      } catch (e) {
        // ignore
      }
    }
  }, [currentTrack]);

  // Save phrases to localStorage whenever sections change
  const saveSectionsToStorage = (newSections: PhraseSection[]) => {
    setSections(newSections);
    if (currentTrack) {
      const storageKey = `fretear_phrases_${currentTrack.id}`;
      localStorage.setItem(storageKey, JSON.stringify(newSections));
    }
  };

  // Handle new track loaded
  const handleTrackLoaded = (
    track: Track,
    suggestedPhrases?: { name: string; start: number; end: number; notes: string }[]
  ) => {
    setCurrentTrack(track);
    setCurrentTime(0);
    setIsPlaying(false);

    // Initial loop region
    if (suggestedPhrases && suggestedPhrases.length > 0) {
      const first = suggestedPhrases[0];
      setLoopRegion({
        start: first.start,
        end: first.end,
        active: true,
      });

      const initialSections: PhraseSection[] = suggestedPhrases.map((sp, idx) => ({
        id: `phrase_${Date.now()}_${idx}`,
        trackId: track.id,
        name: sp.name,
        start: sp.start,
        end: sp.end,
        color: idx === 0 ? '#f59e0b' : idx === 1 ? '#06b6d4' : '#10b981',
        notes: sp.notes,
        createdAt: Date.now() + idx,
      }));
      setSections(initialSections);
    } else {
      // Default initial 4-second loop
      setLoopRegion({
        start: 0,
        end: Math.min(4, track.duration || 4),
        active: true,
      });
      // Check local storage
      const storageKey = `fretear_phrases_${track.id}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          setSections(JSON.parse(saved));
        } catch (e) {
          setSections([]);
        }
      } else {
        setSections([]);
      }
    }
  };

  // Playback handlers
  const handlePlayPause = () => {
    if (!waveSurferRef.current) return;
    waveSurferRef.current.playPause();
  };

  const handleStop = () => {
    if (!waveSurferRef.current) return;
    waveSurferRef.current.stop();
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleJumpBackward = () => {
    if (!waveSurferRef.current) return;
    const target = Math.max(0, currentTime - 2);
    waveSurferRef.current.setTime(target);
  };

  const handleJumpForward = () => {
    if (!waveSurferRef.current) return;
    const target = Math.min(duration, currentTime + 2);
    waveSurferRef.current.setTime(target);
  };

  // Looping Handlers
  const handleSetPointA = () => {
    const start = currentTime;
    let end = loopRegion ? loopRegion.end : Math.min(duration, start + 3);
    if (end <= start) {
      end = Math.min(duration, start + 2);
    }
    setLoopRegion({
      start,
      end,
      active: true,
    });
    setIsLoopActive(true);
  };

  const handleSetPointB = () => {
    const end = currentTime;
    let start = loopRegion ? loopRegion.start : Math.max(0, end - 3);
    if (start >= end) {
      start = Math.max(0, end - 2);
    }
    setLoopRegion({
      start,
      end,
      active: true,
    });
    setIsLoopActive(true);
  };

  const handleToggleLoop = () => {
    setIsLoopActive((prev) => !prev);
  };

  const handleClearLoop = () => {
    setLoopRegion(null);
    setIsLoopActive(false);
  };

  const handleNudgePointA = (delta: number) => {
    if (!loopRegion) return;
    const newStart = Math.max(0, Math.min(loopRegion.end - 0.2, loopRegion.start + delta));
    setLoopRegion({
      ...loopRegion,
      start: Math.round(newStart * 100) / 100,
    });
  };

  const handleNudgePointB = (delta: number) => {
    if (!loopRegion) return;
    const newEnd = Math.min(duration, Math.max(loopRegion.start + 0.2, loopRegion.end + delta));
    setLoopRegion({
      ...loopRegion,
      end: Math.round(newEnd * 100) / 100,
    });
  };

  // Section bookmarking handlers
  const handleSaveNewSection = (name: string, notes?: string, color = '#f59e0b') => {
    if (!loopRegion || !currentTrack) return;
    const newSection: PhraseSection = {
      id: `section_${Date.now()}`,
      trackId: currentTrack.id,
      name,
      start: loopRegion.start,
      end: loopRegion.end,
      color,
      notes,
      createdAt: Date.now(),
    };
    saveSectionsToStorage([...sections, newSection]);
  };

  const handleDeleteSection = (id: string) => {
    saveSectionsToStorage(sections.filter((s) => s.id !== id));
  };

  const handleSelectSection = (section: PhraseSection) => {
    setLoopRegion({
      start: section.start,
      end: section.end,
      active: true,
    });
    setIsLoopActive(true);

    if (waveSurferRef.current) {
      waveSurferRef.current.setTime(section.start);
      if (!waveSurferRef.current.isPlaying()) {
        waveSurferRef.current.play();
      }
    }
  };

  const handleImportSections = (imported: PhraseSection[]) => {
    saveSectionsToStorage(imported);
  };

  const handleDeleteCachedTrack = async (id: string) => {
    try {
      await fetch(`/api/cached-tracks/${id}`, { method: 'DELETE' });
      fetchCachedTracks();
    } catch (e) {
      console.error('Failed to delete cached track:', e);
    }
  };

  // Guitarist Hands-Free Keyboard Shortcut Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Input isolation: suppress all shortcuts if typing in text inputs or modals
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Add to active keys set for HUD lighting
      setActiveKeys((prev) => new Set(prev).add(e.key));

      switch (e.key) {
        case ' ':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleJumpBackward();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleJumpForward();
          break;
        case '[':
          e.preventDefault();
          handleSetPointA();
          break;
        case ']':
          e.preventDefault();
          handleSetPointB();
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          handleToggleLoop();
          break;
        case '-':
        case '_':
          e.preventDefault();
          setPlaybackRate((prev) => Math.max(0.25, Math.round((prev - 0.05) * 100) / 100));
          break;
        case '=':
        case '+':
          e.preventDefault();
          setPlaybackRate((prev) => Math.min(2.0, Math.round((prev + 0.05) * 100) / 100));
          break;
        case '0':
          e.preventDefault();
          setPlaybackRate(1.0);
          break;
        case 'Escape':
          e.preventDefault();
          handleClearLoop();
          break;
        case 'a':
        case 'A':
          if (loopRegion && waveSurferRef.current) {
            e.preventDefault();
            waveSurferRef.current.setTime(loopRegion.start);
          }
          break;
        case 'b':
        case 'B':
          if (loopRegion && waveSurferRef.current) {
            e.preventDefault();
            waveSurferRef.current.setTime(loopRegion.end);
          }
          break;
        case 's':
        case 'S':
          if (loopRegion) {
            e.preventDefault();
            setIsSaveModalOpen(true);
          }
          break;
        default:
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setActiveKeys((prev) => {
        const next = new Set(prev);
        next.delete(e.key);
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [currentTime, duration, loopRegion, isPlaying]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        trackTitle={currentTrack?.title}
        isPlaying={isPlaying}
        cacheCount={cachedTracks.length}
      />

      {/* Main Studio Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Source Ingestion Panel */}
        <SourceSelector
          activeTab={activeTab}
          onTrackLoaded={handleTrackLoaded}
          cachedTracks={cachedTracks}
          onRefreshCache={fetchCachedTracks}
          onDeleteCachedTrack={handleDeleteCachedTrack}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
        />

        {/* Primary Interactive Waveform Deck */}
        {currentTrack && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider font-mono">
                  Phrase Scrubber & Timeline
                </h2>
                <span className="text-xs text-zinc-400 font-mono hidden sm:inline">
                  {currentTrack.sourceType === 'local' && '(Direct Memory Audio)'}
                  {currentTrack.sourceType === 'youtube' && '(Ripped & Cached via yt-dlp)'}
                  {currentTrack.sourceType === 'preset' && '(44.1kHz Web Audio Synthesis)'}
                </span>
              </div>

              {/* Dynamic VU meter */}
              <AudioVUMeter isPlaying={isPlaying} />
            </div>

            {/* WaveSurfer Component */}
            <WaveformViewer
              audioUrl={currentTrack.audioUrl}
              playbackRate={playbackRate}
              isLoopActive={isLoopActive}
              loopRegion={loopRegion}
              onLoopRegionChange={setLoopRegion}
              currentTime={currentTime}
              setCurrentTime={setCurrentTime}
              duration={duration}
              setDuration={setDuration}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              onWaveSurferReady={(ws) => {
                waveSurferRef.current = ws;
              }}
            />

            {/* Stem Separation & Multi-Track Mixer */}
            <StemMixer
              track={currentTrack}
              isPlaying={isPlaying}
              currentTime={currentTime}
              playbackRate={playbackRate}
            />

            {/* Transport & Pitch-Preserved Speed Engine */}
            <TransportControls
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              onStop={handleStop}
              onJumpBackward={handleJumpBackward}
              onJumpForward={handleJumpForward}
              playbackRate={playbackRate}
              onPlaybackRateChange={setPlaybackRate}
              isLoopActive={isLoopActive}
              onToggleLoop={handleToggleLoop}
              loopRegion={loopRegion}
              onSetPointA={handleSetPointA}
              onSetPointB={handleSetPointB}
              onNudgePointA={handleNudgePointA}
              onNudgePointB={handleNudgePointB}
              onClearLoop={handleClearLoop}
              onOpenSaveModal={() => setIsSaveModalOpen(true)}
              currentTime={currentTime}
            />

            {/* Saved Phrases & Ear-Training Bookmarks */}
            <SectionsManager
              sections={sections}
              onSelectSection={handleSelectSection}
              onDeleteSection={handleDeleteSection}
              onSaveNewSection={handleSaveNewSection}
              loopRegion={loopRegion}
              trackTitle={currentTrack.title}
              isModalOpen={isSaveModalOpen}
              setIsModalOpen={setIsSaveModalOpen}
              onImportSections={handleImportSections}
            />
          </div>
        )}

        {/* Guitarist Keystroke HUD */}
        <KeyboardCheatSheet activeKeys={activeKeys} />
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/80 px-4 py-3 text-center text-xs font-mono text-zinc-500">
        <span>FretEar • Designed for hands-free electric guitar ear-training phrase by phrase</span>
      </footer>
    </div>
  );
}
