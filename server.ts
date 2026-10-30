import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execFile } from 'child_process';
import util from 'util';

const execFilePromise = util.promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Audio cache directory
const cacheDir = path.join(__dirname, 'cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Path to yt-dlp binary
const ytDlpPath = path.join(__dirname, 'bin', 'yt-dlp');

// Cache metadata file
const metadataFilePath = path.join(cacheDir, 'tracks_index.json');

interface TrackMetadata {
  id: string;
  title: string;
  duration: number; // in seconds
  durationFormatted: string;
  uploader?: string;
  sourceUrl: string;
  fileName: string;
  dateAdded: string;
}

function loadTrackIndex(): Record<string, TrackMetadata> {
  try {
    if (fs.existsSync(metadataFilePath)) {
      const data = fs.readFileSync(metadataFilePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading track index:', err);
  }
  return {};
}

function saveTrackIndex(index: Record<string, TrackMetadata>) {
  try {
    fs.writeFileSync(metadataFilePath, JSON.stringify(index, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving track index:', err);
  }
}

function formatDuration(sec: number): string {
  if (isNaN(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// API: List cached tracks
app.get('/api/cached-tracks', (req, res) => {
  const index = loadTrackIndex();
  const tracks = Object.values(index).map((item) => ({
    ...item,
    audioUrl: `/api/audio/${item.id}`,
  }));
  res.json({ success: true, tracks });
});

const cookiesFilePath = path.join(cacheDir, 'cookies.txt');

// API: Check YouTube cookies status
app.get('/api/youtube/cookies/status', (req, res) => {
  const hasCookies = fs.existsSync(cookiesFilePath) && fs.statSync(cookiesFilePath).size > 10;
  res.json({ success: true, hasCookies });
});

// API: Save YouTube cookies
app.post('/api/youtube/cookies', (req, res) => {
  const { cookiesContent } = req.body;
  if (!cookiesContent || typeof cookiesContent !== 'string') {
    return res.status(400).json({ success: false, error: 'Valid cookies content is required.' });
  }

  try {
    fs.writeFileSync(cookiesFilePath, cookiesContent.trim(), 'utf-8');
    res.json({ success: true, message: 'Cookies saved successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Delete YouTube cookies
app.delete('/api/youtube/cookies', (req, res) => {
  try {
    if (fs.existsSync(cookiesFilePath)) {
      fs.unlinkSync(cookiesFilePath);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
  return match ? match[1] : null;
}

// API: Extract audio from YouTube or any streaming URL
app.post('/api/youtube', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'Valid URL is required.' });
  }

  const cleanUrl = url.trim();
  const directVideoId = extractVideoId(cleanUrl);

  // 1. Fast-path: If track ID is already cached, return immediately without network roundtrip!
  if (directVideoId) {
    const index = loadTrackIndex();
    const candidateFiles = [
      path.join(cacheDir, `${directVideoId}.mp3`),
      path.join(cacheDir, `${directVideoId}.wav`),
      path.join(cacheDir, `${directVideoId}.m4a`),
    ];
    const existingFile = candidateFiles.find((f) => fs.existsSync(f));

    if (existingFile && index[directVideoId]) {
      return res.json({
        success: true,
        track: {
          ...index[directVideoId],
          audioUrl: `/api/audio/${directVideoId}`,
        },
      });
    }
  }

  try {
    // Robust base args with Node.js runtime for YouTube signature deciphering
    const baseArgs: string[] = [
      '--no-playlist',
      '--no-warnings',
      '--retries', '2',
      '--fragment-retries', '2',
      '--socket-timeout', '10',
      '--js-runtimes', 'node:/usr/local/bin/node',
    ];

    if (fs.existsSync(cookiesFilePath) && fs.statSync(cookiesFilePath).size > 20) {
      const content = fs.readFileSync(cookiesFilePath, 'utf-8');
      if (content.includes('\t') || content.includes('# Netscape') || content.includes('# HTTP Cookie')) {
        baseArgs.push('--cookies', cookiesFilePath);
      }
    }

    // 1. Get video ID and info
    const infoArgs = [
      ...baseArgs,
      '--dump-single-json',
      cleanUrl,
    ];

    const { stdout: infoStdout } = await execFilePromise(ytDlpPath, infoArgs, { timeout: 20000 });
    const videoInfo = JSON.parse(infoStdout);

    const videoId = videoInfo.id || directVideoId || `track_${Date.now()}`;
    const title = videoInfo.title || 'Audio Stream';
    const duration = Math.round(videoInfo.duration || 0);
    const uploader = videoInfo.uploader || videoInfo.channel || 'Online Source';
    const targetFile = path.join(cacheDir, `${videoId}.mp3`);

    // Check if file already exists in cache
    if (!fs.existsSync(targetFile)) {
      // 2. Download and convert to MP3 with fallback format selector
      // 'ba/ba*/b/best' ensures that if audio-only format is missing, it falls back to combined video+audio
      const downloadArgs = [
        ...baseArgs,
        '-f', 'ba/ba*/b/best',
        '-x',
        '--audio-format',
        'mp3',
        '--audio-quality',
        '0',
        '--output',
        path.join(cacheDir, `${videoId}.%(ext)s`),
        cleanUrl,
      ];

      await execFilePromise(ytDlpPath, downloadArgs, { timeout: 60000 });
    }

    // Verify target file exists
    if (!fs.existsSync(targetFile)) {
      const files = fs.readdirSync(cacheDir).filter((f) => f.startsWith(videoId));
      if (files.length === 0) {
        throw new Error('Audio conversion failed: output file not found.');
      }
    }

    // Save metadata
    const index = loadTrackIndex();
    const trackData: TrackMetadata = {
      id: videoId,
      title,
      duration,
      durationFormatted: formatDuration(duration),
      uploader,
      sourceUrl: cleanUrl,
      fileName: `${videoId}.mp3`,
      dateAdded: new Date().toISOString(),
    };
    index[videoId] = trackData;
    saveTrackIndex(index);

    return res.json({
      success: true,
      track: {
        ...trackData,
        audioUrl: `/api/audio/${videoId}`,
      },
    });
  } catch (error: any) {
    const fullErr = `${error.stderr || ''} ${error.stdout || ''} ${error.message || ''}`;
    const isBotCheck = /bot|sign in|confirm you.*not a bot|cookies/i.test(fullErr);

    return res.status(200).json({
      success: false,
      isBotBlocked: isBotCheck,
      error: isBotCheck
        ? 'YouTube anti-bot verification required on this cloud server IP. Please add cookies or load as a local file.'
        : fullErr.length > 250 ? fullErr.slice(0, 250) + '...' : fullErr,
      details: fullErr,
    });
  }
});

// API: Get Stems status
app.get('/api/stems/:id', (req, res) => {
  const { id } = req.params;
  const sanitizedId = path.basename(id);
  const stemsManifestPath = path.join(cacheDir, `${sanitizedId}_stems.json`);

  if (fs.existsSync(stemsManifestPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(stemsManifestPath, 'utf-8'));
      return res.json({ success: true, isSeparated: true, stems: data });
    } catch (e) {
      // ignore
    }
  }

  // Check if stem files exist directly
  const guitarPath = path.join(cacheDir, `${sanitizedId}_guitar.mp3`);
  if (fs.existsSync(guitarPath)) {
    const stems = {
      guitar: { url: `/api/audio/${sanitizedId}_guitar`, name: 'Lead Guitar' },
      backing: { url: `/api/audio/${sanitizedId}_backing`, name: 'Backing Band (Minus Guitar)' },
      bass: { url: `/api/audio/${sanitizedId}_bass`, name: 'Bass Line' },
      drums: { url: `/api/audio/${sanitizedId}_drums`, name: 'Drums & Percussion' },
    };
    return res.json({ success: true, isSeparated: true, stems });
  }

  res.json({ success: true, isSeparated: false });
});

// API: Perform Stem Separation on Track
app.post('/api/stems/separate', async (req, res) => {
  const { trackId } = req.body;
  if (!trackId || typeof trackId !== 'string') {
    return res.status(400).json({ success: false, error: 'Valid trackId is required.' });
  }

  const sanitizedId = path.basename(trackId);

  // Locate source audio file
  const candidateFiles = [
    path.join(cacheDir, `${sanitizedId}.mp3`),
    path.join(cacheDir, `${sanitizedId}.m4a`),
    path.join(cacheDir, `${sanitizedId}.wav`),
    path.join(cacheDir, sanitizedId),
  ];

  let sourceFile = candidateFiles.find((f) => fs.existsSync(f));

  if (!sourceFile) {
    return res.status(404).json({
      success: false,
      error: 'Source audio file not found in cache. For local files, please upload audio buffer for separation.',
    });
  }

  const guitarStemFile = path.join(cacheDir, `${sanitizedId}_guitar.mp3`);
  const backingStemFile = path.join(cacheDir, `${sanitizedId}_backing.mp3`);
  const bassStemFile = path.join(cacheDir, `${sanitizedId}_bass.mp3`);
  const drumsStemFile = path.join(cacheDir, `${sanitizedId}_drums.mp3`);

  try {
    // 1. Guitar Stem (Center Lead Focus + Presence EQ 1.8kHz - 3.2kHz)
    if (!fs.existsSync(guitarStemFile)) {
      const guitarFilter = 'stereotools=mlev=1.7:slev=0.3,highpass=f=220,lowpass=f=5000,equalizer=f=1800:width_type=o:w=1.2:g=5,equalizer=f=3200:width_type=o:w=1.0:g=4';
      await execFilePromise('/usr/bin/ffmpeg', [
        '-y',
        '-i', sourceFile,
        '-af', guitarFilter,
        '-b:a', '192k',
        guitarStemFile,
      ]);
    }

    // 2. Backing Band Stem (Center Subtraction / Minus-Lead Guitar)
    if (!fs.existsSync(backingStemFile)) {
      const backingFilter = 'stereotools=mlev=0.15:slev=1.85,equalizer=f=1800:width_type=o:w=1.4:g=-16,equalizer=f=3000:width_type=o:w=1.2:g=-12';
      await execFilePromise('/usr/bin/ffmpeg', [
        '-y',
        '-i', sourceFile,
        '-af', backingFilter,
        '-b:a', '192k',
        backingStemFile,
      ]);
    }

    // 3. Bass Line Stem (Butterworth Lowpass + 80Hz Fundamental)
    if (!fs.existsSync(bassStemFile)) {
      const bassFilter = 'lowpass=f=220,equalizer=f=80:width_type=o:w=1.0:g=6,pan=stereo|c0=c0+c1|c1=c0+c1';
      await execFilePromise('/usr/bin/ffmpeg', [
        '-y',
        '-i', sourceFile,
        '-af', bassFilter,
        '-b:a', '192k',
        bassStemFile,
      ]);
    }

    // 4. Drums & Percussion Stem (Transient Shaping + High Cymbals / Snare Snap)
    if (!fs.existsSync(drumsStemFile)) {
      const drumsFilter = 'highpass=f=2400,compand=attacks=0.01:decays=0.1:points=-80/-80|-20/-20|0/0,volume=1.3';
      await execFilePromise('/usr/bin/ffmpeg', [
        '-y',
        '-i', sourceFile,
        '-af', drumsFilter,
        '-b:a', '192k',
        drumsStemFile,
      ]);
    }

    const stemsManifest = {
      guitar: { url: `/api/audio/${sanitizedId}_guitar`, name: 'Lead Guitar' },
      backing: { url: `/api/audio/${sanitizedId}_backing`, name: 'Backing Band (Minus Guitar)' },
      bass: { url: `/api/audio/${sanitizedId}_bass`, name: 'Bass Line' },
      drums: { url: `/api/audio/${sanitizedId}_drums`, name: 'Drums & Percussion' },
    };

    fs.writeFileSync(
      path.join(cacheDir, `${sanitizedId}_stems.json`),
      JSON.stringify(stemsManifest, null, 2),
      'utf-8'
    );

    return res.json({
      success: true,
      stems: stemsManifest,
    });
  } catch (error: any) {
    console.error('Stem separation error:', error);
    return res.status(500).json({
      success: false,
      error: error.stderr || error.message || 'Stem separation failed.',
    });
  }
});

// API: Upload audio file directly for separation
app.post('/api/upload-for-stems', express.raw({ type: '*/*', limit: '100mb' }), async (req, res) => {
  const trackId = (req.query.trackId as string) || `upload_${Date.now()}`;
  const sanitizedId = path.basename(trackId);
  const targetFile = path.join(cacheDir, `${sanitizedId}.wav`);

  try {
    fs.writeFileSync(targetFile, req.body);
    res.json({ success: true, trackId: sanitizedId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Stream audio file with full Range / 206 support
app.get('/api/audio/:id', (req, res) => {
  const { id } = req.params;
  // Prevent directory traversal
  const sanitizedId = path.basename(id);
  
  // Find file matching sanitizedId
  const candidateFiles = [
    path.join(cacheDir, `${sanitizedId}.mp3`),
    path.join(cacheDir, `${sanitizedId}.m4a`),
    path.join(cacheDir, `${sanitizedId}.wav`),
    path.join(cacheDir, sanitizedId),
  ];

  const filePath = candidateFiles.find((f) => fs.existsSync(f));

  if (!filePath) {
    return res.status(404).json({ error: 'Audio file not found in cache' });
  }

  // Use res.sendFile with acceptRanges true for streaming & seeking
  res.sendFile(filePath, {
    acceptRanges: true,
    headers: {
      'Content-Type': filePath.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg',
      'Cache-Control': 'public, max-age=31536000',
    },
  });
});

// API: Delete cached track
app.delete('/api/cached-tracks/:id', (req, res) => {
  const { id } = req.params;
  const sanitizedId = path.basename(id);
  const index = loadTrackIndex();
  
  if (index[sanitizedId]) {
    delete index[sanitizedId];
    saveTrackIndex(index);
  }

  // Remove files
  const files = fs.readdirSync(cacheDir).filter((f) => f.startsWith(sanitizedId));
  for (const f of files) {
    try {
      fs.unlinkSync(path.join(cacheDir, f));
    } catch (e) {
      // ignore
    }
  }

  res.json({ success: true });
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FretEar] Looper backend and web app live at http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
