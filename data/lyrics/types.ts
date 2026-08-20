export type SyncedLyricLine = {
  time: number;
  endTime?: number;
  text: string;
};

export type TrackLyrics = {
  trackId: string;
  title: string;
  lyrics?: string[];
  syncedLyrics?: SyncedLyricLine[];
  lrc?: string;
  syncQuality?: "timed" | "estimated";
};

/**
 * Parses standard .lrc format text into SyncedLyricLine array.
 * Example input line: "[00:12.76] Dòng lyrics thứ nhất"
 */
export function parseLrc(lrcContent: string): SyncedLyricLine[] {
  const lines = lrcContent.split(/\r?\n/);
  const result: SyncedLyricLine[] = [];
  const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
  const offsetMatch = lrcContent.match(/\[offset:([+-]?\d+)\]/i);
  const offsetSeconds = offsetMatch ? Number(offsetMatch[1]) / 1000 : 0;

  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine) continue;

    timeRegex.lastIndex = 0;
    const matches = Array.from(cleanLine.matchAll(timeRegex));
    if (matches.length) {
      const text = cleanLine.replace(timeRegex, "").trim();
      for (const match of matches) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const millisFraction = match[3] ? parseFloat(`0.${match[3]}`) : 0;
        const totalSeconds = Math.max(0, minutes * 60 + seconds + millisFraction + offsetSeconds);

        result.push({
          time: parseFloat(totalSeconds.toFixed(3)),
          text,
        });
      }
    }
  }

  const sorted = result.sort((a, b) => a.time - b.time);
  return sorted.map((line, index) => ({
    ...line,
    endTime: sorted[index + 1]?.time,
  }));
}
