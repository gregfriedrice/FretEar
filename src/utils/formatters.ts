export function formatTimecode(sec: number, includeSub = true): string {
  if (isNaN(sec) || sec < 0) return includeSub ? '00:00.00' : '00:00';
  const mins = Math.floor(sec / 60);
  const secs = Math.floor(sec % 60);
  const hundredths = Math.floor((sec % 1) * 100);

  const mm = mins.toString().padStart(2, '0');
  const ss = secs.toString().padStart(2, '0');
  const hs = hundredths.toString().padStart(2, '0');

  return includeSub ? `${mm}:${ss}.${hs}` : `${mm}:${ss}`;
}

export function formatDuration(sec: number): string {
  return formatTimecode(sec, false);
}

export function formatRatePercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
