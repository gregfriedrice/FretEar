import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  Youtube,
  Sparkles,
  Database,
  Loader2,
  Play,
  Trash2,
  ArrowRight,
  Music,
  AlertCircle,
  CheckCircle2,
  Cookie,
  KeyRound,
  FileText,
  ExternalLink,
  Laptop,
  HelpCircle,
  X,
} from 'lucide-react';
import { Track } from '../types';
import { GUITAR_PRESETS, generatePresetAudio, PracticePreset } from '../utils/audioSynthesizer';
import { formatDuration } from '../utils/formatters';

interface SourceSelectorProps {
  activeTab: 'local' | 'youtube' | 'preset' | 'cache';
  onTrackLoaded: (track: Track, suggestedPhrases?: { name: string; start: number; end: number; notes: string }[]) => void;
  cachedTracks: Track[];
  onRefreshCache: () => void;
  onDeleteCachedTrack: (id: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const SourceSelector: React.FC<SourceSelectorProps> = ({
  activeTab,
  onTrackLoaded,
  cachedTracks,
  onRefreshCache,
  onDeleteCachedTrack,
  isLoading,
  setIsLoading,
}) => {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [ytError, setYtError] = useState<string | null>(null);
  const [isBotBlocked, setIsBotBlocked] = useState(false);
  const [ytStatus, setYtStatus] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cookie management states
  const [hasCookies, setHasCookies] = useState(false);
  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const [cookieInput, setCookieInput] = useState('');
  const [isSavingCookies, setIsSavingCookies] = useState(false);
  const [cookieStatusMsg, setCookieStatusMsg] = useState<string | null>(null);

  // Fetch cookie status on mount
  const checkCookieStatus = async () => {
    try {
      const res = await fetch('/api/youtube/cookies/status');
      if (res.ok) {
        const data = await res.json();
        setHasCookies(Boolean(data.hasCookies));
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    checkCookieStatus();
  }, []);

  // Handle local file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processLocalAudioFile(file);
    }
  };

  const processLocalAudioFile = (file: File) => {
    setIsLoading(true);
    setYtError(null);
    setIsBotBlocked(false);
    try {
      const audioUrl = URL.createObjectURL(file);
      const audio = new Audio();
      audio.src = audioUrl;
      audio.onloadedmetadata = () => {
        const track: Track = {
          id: `local_${Date.now()}_${file.name.replace(/\s+/g, '_')}`,
          title: file.name.replace(/\.[^/.]+$/, ''),
          sourceType: 'local',
          duration: audio.duration,
          durationFormatted: formatDuration(audio.duration),
          audioUrl,
          fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          blob: file,
        };
        onTrackLoaded(track);
        setIsLoading(false);
      };
      audio.onerror = () => {
        setYtError('Failed to decode local audio file. Format might not be supported by browser.');
        setIsLoading(false);
      };
    } catch (err: any) {
      setYtError(err.message || 'Error reading local file.');
      setIsLoading(false);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processLocalAudioFile(file);
    }
  };

  // Handle YouTube / Streaming URL submit
  const handleYoutubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;

    setIsLoading(true);
    setYtError(null);
    setIsBotBlocked(false);
    setYtStatus('Connecting to audio stream and extracting via yt-dlp...');

    try {
      const response = await fetch('/api/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl.trim() }),
      });

      const rawText = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        if (response.status === 504 || rawText.includes('504') || rawText.includes('Gateway Timeout')) {
          setIsBotBlocked(true);
          throw new Error('Connection timed out. YouTube blocked this cloud server IP with a bot challenge.');
        } else if (response.status === 502 || rawText.includes('502')) {
          throw new Error('Connection interrupted. The upstream video stream could not be reached.');
        } else {
          throw new Error(`Server returned unexpected response (HTTP ${response.status}).`);
        }
      }

      if (!response.ok || !data.success) {
        if (data.isBotBlocked) {
          setIsBotBlocked(true);
        }
        throw new Error(data.error || 'Failed to extract audio');
      }

