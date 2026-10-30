/**
 * Procedural electric guitar and backing track audio generator.
 * Uses Web Audio API synthesis (harmonic overtones, distortion curves, amplifier emulation,
 * and rhythm backing) to synthesize authentic guitar practice tracks.
 * Encoded to 44.1kHz 16-bit stereo WAV Blobs for WaveSurfer.
 */

// Helper to encode AudioBuffer to standard WAV Blob
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels: Float32Array[] = [];
  let sampleRate = buffer.sampleRate;
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) {
    out.setUint16(pos, data, true);
    pos += 2;
  }
  function setUint32(data: number) {
    out.setUint32(pos, data, true);
    pos += 4;
  }

  // RIFF identifier
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8);  // file length - 8
  setUint32(0x45564157); // "WAVE"

  // format chunk identifier
  setUint32(0x20746d66); // "fmt "
  setUint32(16);          // linear PCM
  setUint16(1);           // format 1
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan); // byte rate
  setUint16(numOfChan * 2);              // block align
  setUint16(16);                         // 16-bit

  // data chunk identifier
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4);

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (offset < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      // 16-bit PCM conversion
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out.buffer], { type: 'audio/wav' });
}

// Convert MIDI note number to Frequency
function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export interface PracticePreset {
  id: string;
  title: string;
  bpm: number;
  key: string;
  description: string;
  suggestedPhrases: { name: string; start: number; end: number; notes: string }[];
}

export const GUITAR_PRESETS: PracticePreset[] = [
  {
    id: 'preset-blues-am',
    title: 'Texas Blues Solo in A minor',
    bpm: 110,
    key: 'A Minor / Blues',
    description: 'Bends, vibrato, and expressive phrasing over a 12-bar shuffle groove. Ideal for ear training on microtonal string bends.',
    suggestedPhrases: [
      { name: 'Opening Albert King Bend', start: 0.0, end: 4.36, notes: 'Full step bend on 7th fret G string up to E with wide vibrato' },
      { name: 'Classic BB Box Riff', start: 4.36, end: 8.72, notes: 'Root note A on high E string with staccato pick attack' },
      { name: 'Fast Triplet Turnaround', start: 8.72, end: 13.09, notes: 'Descending minor blues scale into the low E root' },
    ],
  },
  {
    id: 'preset-funk-e7',
    title: 'Funk Groove & 16th-Note Riffs',
    bpm: 100,
    key: 'E7#9 (Hendrix Chord)',
    description: 'Tight 16th-note syncopated scratch rhythms and melodic Hendrix double-stops.',
    suggestedPhrases: [
      { name: 'Syncopated E9 Funk Stabs', start: 0.0, end: 4.8, notes: 'Tight muted percussive strumming with accent on the 16th upbeats' },
      { name: 'Sliding 4th Double-Stops', start: 4.8, end: 9.6, notes: 'Slide from D-G to E-A on the 5th and 7th frets' },
      { name: 'Bass Walk & Chord Snap', start: 9.6, end: 14.4, notes: 'Low E string hammer-on 0-5-7 into snap chord' },
    ],
  },
  {
    id: 'preset-shred-dm',
    title: 'Neo-Classical Sweep & Run in Dm',
    bpm: 135,
    key: 'D Harmonic Minor',
    description: 'Rapid 16th-note scalar runs and sweep arpeggios. Perfect for slowing down to 50% to transcribe every fast note.',
    suggestedPhrases: [
      { name: 'Harmonic Minor Scale Run', start: 0.0, end: 3.55, notes: 'D - E - F - G - A - Bb - C# ascending picking sequence' },
      { name: 'A7 Diminished Arpeggio', start: 3.55, end: 7.11, notes: 'High-speed 3-string sweep arpeggio on frets 12-15' },
      { name: 'Tapping & Whammy Flutter', start: 7.11, end: 10.66, notes: 'Index finger fret-tap on 17th fret pulled off to 10 and 13' },
    ],
  },
];

/**
 * Procedurally synthesize the audio track for a given preset
 */
