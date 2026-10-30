export interface Track {
  id: string;
  title: string;
  sourceType: 'local' | 'youtube' | 'preset';
  duration: number; // in seconds
  durationFormatted: string;
  audioUrl: string;
  fileSize?: string;
  uploader?: string;
  dateAdded?: string;
  blob?: Blob;
}

export interface PhraseSection {
  id: string;
  trackId: string;
  name: string;
  start: number; // in seconds
  end: number;   // in seconds
  color: string;
  notes?: string;
  createdAt: number;
}

export interface LoopRegion {
  start: number;
  end: number;
  active: boolean;
}

export interface KeyPressState {
  key: string;
  active: boolean;
}

export interface StemInfo {
  id: 'guitar' | 'backing' | 'bass' | 'drums';
  name: string;
  url: string;
  volume: number; // 0 to 1
  isMuted: boolean;
  isSolo: boolean;
  color: string;
  icon: string;
}

export interface TrackStems {
  trackId: string;
  isSeparated: boolean;
  isProcessing: boolean;
  progressMessage?: string;
  stems: Record<'guitar' | 'backing' | 'bass' | 'drums', StemInfo>;
}