      const { track } = data;
      onTrackLoaded({
        ...track,
        sourceType: 'youtube',
      });
      onRefreshCache();
      setYoutubeUrl('');
      setYtStatus('Audio cached and loaded into waveform viewer!');
      setTimeout(() => setYtStatus(null), 3000);
    } catch (err: any) {
      setYtError(err.message || 'Failed to load audio stream.');
    } finally {
      setIsLoading(false);
    }
  };

  // Save cookies
  const handleSaveCookies = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookieInput.trim()) return;

    setIsSavingCookies(true);
    setCookieStatusMsg(null);

    try {
      const res = await fetch('/api/youtube/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookiesContent: cookieInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save cookies.');
      }

      setHasCookies(true);
      setCookieStatusMsg('Cookies saved successfully! You can now retry YouTube extraction.');
      setTimeout(() => {
        setIsCookieModalOpen(false);
        setCookieStatusMsg(null);
        setCookieInput('');
      }, 1500);
    } catch (err: any) {
      setCookieStatusMsg(`Error: ${err.message}`);
    } finally {
      setIsSavingCookies(false);
    }
  };

  // Delete cookies
  const handleDeleteCookies = async () => {
    try {
      await fetch('/api/youtube/cookies', { method: 'DELETE' });
      setHasCookies(false);
      setCookieStatusMsg('Cookies cleared.');
      setTimeout(() => setCookieStatusMsg(null), 1500);
    } catch (e) {
      // ignore
    }
  };

  // Handle Cookie File Upload
  const handleCookieFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCookieInput(content);
      }
    };
    reader.readAsText(file);
  };

  // Handle Preset selection
  const handleSelectPreset = async (preset: PracticePreset) => {
    setIsLoading(true);
    setYtError(null);
    setIsBotBlocked(false);
    try {
      const wavBlob = await generatePresetAudio(preset.id);
      const audioUrl = URL.createObjectURL(wavBlob);
      const track: Track = {
        id: preset.id,
        title: preset.title,
        sourceType: 'preset',
        duration: 16,
        durationFormatted: '00:16',
        audioUrl,
        blob: wavBlob,
      };
      onTrackLoaded(track, preset.suggestedPhrases);
    } catch (err: any) {
      setYtError('Error generating guitar preset audio.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 transition-all">
      {/* LOCAL AUDIO TAB */}
      {activeTab === 'local' && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
            isDragOver
              ? 'border-amber-400 bg-amber-500/10'
              : 'border-zinc-700/80 hover:border-zinc-600 bg-zinc-950/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.webm"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center gap-2.5">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-amber-400 border border-zinc-700 shadow-inner">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">
                Drag & drop your song audio file here, or{' '}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-amber-400 hover:text-amber-300 underline font-semibold cursor-pointer"
                >
                  browse files
                </button>
              </p>
              <p className="text-xs text-zinc-500 mt-1 font-mono">
                Supports MP3, WAV, FLAC, M4A, AAC, OGG • Loads directly into browser RAM (zero network limitations)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* YOUTUBE TAB */}
      {activeTab === 'youtube' && (
        <div className="space-y-3">
          <form onSubmit={handleYoutubeSubmit} className="space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Youtube className="w-4 h-4 text-red-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => {
                    setYoutubeUrl(e.target.value);
                    if (isBotBlocked) setIsBotBlocked(false);
                    if (ytError) setYtError(null);
                  }}
                  placeholder="Paste YouTube or SoundCloud URL (e.g. https://www.youtube.com/watch?v=...)"
                  disabled={isLoading}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-10 pr-20 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 font-mono disabled:opacity-50"
                />
                {youtubeUrl && (
                  <button
                    type="button"
                    onClick={() => setYoutubeUrl('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300 font-mono"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCookieModalOpen(true)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-mono rounded-lg border transition cursor-pointer ${
                    hasCookies
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                      : 'bg-zinc-950 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                  title="Configure YouTube Cookies for Cloud IP Bot Bypass"
                >
                  <Cookie className="w-3.5 h-3.5 text-amber-400" />
                  <span>{hasCookies ? 'Cookies Set' : 'Add Cookies'}</span>
                </button>

                <button
                  type="submit"
                  disabled={isLoading || !youtubeUrl.trim()}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-semibold rounded-lg transition shadow-md cursor-pointer disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Extracting...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      <span>Rip Audio</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {ytStatus && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{ytStatus}</span>
            </div>
          )}

          {/* Bot Check Recovery Card */}
          {isBotBlocked && (
            <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-4 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-amber-200">
                    YouTube Bot-Check Restriction Detected
                  </h4>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    YouTube's anti-bot system blocks automated stream requests originating from datacenter / cloud hosting IP ranges. To load this track, choose any of the options below:
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                {/* Option 1: Add Cookies */}
                <div className="bg-zinc-950/80 border border-zinc-800 rounded-lg p-3 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mb-1">
                      <Cookie className="w-3.5 h-3.5" />
                      <span>1. Pass YouTube Cookies</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-normal">
                      Export your browser's YouTube session with a free extension and paste it here to authenticate.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCookieModalOpen(true)}
                    className="w-full py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-xs font-semibold font-mono cursor-pointer transition text-center"
                  >
                    Open Cookie Setup
                  </button>
                </div>

                {/* Option 2: Local Audio File */}
                <div className="bg-zinc-950/80 border border-zinc-800 rounded-lg p-3 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 mb-1">
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>2. Load As Local File</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-normal">
                      Download the audio file to your computer and drag it straight into FretEar for instant RAM playback.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded text-xs font-semibold font-mono cursor-pointer transition text-center"
                  >
                    Browse Local File
                  </button>
                </div>

                {/* Option 3: Run Locally On Desktop */}
                <div className="bg-zinc-950/80 border border-zinc-800 rounded-lg p-3 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 mb-1">
                      <Laptop className="w-3.5 h-3.5" />
                      <span>3. Run Locally (Desktop)</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-normal">
                      Run <code className="text-zinc-200">python3 backend.py</code> on your home computer. Residential IPs are never blocked!
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 text-center py-1 bg-zinc-900 rounded">
                    Included in project root
                  </span>
                </div>
              </div>
            </div>
          )}

          {ytError && !isBotBlocked && (
            <div className="flex items-center gap-2 text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{ytError}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="font-mono text-zinc-500">Also accepts:</span>
              <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded">
                SoundCloud, Bandcamp, Direct MP3/WAV links
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsCookieModalOpen(true)}
              className="text-xs text-amber-400/90 hover:text-amber-300 underline font-mono flex items-center gap-1 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>How to bypass YouTube bot check</span>
            </button>
          </div>
        </div>
      )}

      {/* GUITAR PRESETS TAB */}
      {activeTab === 'preset' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              Instant 44.1kHz guitar phrases synthesized in-browser with backing drums & bass. Click any preset to test A/B looping and pitch-preserved slowdown right away:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {GUITAR_PRESETS.map((p) => (
              <div
                key={p.id}
                className="bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700 rounded-lg p-3.5 flex flex-col justify-between transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs font-semibold text-amber-400">
                      {p.key}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-500">
                      {p.bpm} BPM
                    </span>
                  </div>
                  <h4 className="font-semibold text-sm text-zinc-100 group-hover:text-amber-300 transition">
                    {p.title}
                  </h4>
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                    {p.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-zinc-500">
                    {p.suggestedPhrases.length} bookmark licks
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-xs font-semibold transition cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-amber-400" />
                    <span>Load Phrase</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CACHE LIBRARY TAB */}
      {activeTab === 'cache' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-mono">
              Locally cached YouTube audio streams ({cachedTracks.length} tracks):
            </span>
            <button
              type="button"
              onClick={onRefreshCache}
              className="text-xs text-amber-400 hover:underline font-mono"
            >
              Refresh
            </button>
          </div>

          {cachedTracks.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-500 font-mono border border-zinc-800/80 rounded-lg bg-zinc-950/40">
              No tracks in local cache yet. Paste a YouTube URL above to rip and cache audio streams.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {cachedTracks.map((track) => (
                <div
                  key={track.id}
                  className="flex items-center justify-between p-2.5 bg-zinc-950 border border-zinc-800/90 rounded-lg hover:border-zinc-700 transition"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-semibold text-zinc-200 truncate">
                      {track.title}
                    </p>
                    <p className="text-[11px] font-mono text-zinc-500 flex items-center gap-2 mt-0.5">
                      <span>{track.durationFormatted}</span>
                      {track.uploader && <span>• {track.uploader}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onTrackLoaded(track)}
                      className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-xs font-semibold rounded border border-amber-500/40 cursor-pointer flex items-center gap-1 transition"
                    >
                      <Play className="w-3 h-3 fill-amber-400" />
                      <span>Load</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteCachedTrack(track.id)}
                      className="p-1 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 rounded transition cursor-pointer"
                      title="Delete from cache"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* YouTube Cookies Modal Dialog */}
      {isCookieModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Cookie className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base text-zinc-100">
                  YouTube Authentication & Cookie Setup
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCookieModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
              <p>
                When running on cloud hosting servers, YouTube restricts requests with a "Sign in to confirm you're not a bot" prompt. Supplying your browser cookies authenticates your session with yt-dlp.
              </p>

              <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 space-y-2">
                <span className="font-bold text-amber-400 block">How to get your cookies:</span>
                <ol className="list-decimal list-inside space-y-1 text-zinc-400 font-mono text-[11px]">
                  <li>Install a browser extension like <strong>"Get cookies.txt LOCALLY"</strong> (Chrome / Firefox).</li>
                  <li>Go to <strong>youtube.com</strong> while signed in.</li>
                  <li>Click the extension and copy the cookies or download <code className="text-zinc-300">cookies.txt</code>.</li>
                  <li>Paste the text below or upload the file.</li>
                </ol>
              </div>

              <form onSubmit={handleSaveCookies} className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-200">
                    Paste Netscape Cookies Text:
                  </label>
                  <label className="text-xs font-mono text-amber-400 hover:underline cursor-pointer flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Upload cookies.txt</span>
                    <input
                      type="file"
                      accept=".txt"
                      onChange={handleCookieFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <textarea
                  rows={5}
                  value={cookieInput}
                  onChange={(e) => setCookieInput(e.target.value)}
                  placeholder="# Netscape HTTP Cookie File&#10;.youtube.com  TRUE  /  TRUE  ...  SID  ..."
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-amber-500"
                />

                {cookieStatusMsg && (
                  <p className="text-xs font-mono text-emerald-400">
                    {cookieStatusMsg}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2">
                  {hasCookies ? (
                    <button
                      type="button"
                      onClick={handleDeleteCookies}
                      className="text-xs text-red-400 hover:text-red-300 font-mono underline cursor-pointer"
                    >
                      Clear Saved Cookies
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCookieModalOpen(false)}
                      className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingCookies || !cookieInput.trim()}
                      className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 text-xs font-bold rounded-lg cursor-pointer transition shadow"
                    >
                      {isSavingCookies ? 'Saving...' : 'Save & Enable Cookies'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