export async function generatePresetAudio(presetId: string): Promise<Blob> {
  const sampleRate = 44100;
  const ctx = new OfflineAudioContext(2, sampleRate * 16, sampleRate); // 16 seconds

  const now = 0;
  const preset = GUITAR_PRESETS.find((p) => p.id === presetId) || GUITAR_PRESETS[0];

  // Simple distortion curve for electric guitar warmth
  function makeDistortionCurve(k = 20) {
    const n = 22050;
    const curve = new Float32Array(n);
    const deg = Math.PI / 180;
    for (let i = 0; i < n; ++i) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  // Master amp bus
  const masterAmp = ctx.createGain();
  masterAmp.gain.value = 0.55;
  masterAmp.connect(ctx.destination);

  // Guitar distortion & cabinet simulation filter
  const drive = ctx.createWaveShaper();
  drive.curve = makeDistortionCurve(preset.id === 'preset-shred-dm' ? 45 : 22);
  drive.oversample = '4x';

  const cabFilter = ctx.createBiquadFilter();
  cabFilter.type = 'lowpass';
  cabFilter.frequency.value = 4200; // roll off shrill top end like a 12" Celestion speaker

  const cabHighpass = ctx.createBiquadFilter();
  cabHighpass.type = 'highpass';
  cabHighpass.frequency.value = 90; // cut sub rumble

  drive.connect(cabFilter);
  cabFilter.connect(cabHighpass);
  cabHighpass.connect(masterAmp);

  // Backing track bus
  const rhythmGain = ctx.createGain();
  rhythmGain.gain.value = 0.45;
  rhythmGain.connect(ctx.destination);

  // Play a drum kick & snare pattern
  const beatDuration = 60 / preset.bpm;
  const totalBeats = Math.floor(16 / beatDuration);

  for (let b = 0; b < totalBeats; b++) {
    const time = b * beatDuration;

    // Kick on beat 0, 2 (or 0 and 2.5)
    if (b % 4 === 0 || b % 4 === 2.5) {
      const kickOsc = ctx.createOscillator();
      const kickGain = ctx.createGain();
      kickOsc.frequency.setValueAtTime(140, time);
      kickOsc.frequency.exponentialRampToValueAtTime(38, time + 0.12);
      kickGain.gain.setValueAtTime(0.8, time);
      kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
      kickOsc.connect(kickGain);
      kickGain.connect(rhythmGain);
      kickOsc.start(time);
      kickOsc.stop(time + 0.25);
    }

    // Snare on beat 1, 3 (2 and 4 in 4/4)
    if (b % 4 === 1 || b % 4 === 3) {
      const snareOsc = ctx.createOscillator();
      const snareGain = ctx.createGain();
      snareOsc.type = 'triangle';
      snareOsc.frequency.setValueAtTime(180, time);
      snareOsc.frequency.exponentialRampToValueAtTime(70, time + 0.15);
      snareGain.gain.setValueAtTime(0.4, time);
      snareGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
      snareOsc.connect(snareGain);
      snareGain.connect(rhythmGain);
      snareOsc.start(time);
      snareOsc.stop(time + 0.18);
    }

    // Hi-hat on 8ths
    for (let sub = 0; sub < 2; sub++) {
      const hhTime = time + (sub * beatDuration) / 2;
      const hhOsc = ctx.createOscillator();
      const hhGain = ctx.createGain();
      hhOsc.type = 'square';
      hhOsc.frequency.setValueAtTime(8000 + Math.random() * 2000, hhTime);
      hhGain.gain.setValueAtTime(sub === 0 ? 0.08 : 0.05, hhTime);
      hhGain.gain.exponentialRampToValueAtTime(0.001, hhTime + 0.04);
      hhOsc.connect(hhGain);
      hhGain.connect(rhythmGain);
      hhOsc.start(hhTime);
      hhOsc.stop(hhTime + 0.05);
    }

    // Bass line
    let bassNote = 33; // A1
    if (preset.id === 'preset-shred-dm') bassNote = 38; // D2
    else if (preset.id === 'preset-funk-e7') bassNote = 28; // E1

    if (b % 4 === 0) {
      const bassOsc = ctx.createOscillator();
      const bGain = ctx.createGain();
      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(midiToFreq(bassNote), time);
      bGain.gain.setValueAtTime(0.3, time);
      bGain.gain.exponentialRampToValueAtTime(0.01, time + beatDuration * 1.8);
      bassOsc.connect(bGain);
      bGain.connect(rhythmGain);
      bassOsc.start(time);
      bassOsc.stop(time + beatDuration * 1.8);
    }
  }

  // Guitar Note Sequence Synthesis
  function playGuitarNote(midiNote: number, startTime: number, duration: number, bendAmount = 0, vibrato = true) {
    if (startTime >= 15.5) return;
    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();

    osc.type = 'sawtooth'; // rich electric guitar harmonics
    const baseFreq = midiToFreq(midiNote);
    osc.frequency.setValueAtTime(baseFreq, startTime);

    if (bendAmount !== 0) {
      // String bend emulation
      const bendFreq = midiToFreq(midiNote + bendAmount);
      osc.frequency.setValueAtTime(baseFreq, startTime + duration * 0.15);
      osc.frequency.linearRampToValueAtTime(bendFreq, startTime + duration * 0.45);
    }

    if (vibrato && duration > 0.4) {
      // LFO vibrato
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 5.8; // 5.8 Hz vibrato rate
      lfoGain.gain.value = baseFreq * 0.02; // vibrato depth
      lfo.connect(osc.frequency);
      lfo.start(startTime + (bendAmount !== 0 ? duration * 0.45 : duration * 0.2));
      lfo.stop(startTime + duration);
    }

    // Guitar pick attack and sustain envelope
    noteGain.gain.setValueAtTime(0.0, startTime);
    noteGain.gain.linearRampToValueAtTime(0.5, startTime + 0.008); // sharp pick transient
    noteGain.gain.exponentialRampToValueAtTime(0.25, startTime + 0.1);
    noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(noteGain);
    noteGain.connect(drive);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  // Melodic notes depending on preset
  if (preset.id === 'preset-blues-am') {
    // A minor blues licks (A4 = 69, C5 = 72, D5 = 74, Eb5 = 75, E5 = 76, G5 = 79)
    const notes = [
      { n: 74, t: 0.2, d: 1.2, b: 2 }, // D5 bend to E5
      { n: 69, t: 1.6, d: 0.6 },       // A4
      { n: 72, t: 2.3, d: 0.4 },       // C5
      { n: 74, t: 2.8, d: 1.1, b: 1 }, // D5 slight blues curl
      { n: 69, t: 4.1, d: 0.5 },       // A4

      // Phrase 2: BB King Box
      { n: 79, t: 4.8, d: 0.8 },       // G5
      { n: 81, t: 5.7, d: 1.4 },       // A5 with vibrato
      { n: 79, t: 7.2, d: 0.4 },       // G5
      { n: 76, t: 7.7, d: 0.9 },       // E5

      // Phrase 3: Turnaround
      { n: 75, t: 8.8, d: 0.3 },       // Eb5 (blue note)
      { n: 74, t: 9.2, d: 0.3 },       // D5
      { n: 72, t: 9.6, d: 0.4 },       // C5
      { n: 69, t: 10.1, d: 1.8 },      // A4 low root
      { n: 64, t: 12.2, d: 2.2 },      // E4 chord tone
    ];

    notes.forEach((item) => playGuitarNote(item.n, item.t, item.d, item.b || 0));
  } else if (preset.id === 'preset-funk-e7') {
    // E7 Funk grooves
    const funkNotes = [
      { n: 64, t: 0.1, d: 0.2 },
      { n: 67, t: 0.35, d: 0.2 },
      { n: 70, t: 0.6, d: 0.35 },
      { n: 74, t: 1.1, d: 0.4 },
      { n: 76, t: 1.8, d: 0.9 },
      { n: 70, t: 2.9, d: 0.3 },
      { n: 67, t: 3.3, d: 0.5 },

      // Double-stops
      { n: 69, t: 4.9, d: 0.4 },
      { n: 71, t: 5.4, d: 0.8 },
      { n: 69, t: 6.4, d: 0.3 },
      { n: 64, t: 6.9, d: 0.7 },
      { n: 62, t: 8.0, d: 0.5 },
      { n: 64, t: 8.8, d: 1.2 },

      // Snap phrase
      { n: 76, t: 10.1, d: 0.25 },
      { n: 79, t: 10.5, d: 0.35 },
      { n: 81, t: 11.0, d: 0.8 },
      { n: 76, t: 12.1, d: 1.5 },
    ];
    funkNotes.forEach((item) => playGuitarNote(item.n, item.t, item.d));
  } else {
    // D Minor Harmonic Shred
    const shredNotes = [
      // Fast scale run
      { n: 62, t: 0.1, d: 0.18 },  // D4
      { n: 64, t: 0.3, d: 0.18 },  // E4
      { n: 65, t: 0.5, d: 0.18 },  // F4
      { n: 67, t: 0.7, d: 0.18 },  // G4
      { n: 69, t: 0.9, d: 0.18 },  // A4
      { n: 70, t: 1.1, d: 0.18 },  // Bb4
      { n: 73, t: 1.3, d: 0.25 },  // C#5 (harmonic 7th)
      { n: 74, t: 1.6, d: 0.8 },   // D5 high sustain

      // Sweeps
      { n: 69, t: 3.6, d: 0.15 },
      { n: 73, t: 3.8, d: 0.15 },
      { n: 76, t: 4.0, d: 0.15 },
      { n: 81, t: 4.2, d: 0.35 },
      { n: 76, t: 4.6, d: 0.15 },
      { n: 73, t: 4.8, d: 0.15 },
      { n: 69, t: 5.0, d: 0.6 },

      // Tapping lick
      { n: 86, t: 7.2, d: 0.3 },  // D6 tapped
      { n: 77, t: 7.6, d: 0.2 },  // F5
      { n: 81, t: 7.9, d: 0.2 },  // A5
      { n: 85, t: 8.2, d: 0.3 },  // C#6 tapped
      { n: 77, t: 8.6, d: 0.2 },
      { n: 74, t: 8.9, d: 1.8 },  // D5 with big sustain
    ];
    shredNotes.forEach((item) => playGuitarNote(item.n, item.t, item.d));
  }

  const renderedBuffer = await ctx.startRendering();
  return audioBufferToWav(renderedBuffer);
}
