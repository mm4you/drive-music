export type SyncedLyricLine = {
  time: number;
  text: string;
};

export type TrackLyrics = {
  trackId: string;
  title: string;
  lyrics?: string[];
  syncedLyrics?: SyncedLyricLine[];
  lrc?: string;
};

/**
 * Parses standard .lrc format text into SyncedLyricLine array.
 * Example input line: "[00:12.76] Dòng lyrics thứ nhất"
 */
export function parseLrc(lrcContent: string): SyncedLyricLine[] {
  const lines = lrcContent.split(/\r?\n/);
  const result: SyncedLyricLine[] = [];
  const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine) continue;

    timeRegex.lastIndex = 0;
    const match = timeRegex.exec(cleanLine);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const millisFraction = match[3] ? parseFloat(`0.${match[3]}`) : 0;
      const totalSeconds = minutes * 60 + seconds + millisFraction;
      const text = cleanLine.replace(/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g, "").trim();
      
      result.push({
        time: parseFloat(totalSeconds.toFixed(3)),
        text,
      });
    }
  }

  return result.sort((a, b) => a.time - b.time);
}
