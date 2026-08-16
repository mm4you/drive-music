export type SyncedLyricLine = {
  time: number;
  text: string;
};

export type TrackLyrics = {
  trackId: string;
  title: string;
  lyrics?: string[];
  syncedLyrics?: SyncedLyricLine[];
};
