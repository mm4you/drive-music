"use client";
/* eslint-disable @next/next/no-img-element -- local HVL artwork is already sized and shipped as static assets */

import type { CSSProperties, FormEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

type Track = {
  id: string;
  title: string;
  artist: string;
  originalUrl: string;
  artworkUrl?: string;
  album?: string;
  format?: string;
  size?: number;
};

type MusicPlaylist = {
  id: string;
  name: string;
  tracks: Track[];
};

type RepeatMode = "off" | "once" | "twice";

type LibraryPayload = {
  playlists: MusicPlaylist[];
  activePlaylistId: string;
  settings: {
    shuffleEnabled: boolean;
    autoPlayEnabled: boolean;
    repeatMode: RepeatMode;
    repeatOneEnabled?: boolean;
  };
};

type SyncUser = {
  displayName: string;
  email: string;
  role: "admin" | "user";
};

type SyncSnapshot = {
  payload: LibraryPayload;
  revision: number;
  updatedAt: number;
};

type SyncStatus = "checking" | "local" | "pending" | "syncing" | "synced" | "offline" | "error";

type DriveMetadata = {
  sourceUrl: string;
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  filename?: string | null;
  format?: string | null;
  size?: number;
};

type DriveFolderFile = {
  id: string;
  name: string;
  mimeType: string;
  path: string;
  size?: number;
};

type DriveFolderListing = {
  folderId: string;
  folderName: string;
  files: DriveFolderFile[];
  skipped: number;
  inaccessibleFolders: number;
  truncated: boolean;
  limit: number;
};

type FolderImportProgress = {
  phase: "listing" | "metadata";
  completed: number;
  total: number;
  currentName?: string;
};

type SharedCatalogSnapshot = {
  complete: boolean;
  imported: number;
  total: number;
  tracks: Track[];
  error?: string;
};

type IconName =
  | "add"
  | "autoplay"
  | "close"
  | "cloud"
  | "drive"
  | "github"
  | "info"
  | "install"
  | "link"
  | "music"
  | "next"
  | "pause"
  | "play"
  | "previous"
  | "queue"
  | "repeat"
  | "repeatOne"
  | "repeatTwo"
  | "share"
  | "shield"
  | "shuffle"
  | "spotify"
  | "trash"
  | "volumeHigh"
  | "volumeMute"
  | "youtube";

const STORAGE_KEY = "drive-music-playlists-v2";
const LEGACY_STORAGE_KEY = "drive-music-playlist-v1";
const SETTINGS_KEY = "drive-music-settings-v1";
const SYNC_REVISION_KEY = "drive-music-sync-revision-v1";
const SYNC_PAYLOAD_KEY = "drive-music-sync-payload-v1";
const ACCOUNT_CACHE_KEY = "drive-music-account-cache-v1";
const LAST_ACCOUNT_KEY = "drive-music-last-account-v1";
const VOLUME_KEY = "drive-music-volume-v1";
const LIBRARY_VISIBILITY_KEY = "drive-music-library-visible-v1";
const ABOUT_SEEN_KEY = "hvl-30-about-seen-v1";
const STARTUP_FALLBACK_MS = 8000;
const SOURCE_RETRY_DELAYS = [450, 1100, 2400];
const PLAY_PERMISSION_RETRY_DELAYS = [180, 650, 1600];
const IOS_END_HANDOFF_SECONDS = 0.55;
const ACCOUNT_FEATURES_ENABLED = false;

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    add: <path d="M12 5v14M5 12h14" />,
    autoplay: (
      <>
        <path d="M5.2 8.2A7.5 7.5 0 0 1 18 5.8L20 8" />
        <path d="M20 4v4h-4" />
        <path d="M18.8 15.8A7.5 7.5 0 0 1 6 18.2L4 16" />
        <path d="M4 20v-4h4" />
        <path d="m10 9 5 3-5 3Z" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    cloud: (
      <>
        <path d="M7 18h10a4 4 0 0 0 .7-7.9A6 6 0 0 0 6.4 8.4 4.8 4.8 0 0 0 7 18Z" />
        <path d="m9.5 13 2 2 3.5-4" />
      </>
    ),
    drive: (
      <>
        <path d="m8.4 3.5-5.2 9 3 5.2 5.2-9Z" />
        <path d="M8.4 3.5h6.1l5.2 9h-6.1Z" />
        <path d="M6.2 17.7 9.3 12h10.4l-3 5.7Z" />
      </>
    ),
    github: (
      <>
        <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3.3-.4 6.8-1.6 6.8-7.4A5.8 5.8 0 0 0 19.3 3 5.4 5.4 0 0 0 19.1 0S17.9-.4 15 1.6a14 14 0 0 0-6 0C6.1-.4 4.9 0 4.9 0a5.4 5.4 0 0 0-.2 3A5.8 5.8 0 0 0 3.2 7.1c0 5.8 3.5 7 6.8 7.4A4.8 4.8 0 0 0 9 18v4" />
        <path d="M9 19c-3 .9-3-1.5-4.2-2" />
      </>
    ),
    install: (
      <>
        <path d="M12 3v12m0 0 5-5m-5 5-5-5" />
        <path d="M5 19v2h14v-2" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </>
    ),
    link: (
      <>
        <path d="m10 13.8 4-4" />
        <path d="M7.2 15.8 5.4 17.6a3.7 3.7 0 0 1-5.2-5.2L4 8.6a3.7 3.7 0 0 1 5.2 0" transform="translate(3)" />
        <path d="m16.8 8.2 1.8-1.8a3.7 3.7 0 0 0-5.2-5.2L9.6 5a3.7 3.7 0 0 0 0 5.2" transform="translate(-3 5)" />
      </>
    ),
    music: (
      <>
        <path d="M9 18V5l10-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="16" cy="16" r="3" />
      </>
    ),
    next: (
      <>
        <path d="m7 6 9 6-9 6Z" />
        <path d="M18 6v12" />
      </>
    ),
    pause: (
      <>
        <path d="M8 5v14" />
        <path d="M16 5v14" />
      </>
    ),
    play: <path d="m8 5 11 7-11 7Z" />,
    previous: (
      <>
        <path d="m17 6-9 6 9 6Z" />
        <path d="M6 6v12" />
      </>
    ),
    queue: (
      <>
        <path d="M9 6h11M9 12h11M9 18h11" />
        <circle cx="4.5" cy="6" r="1" />
        <circle cx="4.5" cy="12" r="1" />
        <circle cx="4.5" cy="18" r="1" />
      </>
    ),
    repeat: (
      <>
        <path d="M17 2.8 20.2 6 17 9.2" />
        <path d="M3.8 11V9a3 3 0 0 1 3-3h13.4" />
        <path d="M7 21.2 3.8 18 7 14.8" />
        <path d="M20.2 13v2a3 3 0 0 1-3 3H3.8" />
      </>
    ),
    repeatOne: (
      <>
        <path d="M17 2.8 20.2 6 17 9.2" />
        <path d="M3.8 11V9a3 3 0 0 1 3-3h13.4" />
        <path d="M7 21.2 3.8 18 7 14.8" />
        <path d="M20.2 13v2a3 3 0 0 1-3 3H3.8" />
        <path d="M12 10v5M10.5 11.5 12 10" />
      </>
    ),
    repeatTwo: (
      <>
        <path d="M17 2.8 20.2 6 17 9.2" />
        <path d="M3.8 11V9a3 3 0 0 1 3-3h13.4" />
        <path d="M7 21.2 3.8 18 7 14.8" />
        <path d="M20.2 13v2a3 3 0 0 1-3 3H3.8" />
        <path d="M10.2 11.3a1.8 1.8 0 0 1 3.6 0c0 1.4-3.6 2.2-3.6 3.7h3.6" />
      </>
    ),
    share: (
      <>
        <path d="M12 16V3m0 0L7.5 7.5M12 3l4.5 4.5" />
        <path d="M5 11v9h14v-9" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 5 6v5c0 4.6 2.7 8 7 10 4.3-2 7-5.4 7-10V6Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    shuffle: (
      <>
        <path d="M4 7h2.5c4.2 0 6.4 10 10.5 10h3" />
        <path d="m17 14 3 3-3 3" />
        <path d="M4 17h2.5c1.7 0 3-1.7 4.2-3.7M14.2 7H20" />
        <path d="m17 4 3 3-3 3" />
      </>
    ),
    spotify: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M7.6 9.7c3.7-1 7.3-.7 10.4.9M8.4 13c3-.8 5.9-.5 8.6.7M9.2 16c2.3-.5 4.6-.3 6.7.6" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M9 3h6l1 4H8Z" />
        <path d="m6 7 1 14h10l1-14M10 11v6M14 11v6" />
      </>
    ),
    volumeHigh: (
      <>
        <path d="M11 5 6.8 8.5H3v7h3.8L11 19Z" />
        <path d="M15 8.3a5.2 5.2 0 0 1 0 7.4M17.8 5.8a8.7 8.7 0 0 1 0 12.4" />
      </>
    ),
    volumeMute: (
      <>
        <path d="M11 5 6.8 8.5H3v7h3.8L11 19Z" />
        <path d="m16 10 5 5m0-5-5 5" />
      </>
    ),
    youtube: (
      <>
        <path d="M21 8.2a3 3 0 0 0-2.1-2.1C17.1 5.6 12 5.6 12 5.6s-5.1 0-6.9.5A3 3 0 0 0 3 8.2 31 31 0 0 0 2.6 12 31 31 0 0 0 3 15.8a3 3 0 0 0 2.1 2.1c1.8.5 6.9.5 6.9.5s5.1 0 6.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .4-3.8 31 31 0 0 0-.4-3.8Z" />
        <path d="m10 9 5 3-5 3Z" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[name]}
      </g>
    </svg>
  );
}

function googleDriveFileId(value: string) {
  try {
    const url = new URL(value);
    const pathMatch = url.pathname.match(/\/file\/d\/([^/]+)/) ?? url.pathname.match(/\/d\/([^/]+)/);
    return pathMatch?.[1] ?? url.searchParams.get("id");
  } catch {
    return null;
  }
}

function googleDriveFolderId(value: string) {
  try {
    const url = new URL(value);
    if (!url.hostname.endsWith("drive.google.com")) return null;
    return url.pathname.match(/\/folders\/([^/]+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

function isGoogleDriveUrl(value: string) {
  try {
    const host = new URL(value).hostname;
    return host.endsWith("drive.google.com") || host.endsWith("drive.usercontent.google.com");
  } catch {
    return false;
  }
}

function sourceCandidates(value: string) {
  const fileId = isGoogleDriveUrl(value) ? googleDriveFileId(value) : null;
  if (!fileId) return [value];
  const id = encodeURIComponent(fileId);
  return Array.from({ length: SOURCE_RETRY_DELAYS.length + 1 }, (_, attempt) =>
    `/api/drive?id=${id}&stream=original-v3&attempt=${attempt}`,
  );
}

async function warmDriveTrack(value: string, signal: AbortSignal) {
  const fileId = isGoogleDriveUrl(value) ? googleDriveFileId(value) : null;
  if (!fileId) return false;
  const response = await fetch(sourceCandidates(value)[0], {
    headers: { Range: "bytes=0-131071" },
    signal,
  });
  if (response.status !== 206) {
    await response.body?.cancel();
    return false;
  }
  await response.arrayBuffer();
  return true;
}

async function readDriveMetadata(value: string, signal?: AbortSignal): Promise<DriveMetadata | null> {
  const fileId = isGoogleDriveUrl(value) ? googleDriveFileId(value) : null;
  if (!fileId) return null;
  const response = await fetch(`/api/drive?id=${encodeURIComponent(fileId)}&metadata=1`, {
    signal,
  });
  if (!response.ok) return null;
  const metadata = await response.json() as Omit<DriveMetadata, "sourceUrl">;
  return { ...metadata, sourceUrl: value };
}

async function readDriveFolder(folderId: string): Promise<DriveFolderListing> {
  const response = await fetch(`/api/drive?folder=${encodeURIComponent(folderId)}`, {
    cache: "no-store",
  });
  const result = await response.json() as DriveFolderListing & { error?: string };
  if (!response.ok) throw new Error(result.error || "Không thể đọc thư mục Google Drive.");
  return result;
}

async function mapWithConcurrency<T, Result>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<Result>,
) {
  const results = new Array<Result>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function titleFromDriveFileName(name: string) {
  return name
    .replace(/\.(?:mp3|flac|m4a|aac|ogg|oga|opus|wav)$/i, "")
    .replace(/^\s*\d{1,3}[.\s_-]+/, "")
    .trim() || "Bài hát từ Google Drive";
}

function inferredTitle(value: string) {
  if (isGoogleDriveUrl(value)) return "Bài hát từ Google Drive";
  try {
    const filename = decodeURIComponent(new URL(value).pathname.split("/").pop() || "");
    return filename.replace(/\.(mp3|flac|m4a|aac|ogg|wav)$/i, "") || "Bài hát mới";
  } catch {
    return "Bài hát mới";
  }
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "--:--";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function subscribeDeviceCapability() {
  return () => undefined;
}

function isAppleTouchDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function configurePlaybackAudioSession() {
  if (typeof navigator === "undefined") return;
  const audioSession = (navigator as Navigator & {
    audioSession?: { type: string };
  }).audioSession;
  if (!audioSession) return;
  try {
    audioSession.type = "playback";
  } catch {
    // Audio Session is optional and still varies between WebKit versions.
  }
}

function replacePlaybackSource(
  audio: HTMLAudioElement,
  source: string,
  preservePlaybackSession = false,
) {
  audio.autoplay = preservePlaybackSession;
  audio.src = source;
  // Setting src already starts loading. Calling load() during an automatic
  // handoff can reset WebKit's active playback session and require a new tap.
  if (!preservePlaybackSession) audio.load();
}

function libraryPayload(
  playlists: MusicPlaylist[],
  activePlaylistId: string,
  shuffleEnabled: boolean,
  autoPlayEnabled: boolean,
  repeatMode: RepeatMode,
): LibraryPayload {
  return {
    playlists,
    activePlaylistId,
    settings: { shuffleEnabled, autoPlayEnabled, repeatMode },
  };
}

function serializedPayload(payload: LibraryPayload) {
  return JSON.stringify(payload);
}

function accountKey(base: string, email: string) {
  return `${base}:${encodeURIComponent(email.trim().toLocaleLowerCase())}`;
}

function cachedLibraryPayload(raw: string | null): LibraryPayload | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as LibraryPayload;
    if (!Array.isArray(value.playlists) || !value.playlists.length) return null;
    if (!value.playlists.every((playlist) => playlist?.id && playlist?.name && Array.isArray(playlist.tracks))) return null;
    if (!value.settings || typeof value.settings.shuffleEnabled !== "boolean" || typeof value.settings.autoPlayEnabled !== "boolean") return null;
    return {
      ...value,
      settings: {
        ...value.settings,
        repeatMode: value.settings.repeatMode === "once" || value.settings.repeatMode === "twice"
          ? value.settings.repeatMode
          : value.settings.repeatOneEnabled === true ? "once" : "off",
      },
    };
  } catch {
    return null;
  }
}

function emptyLibraryPayload(): LibraryPayload {
  return libraryPayload(
    [{ id: "default", name: "Playlist của tôi", tracks: [] }],
    "default",
    "off",
    true,
    false,
  );
}

function hasLibraryContent(payload: LibraryPayload) {
  return payload.playlists.length > 1 || payload.playlists.some((playlist) => playlist.tracks.length > 0);
}

function trackIdentity(track: Track) {
  const driveId = googleDriveFileId(track.originalUrl);
  return driveId ? `drive:${driveId}` : `url:${track.originalUrl.trim()}`;
}

function mergeLibraryPayloads(local: LibraryPayload, remote: LibraryPayload): LibraryPayload {
  const merged = remote.playlists.map((playlist) => ({
    ...playlist,
    tracks: [...playlist.tracks],
  }));
  const playlistIndex = new Map(merged.map((playlist, index) => [playlist.id, index]));

  for (const localPlaylist of local.playlists) {
    const existingIndex = playlistIndex.get(localPlaylist.id);
    if (existingIndex === undefined) {
      playlistIndex.set(localPlaylist.id, merged.length);
      merged.push({ ...localPlaylist, tracks: [...localPlaylist.tracks] });
      continue;
    }
    const existing = merged[existingIndex];
    const tracks = new Map(existing.tracks.map((track) => [trackIdentity(track), track]));
    localPlaylist.tracks.forEach((track) => tracks.set(trackIdentity(track), track));
    merged[existingIndex] = {
      ...existing,
      name: localPlaylist.name,
      tracks: Array.from(tracks.values()),
    };
  }

  const activePlaylistId = merged.some((playlist) => playlist.id === local.activePlaylistId)
    ? local.activePlaylistId
    : remote.activePlaylistId;
  return {
    playlists: merged,
    activePlaylistId,
    settings: local.settings,
  };
}

function syncStatusLabel(status: SyncStatus) {
  if (status === "checking") return "Đang kiểm tra tài khoản";
  if (status === "pending") return "Đang chờ đồng bộ";
  if (status === "syncing") return "Đang đồng bộ";
  if (status === "synced") return "Đã đồng bộ";
  if (status === "offline") return "Ngoại tuyến · sẽ đồng bộ lại";
  if (status === "error") return "Chưa đồng bộ được";
  return "Chỉ lưu trên thiết bị";
}

export default function Home() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const preloadAudioRef = useRef<HTMLAudioElement>(null);
  const playlistRef = useRef<Track[]>([]);
  const sourceListRef = useRef<string[]>([]);
  const sourceIndexRef = useRef(0);
  const activeTrackIdRef = useRef<string | null>(null);
  const shouldResumeRef = useRef(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumePositionRef = useRef(0);
  const endHandoffTrackIdRef = useRef<string | null>(null);
  const autoAdvanceInFlightRef = useRef(false);
  const consecutiveTrackFailuresRef = useRef(0);
  const playPermissionRetryRef = useRef(0);
  const repeatCompletionRef = useRef(0);
  const requestPlaybackRef = useRef<(audio: HTMLAudioElement) => void>(() => undefined);
  const controlNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlAudioContextRef = useRef<AudioContext | null>(null);
  const queuedTrackIdRef = useRef<string | null>(null);
  const preloadedTrackIdRef = useRef<string | null>(null);
  const warmedTrackIdRef = useRef<string | null>(null);
  const warmupAbortRef = useRef<AbortController | null>(null);
  const lastAudibleVolumeRef = useRef(0.85);
  const metadataUpgradeStartedRef = useRef(false);
  const syncInitializedRef = useRef(false);
  const syncReadyRef = useRef(false);
  const syncApplyingRef = useRef(false);
  const syncRevisionRef = useRef(0);
  const syncAccountEmailRef = useRef<string | null>(null);
  const lastSyncedPayloadRef = useRef("");
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncInFlightRef = useRef(false);
  const pendingSyncRef = useRef<LibraryPayload | null>(null);
  const latestPayloadRef = useRef<LibraryPayload | null>(null);
  const sharedCatalogRef = useRef(false);
  const sharedCatalogAppliedRef = useRef(false);
  const aboutAutoOpenedRef = useRef(false);
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([
    { id: "default", name: "Playlist của tôi", tracks: [] },
  ]);
  const [activePlaylistId, setActivePlaylistId] = useState("default");
  const [playbackPlaylistId, setPlaybackPlaylistId] = useState("default");
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [libraryVisible, setLibraryVisible] = useState(true);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState("");
  const [controlNotice, setControlNotice] = useState("");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [driveMetadata, setDriveMetadata] = useState<DriveMetadata | null>(null);
  const [readingMetadata, setReadingMetadata] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [folderImport, setFolderImport] = useState<FolderImportProgress | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [sharedCatalogTracks, setSharedCatalogTracks] = useState<Track[]>([]);
  const [syncUser, setSyncUser] = useState<SyncUser | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("checking");
  const [syncPanelOpen, setSyncPanelOpen] = useState(false);
  const [adminStats, setAdminStats] = useState<{
    accountCount: number;
    playlistCount: number;
    trackCount: number;
    latestSyncAt: number | null;
    accounts: Array<{ name: string | null }>;
  } | null>(null);
  const [adminStatsLoading, setAdminStatsLoading] = useState(false);

  const activePlaylist = useMemo(
    () => playlists.find((item) => item.id === activePlaylistId) ?? playlists[0],
    [activePlaylistId, playlists],
  );
  const folderLinkId = googleDriveFolderId(url.trim());
  const playlist = useMemo(() => activePlaylist?.tracks ?? [], [activePlaylist]);
  const playbackPlaylist = useMemo(
    () => playlists.find((item) => item.id === playbackPlaylistId) ?? activePlaylist,
    [activePlaylist, playbackPlaylistId, playlists],
  );
  const playbackQueue = useMemo(() => playbackPlaylist?.tracks ?? [], [playbackPlaylist]);
  const syncPayload = useMemo(
    () => libraryPayload(playlists, activePlaylistId, shuffleEnabled, autoPlayEnabled, repeatMode),
    [activePlaylistId, autoPlayEnabled, playlists, repeatMode, shuffleEnabled],
  );
  const setPlaylist = useCallback((update: Track[] | ((current: Track[]) => Track[])) => {
    setPlaylists((current) => current.map((item) => {
      if (item.id !== activePlaylistId) return item;
      const tracks = typeof update === "function" ? update(item.tracks) : update;
      return { ...item, tracks };
    }));
  }, [activePlaylistId]);

  const currentTrack = useMemo(
    () => (currentIndex === null ? null : playbackQueue[currentIndex] ?? null),
    [currentIndex, playbackQueue],
  );
  const activeHue = 3;
  const usesSystemVolume = useSyncExternalStore(
    subscribeDeviceCapability,
    isAppleTouchDevice,
    () => false,
  );

  useEffect(() => {
    document.documentElement.style.setProperty("--track-hue", String(activeHue));
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    themeColor?.setAttribute("content", "#120505");
  }, [activeHue]);

  useEffect(() => {
    if (!aboutOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [aboutOpen]);

  useEffect(() => {
    if (!hydrated || !sharedCatalogTracks.length || aboutAutoOpenedRef.current) return;
    aboutAutoOpenedRef.current = true;
    try {
      if (localStorage.getItem(ABOUT_SEEN_KEY) !== "1") setAboutOpen(true);
    } catch {
      // The introduction remains available from the fixed navigation.
    }
  }, [hydrated, sharedCatalogTracks.length]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const store = JSON.parse(saved) as { playlists?: MusicPlaylist[]; activePlaylistId?: string };
          const validPlaylists = Array.isArray(store.playlists)
            ? store.playlists
              .filter((item) => item?.id && item?.name && Array.isArray(item.tracks))
              .map((item) => ({
                ...item,
                tracks: item.tracks.filter((track) => track?.id && track?.originalUrl),
              }))
            : [];
          if (validPlaylists.length) {
            const savedActiveId = validPlaylists.some((item) => item.id === store.activePlaylistId)
              ? store.activePlaylistId as string
              : validPlaylists[0].id;
            const activeTracks = validPlaylists.find((item) => item.id === savedActiveId)?.tracks ?? [];
            playlistRef.current = activeTracks;
            setPlaylists(validPlaylists);
            setActivePlaylistId(savedActiveId);
            setPlaybackPlaylistId(savedActiveId);
            if (activeTracks.length) setCurrentIndex(0);
          }
        } else {
          const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
          const tracks = legacy ? JSON.parse(legacy) as Track[] : [];
          const validTracks = Array.isArray(tracks)
            ? tracks.filter((track) => track?.id && track?.originalUrl)
            : [];
          if (validTracks.length) {
            playlistRef.current = validTracks;
            setPlaylists([{ id: "default", name: "Playlist của tôi", tracks: validTracks }]);
            setCurrentIndex(0);
          }
        }
        const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") as {
          shuffleEnabled?: boolean;
          autoPlayEnabled?: boolean;
          repeatMode?: RepeatMode | "all" | "one";
          repeatOneEnabled?: boolean;
        };
        if (typeof settings.shuffleEnabled === "boolean") setShuffleEnabled(settings.shuffleEnabled);
        if (typeof settings.autoPlayEnabled === "boolean") setAutoPlayEnabled(settings.autoPlayEnabled);
        if (settings.repeatMode === "once" || settings.repeatMode === "twice" || settings.repeatMode === "off") {
          setRepeatMode(settings.repeatMode);
        } else if (settings.repeatMode === "all" || settings.repeatMode === "one") {
          setRepeatMode("once");
        } else if (settings.repeatOneEnabled === true) {
          setRepeatMode("one");
        }
        const rawSavedVolume = localStorage.getItem(VOLUME_KEY);
        const savedVolume = rawSavedVolume === null ? Number.NaN : Number(rawSavedVolume);
        if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1) {
          setVolume(savedVolume);
          if (savedVolume > 0.01) lastAudibleVolumeRef.current = savedVolume;
        }
        const savedLibraryVisibility = localStorage.getItem(LIBRARY_VISIBILITY_KEY);
        if (savedLibraryVisibility === "hidden") setLibraryVisible(false);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setHydrated(true);
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    playlistRef.current = playbackQueue;
  }, [playbackQueue]);

  useEffect(() => {
    if (!hydrated) return;
    if (syncUser) {
      localStorage.setItem(accountKey(ACCOUNT_CACHE_KEY, syncUser.email), serializedPayload(syncPayload));
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ playlists, activePlaylistId }));
  }, [activePlaylistId, hydrated, playlists, syncPayload, syncUser]);

  useEffect(() => {
    if (!hydrated || syncUser) return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ shuffleEnabled, autoPlayEnabled, repeatMode }));
  }, [autoPlayEnabled, hydrated, repeatMode, shuffleEnabled, syncUser]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.loop = false;
    repeatCompletionRef.current = 0;
  }, [repeatMode]);

  useEffect(() => {
    repeatCompletionRef.current = 0;
  }, [currentTrack?.id]);

  const playControlClick = useCallback(() => {
    try {
      const context = controlAudioContextRef.current ?? new AudioContext();
      controlAudioContextRef.current = context;
      const emit = () => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const now = context.currentTime;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(520, now);
        oscillator.frequency.exponentialRampToValueAtTime(360, now + 0.035);
        gain.gain.setValueAtTime(0.018, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.045);
      };
      if (context.state === "suspended") {
        void context.resume().then(emit).catch(() => undefined);
      } else {
        emit();
      }
    } catch {
      // Some browsers may block Web Audio even after a direct user gesture.
    }
  }, []);

  const showControlNotice = useCallback((notice: string) => {
    if (controlNoticeTimerRef.current) clearTimeout(controlNoticeTimerRef.current);
    setControlNotice(notice);
    controlNoticeTimerRef.current = setTimeout(() => {
      controlNoticeTimerRef.current = null;
      setControlNotice("");
    }, 1450);
  }, []);

  const handleButtonFeedback = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    playControlClick();
    if (button.dataset.notice === "off") return;
    const label = button.getAttribute("aria-label")?.trim();
    if (label) showControlNotice(label);
  }, [playControlClick, showControlNotice]);

  useEffect(() => () => {
    if (controlNoticeTimerRef.current) clearTimeout(controlNoticeTimerRef.current);
    if (controlAudioContextRef.current) void controlAudioContextRef.current.close();
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio && !usesSystemVolume) {
      try {
        audio.volume = volume;
      } catch {
        // iOS may reserve volume control for the hardware buttons.
      }
    }
    if (volume > 0.01) lastAudibleVolumeRef.current = volume;
    if (hydrated) localStorage.setItem(VOLUME_KEY, String(volume));
  }, [hydrated, usesSystemVolume, volume]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(LIBRARY_VISIBILITY_KEY, libraryVisible ? "visible" : "hidden");
  }, [hydrated, libraryVisible]);

  const applySyncedPayload = useCallback((payload: LibraryPayload) => {
    syncApplyingRef.current = true;
    if (sharedCatalogRef.current) {
      setShuffleEnabled(payload.settings.shuffleEnabled);
      setAutoPlayEnabled(payload.settings.autoPlayEnabled);
      setRepeatMode(payload.settings.repeatMode);
      queueMicrotask(() => { syncApplyingRef.current = false; });
      return;
    }
    const activeId = payload.playlists.some((item) => item.id === payload.activePlaylistId)
      ? payload.activePlaylistId
      : payload.playlists[0]?.id;
    if (!activeId) return;
    const playingId = activeTrackIdRef.current;
    const playbackOwner = playingId
      ? payload.playlists.find((item) => item.tracks.some((track) => track.id === playingId))
      : payload.playlists.find((item) => item.id === activeId);
    const nextPlayback = playbackOwner ?? payload.playlists.find((item) => item.id === activeId);
    const playbackTracks = nextPlayback?.tracks ?? [];
    const playingIndex = playingId ? playbackTracks.findIndex((track) => track.id === playingId) : -1;
    playlistRef.current = playbackTracks;
    metadataUpgradeStartedRef.current = false;
    setPlaylists(payload.playlists);
    setActivePlaylistId(activeId);
    setPlaybackPlaylistId(nextPlayback?.id ?? activeId);
    setShuffleEnabled(payload.settings.shuffleEnabled);
    setAutoPlayEnabled(payload.settings.autoPlayEnabled);
    setRepeatMode(payload.settings.repeatMode);
    setCurrentIndex(playbackTracks.length ? (playingIndex >= 0 ? playingIndex : 0) : null);
    queueMicrotask(() => { syncApplyingRef.current = false; });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    const loadSharedCatalog = async () => {
      try {
        const response = await fetch("/api/catalog", { cache: "no-store" });
        const snapshot = await response.json() as SharedCatalogSnapshot;
        if (!response.ok) throw new Error(snapshot.error || "Chưa đọc được thư viện chung.");
        if (!active || !snapshot.complete || !snapshot.tracks.length) return;
        sharedCatalogRef.current = true;
        setSharedCatalogTracks(snapshot.tracks);
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Chưa đọc được thư viện chung.");
      }
    };
    void loadSharedCatalog();
    return () => { active = false; };
  }, [hydrated]);

  useEffect(() => {
    if (!sharedCatalogTracks.length || sharedCatalogAppliedRef.current || isPlaying) return;
    sharedCatalogAppliedRef.current = true;
    const audio = audioRef.current;
    shouldResumeRef.current = false;
    audio?.pause();
    if (audio) {
      audio.removeAttribute("src");
      audio.load();
    }
    activeTrackIdRef.current = null;
    const playlist = { id: "default", name: "HVL 30", tracks: sharedCatalogTracks };
    playlistRef.current = sharedCatalogTracks;
    setPlaylists([playlist]);
    setActivePlaylistId(playlist.id);
    setPlaybackPlaylistId(playlist.id);
    setCurrentIndex(0);
    setCurrentTime(0);
    setDuration(0);
  }, [isPlaying, sharedCatalogTracks]);

  const pushSyncPayload = useCallback(async (initialPayload: LibraryPayload) => {
    let payload = initialPayload;
    try {
      setSyncStatus("syncing");
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetch("/api/sync", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload, baseRevision: syncRevisionRef.current }),
        });
        if (response.status === 401) {
          setSyncUser(null);
          syncAccountEmailRef.current = null;
          syncReadyRef.current = false;
          setSyncStatus("local");
          return false;
        }
        const result = await response.json() as {
          user?: SyncUser;
          snapshot?: SyncSnapshot | null;
        };
        if (response.status === 409) {
          syncRevisionRef.current = result.snapshot?.revision ?? 0;
          if (result.snapshot) payload = mergeLibraryPayloads(payload, result.snapshot.payload);
          applySyncedPayload(payload);
          continue;
        }
        if (!response.ok || !result.snapshot) throw new Error("Sync failed");
        syncRevisionRef.current = result.snapshot.revision;
        const savedPayload = serializedPayload(result.snapshot.payload);
        lastSyncedPayloadRef.current = savedPayload;
        const accountEmail = result.user?.email ?? syncAccountEmailRef.current;
        if (accountEmail) {
          syncAccountEmailRef.current = accountEmail;
          localStorage.setItem(accountKey(SYNC_REVISION_KEY, accountEmail), String(result.snapshot.revision));
          localStorage.setItem(accountKey(SYNC_PAYLOAD_KEY, accountEmail), savedPayload);
          localStorage.setItem(accountKey(ACCOUNT_CACHE_KEY, accountEmail), savedPayload);
        }
        if (result.user) setSyncUser(result.user);
        setSyncStatus("synced");
        return true;
      }
      throw new Error("Sync conflict");
    } catch {
      setSyncStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
      return false;
    }
  }, [applySyncedPayload]);

  const queueSync = useCallback((payload: LibraryPayload) => {
    if (serializedPayload(payload) === lastSyncedPayloadRef.current) return;
    pendingSyncRef.current = payload;
    if (syncInFlightRef.current) return;
    void (async () => {
      syncInFlightRef.current = true;
      while (pendingSyncRef.current) {
        const nextPayload = pendingSyncRef.current;
        pendingSyncRef.current = null;
        if (serializedPayload(nextPayload) === lastSyncedPayloadRef.current) continue;
        const synced = await pushSyncPayload(nextPayload);
        if (!synced) {
          pendingSyncRef.current = nextPayload;
          break;
        }
      }
      syncInFlightRef.current = false;
    })();
  }, [pushSyncPayload]);

  useEffect(() => {
    latestPayloadRef.current = syncPayload;
    if (!hydrated || !syncUser || !syncReadyRef.current || syncApplyingRef.current) return;
    if (serializedPayload(syncPayload) === lastSyncedPayloadRef.current) return;
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => queueSync(syncPayload), 1200);
    return () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, [hydrated, queueSync, syncPayload, syncUser]);

  useEffect(() => {
    if (!ACCOUNT_FEATURES_ENABLED || !hydrated || syncInitializedRef.current) return;
    syncInitializedRef.current = true;
    let active = true;
    void fetch("/api/sync", { cache: "no-store" })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) {
          setSyncStatus("local");
          return;
        }
        if (!response.ok) throw new Error("Account check failed");
        const result = await response.json() as { user: SyncUser; snapshot: SyncSnapshot | null };
        if (!active) return;
        const normalizedEmail = result.user.email.trim().toLocaleLowerCase();
        const previousAccount = localStorage.getItem(LAST_ACCOUNT_KEY)?.trim().toLocaleLowerCase() || "";
        const cachedForAccount = cachedLibraryPayload(
          localStorage.getItem(accountKey(ACCOUNT_CACHE_KEY, normalizedEmail)),
        );
        const localCandidate = cachedForAccount ?? (
          !previousAccount || previousAccount === normalizedEmail ? syncPayload : emptyLibraryPayload()
        );
        syncAccountEmailRef.current = normalizedEmail;
        localStorage.setItem(LAST_ACCOUNT_KEY, normalizedEmail);
        setSyncUser(result.user);
        syncReadyRef.current = true;
        if (!result.snapshot) {
          syncRevisionRef.current = 0;
          lastSyncedPayloadRef.current = "";
          applySyncedPayload(localCandidate);
          queueSync(localCandidate);
          return;
        }

        const remote = result.snapshot.payload;
        const localText = serializedPayload(localCandidate);
        const remoteText = serializedPayload(remote);
        const storedText = localStorage.getItem(accountKey(SYNC_PAYLOAD_KEY, normalizedEmail)) || "";
        const knownRevision = Number(localStorage.getItem(accountKey(SYNC_REVISION_KEY, normalizedEmail)) || 0);
        const localDirty = storedText ? localText !== storedText : hasLibraryContent(localCandidate);
        syncRevisionRef.current = result.snapshot.revision;

        let resolved = remote;
        let shouldUpload = false;
        if (localText !== remoteText && !(!hasLibraryContent(localCandidate) && knownRevision === 0)) {
          if (localDirty || knownRevision !== result.snapshot.revision) {
            resolved = mergeLibraryPayloads(localCandidate, remote);
            shouldUpload = serializedPayload(resolved) !== remoteText;
          }
        }

        applySyncedPayload(resolved);
        if (shouldUpload) {
          lastSyncedPayloadRef.current = remoteText;
          localStorage.setItem(accountKey(SYNC_REVISION_KEY, normalizedEmail), String(result.snapshot.revision));
          localStorage.setItem(accountKey(SYNC_PAYLOAD_KEY, normalizedEmail), remoteText);
          localStorage.setItem(accountKey(ACCOUNT_CACHE_KEY, normalizedEmail), serializedPayload(resolved));
          queueSync(resolved);
        } else {
          const resolvedText = serializedPayload(resolved);
          lastSyncedPayloadRef.current = resolvedText;
          localStorage.setItem(accountKey(SYNC_REVISION_KEY, normalizedEmail), String(result.snapshot.revision));
          localStorage.setItem(accountKey(SYNC_PAYLOAD_KEY, normalizedEmail), resolvedText);
          localStorage.setItem(accountKey(ACCOUNT_CACHE_KEY, normalizedEmail), resolvedText);
          setSyncStatus("synced");
        }
      })
      .catch(() => {
        if (active) setSyncStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
      });
    return () => { active = false; };
  }, [applySyncedPayload, hydrated, queueSync, syncPayload]);

  useEffect(() => {
    const onOnline = () => {
      if (syncUser && syncReadyRef.current && latestPayloadRef.current) queueSync(latestPayloadRef.current);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [queueSync, syncUser]);

  useEffect(() => {
    if ("caches" in window) {
      void caches.keys().then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("drive-music-shell")).map((key) => caches.delete(key)),
      ));
    }
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js?v=6", { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const value = url.trim();
    if (!isGoogleDriveUrl(value) || !googleDriveFileId(value)) return;
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(() => {
      setReadingMetadata(true);
      void readDriveMetadata(value, controller.signal)
        .then((metadata) => {
          if (!active || !metadata) return;
          setDriveMetadata(metadata);
          setTitle((current) => current || metadata.title || "");
          setArtist((current) => current || metadata.artist || "");
        })
        .catch(() => undefined)
        .finally(() => {
          if (active) setReadingMetadata(false);
        });
    }, 350);
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [url]);

  useEffect(() => {
    if (!hydrated || metadataUpgradeStartedRef.current) return;
    metadataUpgradeStartedRef.current = true;
    const targets = playlist.filter((track) =>
      isGoogleDriveUrl(track.originalUrl) &&
      (!track.format || track.title === "Bài hát từ Google Drive" || track.artist === "Không rõ nghệ sĩ"),
    );
    if (!targets.length) return;
    let active = true;
    void Promise.all(targets.map(async (track) => ({
      id: track.id,
      metadata: await readDriveMetadata(track.originalUrl).catch(() => null),
    }))).then((results) => {
      if (!active) return;
      const metadataById = new Map(results.map((result) => [result.id, result.metadata]));
      setPlaylist((current) => current.map((track) => {
        const metadata = metadataById.get(track.id);
        if (!metadata) return track;
        return {
          ...track,
          title: track.title === "Bài hát từ Google Drive" ? metadata.title || track.title : track.title,
          artist: track.artist === "Không rõ nghệ sĩ" ? metadata.artist || track.artist : track.artist,
          album: track.album || metadata.album || undefined,
          format: track.format || metadata.format || undefined,
          size: track.size || metadata.size || undefined,
        };
      }));
    });
    return () => { active = false; };
  }, [hydrated, playlist, setPlaylist]);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = null;
  }, []);

  const clearRecoveryTimer = useCallback(() => {
    if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    recoveryTimerRef.current = null;
  }, []);

  const clearTrackWarmup = useCallback(() => {
    warmupAbortRef.current?.abort();
    warmupAbortRef.current = null;
    warmedTrackIdRef.current = null;
  }, []);

  const armFallbackTimer = useCallback(() => {
    clearFallbackTimer();
    fallbackTimerRef.current = setTimeout(() => {
      const audio = audioRef.current;
      if (!audio || !shouldResumeRef.current || audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return;
      const nextSource = sourceListRef.current[sourceIndexRef.current + 1];
      if (!nextSource) {
        setIsBuffering(false);
        setMessage("File tải quá lâu. Hãy kiểm tra lại quyền công khai của file Drive.");
        return;
      }
      resumePositionRef.current = Number.isFinite(audio.currentTime) && audio.currentTime > 1
        ? audio.currentTime
        : 0;
      sourceIndexRef.current += 1;
      replacePlaybackSource(audio, nextSource, isAppleTouchDevice());
      configurePlaybackAudioSession();
      playPermissionRetryRef.current = 0;
      requestPlaybackRef.current(audio);
    }, STARTUP_FALLBACK_MS);
  }, [clearFallbackTimer]);

  const requestPlayback = useCallback(function attemptPlayback(audio: HTMLAudioElement) {
    void audio.play().catch((error: unknown) => {
      if (!shouldResumeRef.current) return;
      const errorName = error && typeof error === "object" && "name" in error
        ? String((error as { name?: unknown }).name ?? "")
        : "";
      if (errorName === "NotAllowedError") {
        clearFallbackTimer();
        setIsBuffering(true);
        if (document.visibilityState === "hidden") {
          return;
        }
        const retryIndex = playPermissionRetryRef.current;
        if (retryIndex < PLAY_PERMISSION_RETRY_DELAYS.length) {
          playPermissionRetryRef.current += 1;
          clearRecoveryTimer();
          recoveryTimerRef.current = setTimeout(() => {
            recoveryTimerRef.current = null;
            if (shouldResumeRef.current && audio === audioRef.current) attemptPlayback(audio);
          }, PLAY_PERMISSION_RETRY_DELAYS[retryIndex]);
          return;
        }
        shouldResumeRef.current = false;
        autoAdvanceInFlightRef.current = false;
        setIsBuffering(false);
        setMessage("Trình duyệt cần bạn chạm nút Phát để tiếp tục.");
        return;
      }
      setIsBuffering(true);
      armFallbackTimer();
    });
  }, [armFallbackTimer, clearFallbackTimer, clearRecoveryTimer]);

  useEffect(() => {
    requestPlaybackRef.current = requestPlayback;
  }, [requestPlayback]);

  const prepareTrack = useCallback((track: Track, preservePlaybackSession = false) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (activeTrackIdRef.current === track.id && audio.src && !audio.error) return;
    clearRecoveryTimer();
    sourceListRef.current = sourceCandidates(track.originalUrl);
    sourceIndexRef.current = 0;
    activeTrackIdRef.current = track.id;
    endHandoffTrackIdRef.current = null;
    replacePlaybackSource(audio, sourceListRef.current[0], preservePlaybackSession);
    setCurrentTime(0);
    setDuration(0);
  }, [clearRecoveryTimer]);

  useEffect(() => {
    if (!hydrated || !currentTrack || activeTrackIdRef.current) return;
    prepareTrack(currentTrack);
  }, [currentTrack, hydrated, prepareTrack]);

  const playAt = useCallback(
    (index: number, preservePlaybackSession = false) => {
      const track = playlistRef.current[index];
      const audio = audioRef.current;
      if (!track || !audio) return;
      configurePlaybackAudioSession();
      clearRecoveryTimer();
      clearFallbackTimer();
      clearTrackWarmup();
      const preloader = preloadAudioRef.current;
      if (preloader && preloadedTrackIdRef.current === track.id) {
        preloader.removeAttribute("src");
        preloader.load();
        preloadedTrackIdRef.current = null;
      }
      queuedTrackIdRef.current = null;
      playPermissionRetryRef.current = 0;
      if (!preservePlaybackSession) autoAdvanceInFlightRef.current = false;
      setMessage("");
      setCurrentIndex(index);
      shouldResumeRef.current = true;
      prepareTrack(track, preservePlaybackSession);
      if (activeTrackIdRef.current === track.id && audio.ended) audio.currentTime = 0;
      setIsBuffering(true);
      armFallbackTimer();
      requestPlayback(audio);
    },
    [armFallbackTimer, clearFallbackTimer, clearRecoveryTimer, clearTrackWarmup, prepareTrack, requestPlayback],
  );

  const nextIndexFor = useCallback((tracks: Track[], index: number) => {
    if (!shuffleEnabled || tracks.length < 2) return (index + 1) % tracks.length;
    const randomOffset = 1 + Math.floor(Math.random() * (tracks.length - 1));
    return (index + randomOffset) % tracks.length;
  }, [shuffleEnabled]);

  const preloadNextTrack = useCallback(() => {
    const tracks = playlistRef.current;
    if (tracks.length < 2) return;
    const activeId = activeTrackIdRef.current;
    const current = Math.max(0, tracks.findIndex((track) => track.id === activeId));
    const next = nextIndexFor(tracks, current);
    const track = tracks[next];
    if (!track) return;
    queuedTrackIdRef.current = track.id;
    if (isAppleTouchDevice()) {
      preloadedTrackIdRef.current = null;
      if (warmedTrackIdRef.current === track.id) return;
      warmupAbortRef.current?.abort();
      const controller = new AbortController();
      warmupAbortRef.current = controller;
      void warmDriveTrack(track.originalUrl, controller.signal)
        .then((warmed) => {
          if (!controller.signal.aborted && warmed) warmedTrackIdRef.current = track.id;
        })
        .catch(() => undefined)
        .finally(() => {
          if (warmupAbortRef.current === controller) warmupAbortRef.current = null;
        });
      return;
    }
    const preloader = preloadAudioRef.current;
    if (!preloader) return;
    if (preloadedTrackIdRef.current === track.id && preloader.src) return;
    preloadedTrackIdRef.current = track.id;
    preloader.src = sourceCandidates(track.originalUrl)[0];
    preloader.load();
  }, [nextIndexFor]);

  useEffect(() => () => warmupAbortRef.current?.abort(), []);

  const advanceToNext = useCallback((preservePlaybackSession: boolean) => {
    const tracks = playlistRef.current;
    if (!tracks.length) {
      autoAdvanceInFlightRef.current = false;
      return;
    }
    const active = activeTrackIdRef.current;
    const index = Math.max(0, tracks.findIndex((track) => track.id === active));
    const queuedIndex = tracks.findIndex((track) => track.id === queuedTrackIdRef.current);
    playAt(queuedIndex >= 0 ? queuedIndex : nextIndexFor(tracks, index), preservePlaybackSession);
  }, [nextIndexFor, playAt]);

  const playNext = useCallback(() => advanceToNext(false), [advanceToNext]);

  const playNextAutomatically = useCallback(() => {
    if (autoAdvanceInFlightRef.current) return;
    autoAdvanceInFlightRef.current = true;
    advanceToNext(true);
  }, [advanceToNext]);

  const playPrevious = useCallback(() => {
    const tracks = playlistRef.current;
    if (!tracks.length) return;
    const active = activeTrackIdRef.current;
    const index = Math.max(0, tracks.findIndex((track) => track.id === active));
    playAt((index - 1 + tracks.length) % tracks.length);
  }, [playAt]);

  useEffect(() => {
    if (!isPlaying || playbackQueue.length < 2) return;
    const timer = window.setTimeout(preloadNextTrack, 1800);
    return () => window.clearTimeout(timer);
  }, [currentIndex, isPlaying, playbackQueue.length, preloadNextTrack, shuffleEnabled]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
      const activeTrackId = activeTrackIdRef.current;
      const remaining = audio.duration - audio.currentTime;
      if (
        autoPlayEnabled &&
        repeatMode === "off" &&
        shouldResumeRef.current &&
        isAppleTouchDevice() &&
        playlistRef.current.length > 1 &&
        activeTrackId &&
        endHandoffTrackIdRef.current !== activeTrackId &&
        Number.isFinite(remaining) &&
        remaining > 0 &&
        remaining <= IOS_END_HANDOFF_SECONDS
      ) {
        // Hand off just before WebKit suspends the background page at media end.
        endHandoffTrackIdRef.current = activeTrackId;
        playNextAutomatically();
        return;
      }
      if ("mediaSession" in navigator && Number.isFinite(audio.duration) && audio.duration > 0) {
        try {
          navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate,
            position: Math.min(audio.currentTime, audio.duration),
          });
        } catch {
          // Position state is optional in some browsers.
        }
      }
    };
    const onDuration = () => {
      const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      setDuration(nextDuration);
      if (resumePositionRef.current > 0 && nextDuration > 0) {
        audio.currentTime = Math.min(resumePositionRef.current, Math.max(0, nextDuration - 0.25));
        resumePositionRef.current = 0;
      }
    };
    const onPlay = () => {
      setIsPlaying(true);
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
    };
    const onPlaying = () => {
      clearFallbackTimer();
      clearRecoveryTimer();
      consecutiveTrackFailuresRef.current = 0;
      playPermissionRetryRef.current = 0;
      autoAdvanceInFlightRef.current = false;
      audio.autoplay = false;
      setIsBuffering(false);
      setMessage("");
    };
    const onPause = () => {
      setIsPlaying(false);
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
    };
    const onWaiting = () => {
      if (shouldResumeRef.current) {
        setIsBuffering(true);
        armFallbackTimer();
      }
    };
    const onCanPlay = () => {
      clearFallbackTimer();
      if (shouldResumeRef.current && audio.paused) {
        setIsBuffering(true);
        requestPlayback(audio);
      } else {
        setIsBuffering(false);
      }
    };
    const onEnded = () => {
      const repeatLimit = repeatMode === "once" ? 1 : repeatMode === "twice" ? 2 : 0;
      if (repeatCompletionRef.current < repeatLimit) {
        repeatCompletionRef.current += 1;
        audio.currentTime = 0;
        shouldResumeRef.current = true;
        setIsBuffering(true);
        requestPlayback(audio);
      } else if (autoPlayEnabled && playlistRef.current.length > 1) {
        repeatCompletionRef.current = 0;
        playNextAutomatically();
      } else {
        repeatCompletionRef.current = 0;
        shouldResumeRef.current = false;
        setMessage(repeatMode !== "off"
          ? `Đã phát lại bài này ${repeatLimit} lần.`
          : "Đã phát xong. Tự động phát đang tắt.");
      }
    };
    const onError = () => {
      setIsPlaying(false);
      clearFallbackTimer();
      if (!shouldResumeRef.current) {
        setIsBuffering(false);
        return;
      }
      const nextSource = sourceListRef.current[sourceIndexRef.current + 1];
      if (nextSource) {
        resumePositionRef.current = Number.isFinite(audio.currentTime) && audio.currentTime > 1
          ? audio.currentTime
          : 0;
        const nextIndex = sourceIndexRef.current + 1;
        const delay = SOURCE_RETRY_DELAYS[Math.min(nextIndex - 1, SOURCE_RETRY_DELAYS.length - 1)];
        clearRecoveryTimer();
        setIsBuffering(shouldResumeRef.current);
        recoveryTimerRef.current = setTimeout(() => {
          recoveryTimerRef.current = null;
          if (!shouldResumeRef.current) return;
          sourceIndexRef.current = nextIndex;
          replacePlaybackSource(audio, nextSource, isAppleTouchDevice());
          armFallbackTimer();
          requestPlayback(audio);
        }, delay);
        return;
      }

      if (shouldResumeRef.current && document.visibilityState === "hidden") {
        setIsBuffering(true);
        return;
      }
      if (
        shouldResumeRef.current &&
        autoPlayEnabled &&
        playlistRef.current.length > 1 &&
        consecutiveTrackFailuresRef.current < Math.min(2, playlistRef.current.length - 1)
      ) {
        consecutiveTrackFailuresRef.current += 1;
        setIsBuffering(true);
        clearRecoveryTimer();
        recoveryTimerRef.current = setTimeout(() => {
          recoveryTimerRef.current = null;
          if (shouldResumeRef.current) {
            autoAdvanceInFlightRef.current = false;
            playNextAutomatically();
          }
        }, 700);
        return;
      }

      shouldResumeRef.current = false;
      setIsBuffering(false);
      setMessage("Chưa thể nối lại luồng nhạc. Hãy chạm Phát hoặc chọn bài để thử lại.");
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onDuration);
    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("stalled", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onDuration);
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("stalled", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      clearFallbackTimer();
      clearRecoveryTimer();
    };
  }, [armFallbackTimer, autoPlayEnabled, clearFallbackTimer, clearRecoveryTimer, playNextAutomatically, repeatMode, requestPlayback]);

  useEffect(() => {
    const recoverInterruptedPlayback = () => {
      if (!shouldResumeRef.current || document.visibilityState === "hidden") return;
      const audio = audioRef.current;
      const tracks = playlistRef.current;
      const activeId = activeTrackIdRef.current;
      const track = tracks.find((item) => item.id === activeId) ?? (
        currentIndex === null ? null : tracks[currentIndex] ?? null
      );
      if (!audio || !track || (!audio.paused && !audio.error)) return;
      configurePlaybackAudioSession();
      clearFallbackTimer();
      clearRecoveryTimer();
      if (audio.error) prepareTrack(track, isAppleTouchDevice());
      playPermissionRetryRef.current = 0;
      shouldResumeRef.current = true;
      setIsBuffering(true);
      armFallbackTimer();
      requestPlayback(audio);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") recoverInterruptedPlayback();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", recoverInterruptedPlayback);
    window.addEventListener("online", recoverInterruptedPlayback);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", recoverInterruptedPlayback);
      window.removeEventListener("online", recoverInterruptedPlayback);
    };
  }, [armFallbackTimer, clearFallbackTimer, clearRecoveryTimer, currentIndex, prepareTrack, requestPlayback]);

  const togglePlayback = () => {
    const audio = audioRef.current;
    const tracks = playlistRef.current;
    if (!audio || !tracks.length) return;
    if (audio.paused) {
      configurePlaybackAudioSession();
      clearRecoveryTimer();
      playPermissionRetryRef.current = 0;
      autoAdvanceInFlightRef.current = false;
      const index = currentIndex ?? 0;
      const track = tracks[index];
      if (!track) return;
      shouldResumeRef.current = true;
      prepareTrack(track);
      if (activeTrackIdRef.current === track.id && audio.ended) audio.currentTime = 0;
      setIsBuffering(true);
      armFallbackTimer();
      requestPlayback(audio);
    } else {
      shouldResumeRef.current = false;
      clearFallbackTimer();
      clearRecoveryTimer();
      setIsBuffering(false);
      audio.pause();
    }
  };

  const addTrack = async (event: FormEvent) => {
    event.preventDefault();
    const value = url.trim();
    setMessage("");
    try {
      const parsed = new URL(value);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error();
    } catch {
      setMessage("Hãy nhập một liên kết http hoặc https hợp lệ.");
      return;
    }
    const folderId = googleDriveFolderId(value);
    if (isGoogleDriveUrl(value) && !googleDriveFileId(value) && !folderId) {
      setMessage("Link Drive này chưa trỏ tới file hoặc thư mục công khai.");
      return;
    }

    setIsAdding(true);
    if (folderId) {
      const targetPlaylistId = activePlaylistId;
      const targetPlaylistName = activePlaylist?.name ?? "playlist";
      try {
        setFolderImport({ phase: "listing", completed: 0, total: 0 });
        const listing = await readDriveFolder(folderId);
        const existing = new Set(playlist.map(trackIdentity));
        const seen = new Set<string>();
        const candidates = listing.files.filter((file) => {
          const identity = `drive:${file.id}`;
          if (existing.has(identity) || seen.has(identity)) return false;
          seen.add(identity);
          return true;
        });
        const duplicateCount = listing.files.length - candidates.length;
        if (!candidates.length) {
          const detail = listing.files.length
            ? "Tất cả bài hát trong thư mục đã có trong playlist này."
            : "Không tìm thấy file MP3, FLAC, M4A, AAC, OGG, OPUS hoặc WAV trong thư mục.";
          setMessage(detail);
          setFolderImport(null);
          return;
        }

        const tracks = candidates.map((file) => ({
          id: typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${file.id}`,
          title: titleFromDriveFileName(file.name),
          artist: "Không rõ nghệ sĩ",
          originalUrl: `https://drive.google.com/file/d/${file.id}/view?usp=sharing`,
          format: file.name.split(".").pop()?.toUpperCase() || "AUDIO",
          size: file.size,
        } satisfies Track));
        const next = [...playlist, ...tracks];
        setPlaylist(next);
        setLibraryVisible(true);
        const hasLoadedTrack = Boolean(activeTrackIdRef.current && audioRef.current?.src);
        if (targetPlaylistId === playbackPlaylistId) playlistRef.current = next;
        if (!hasLoadedTrack) {
          playlistRef.current = next;
          setPlaybackPlaylistId(targetPlaylistId);
          setCurrentIndex(playlist.length);
          prepareTrack(tracks[0]);
        }

        setFolderImport({ phase: "metadata", completed: 0, total: candidates.length });
        let completed = 0;
        await mapWithConcurrency(candidates, isAppleTouchDevice() ? 2 : 4, async (file, index) => {
          setFolderImport({
            phase: "metadata",
            completed,
            total: candidates.length,
            currentName: file.name,
          });
          const track = tracks[index];
          const metadata = await readDriveMetadata(track.originalUrl).catch(() => null);
          if (metadata) {
            setPlaylist((current) => current.map((item) => item.id === track.id ? {
              ...item,
              title: metadata.title || item.title,
              artist: metadata.artist || item.artist,
              album: metadata.album || item.album,
              format: metadata.format || item.format,
              size: metadata.size || item.size,
            } : item));
          }
          completed += 1;
          setFolderImport({
            phase: "metadata",
            completed,
            total: candidates.length,
            currentName: file.name,
          });
          return metadata;
        });

        const skippedCount = listing.skipped + listing.inaccessibleFolders + duplicateCount;
        const notes = [
          skippedCount ? `bỏ qua ${skippedCount} file hoặc bài trùng` : "",
          listing.truncated ? `giới hạn ${listing.limit} bài mỗi lần` : "",
        ].filter(Boolean).join(" · ");
        setMessage(
          `Đã nhập ${tracks.length} bài từ “${listing.folderName}” vào ${targetPlaylistName}${notes ? ` · ${notes}` : ""}.`,
        );
        setUrl("");
        setTitle("");
        setArtist("");
        setDriveMetadata(null);
        setReadingMetadata(false);
        setFolderImport(null);
        setFormOpen(false);
      } catch (error) {
        setFolderImport(null);
        setMessage(error instanceof Error ? error.message : "Không thể nhập thư mục Google Drive.");
      } finally {
        setIsAdding(false);
      }
      return;
    }

    const metadata = driveMetadata?.sourceUrl === value ? driveMetadata : null;
    const customTitle = title.trim();
    const customArtist = artist.trim();
    const track: Track = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`,
      title: customTitle || metadata?.title || inferredTitle(value),
      artist: customArtist || metadata?.artist || "Không rõ nghệ sĩ",
      originalUrl: value,
      album: metadata?.album || undefined,
      format: metadata?.format || undefined,
      size: metadata?.size || undefined,
    };
    const next = [...playlist, track];
    setPlaylist(next);
    const nextIndex = next.length - 1;
    const hasLoadedTrack = Boolean(activeTrackIdRef.current && audioRef.current?.src);
    if (activePlaylistId === playbackPlaylistId) playlistRef.current = next;
    if (autoPlayEnabled) {
      playlistRef.current = next;
      setPlaybackPlaylistId(activePlaylistId);
      playAt(nextIndex);
    } else if (!hasLoadedTrack) {
      playlistRef.current = next;
      setPlaybackPlaylistId(activePlaylistId);
      setCurrentIndex(nextIndex);
      prepareTrack(track);
      setMessage(`Đã thêm bài hát${track.format ? ` · ${track.format} nguyên bản` : ""}.`);
    } else {
      setMessage(`Đã thêm bài hát${track.format ? ` · ${track.format} nguyên bản` : ""}.`);
    }
    setUrl("");
    setTitle("");
    setArtist("");
    setDriveMetadata(null);
    setReadingMetadata(false);
    setIsAdding(false);
    setFormOpen(false);

    if (isGoogleDriveUrl(value) && !metadata) {
      void readDriveMetadata(value)
        .then((detected) => {
          if (!detected) return;
          setPlaylist((current) => {
            return current.map((item) => item.id === track.id ? {
              ...item,
              title: customTitle || detected.title || item.title,
              artist: customArtist || detected.artist || item.artist,
              album: detected.album || item.album,
              format: detected.format || item.format,
              size: detected.size || item.size,
            } : item);
          });
        })
        .catch(() => undefined);
    }
  };

  const removeTrack = (index: number) => {
    const affectsPlayback = activePlaylistId === playbackPlaylistId;
    const removingCurrent = affectsPlayback && currentTrack?.id === playlist[index]?.id;
    const next = playlist.filter((_, itemIndex) => itemIndex !== index);
    if (removingCurrent) {
      const audio = audioRef.current;
      shouldResumeRef.current = false;
      audio?.pause();
      if (audio) {
        audio.removeAttribute("src");
        audio.load();
      }
      activeTrackIdRef.current = null;
      setCurrentIndex(next.length ? Math.min(index, next.length - 1) : null);
      setCurrentTime(0);
      setDuration(0);
    } else if (affectsPlayback && currentIndex !== null && index < currentIndex) {
      setCurrentIndex(currentIndex - 1);
    }
    if (affectsPlayback) {
      playlistRef.current = next;
      queuedTrackIdRef.current = null;
      preloadedTrackIdRef.current = null;
      clearTrackWarmup();
      const preloader = preloadAudioRef.current;
      if (preloader) {
        preloader.removeAttribute("src");
        preloader.load();
      }
    }
    setPlaylist(next);
  };

  const playFromActivePlaylist = (index: number) => {
    playlistRef.current = playlist;
    setPlaybackPlaylistId(activePlaylistId);
    playAt(index);
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = value;
    setCurrentTime(value);
  };

  const toggleMute = () => {
    if (volume > 0.01) {
      lastAudibleVolumeRef.current = volume;
      setVolume(0);
      return;
    }
    setVolume(Math.max(0.1, lastAudibleVolumeRef.current));
  };

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const mediaSession = navigator.mediaSession;
    if (currentTrack && "MediaMetadata" in window) {
      mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album || "HVL",
        artwork: currentTrack.artworkUrl
          ? [{ src: currentTrack.artworkUrl, sizes: "1200x800", type: "image/jpeg" }]
          : [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          ],
      });
    }

    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ["play", () => {
        const index = currentIndex ?? 0;
        const track = playlistRef.current[index];
        const audio = audioRef.current;
        if (!track || !audio) return;
        configurePlaybackAudioSession();
        clearRecoveryTimer();
        playPermissionRetryRef.current = 0;
        autoAdvanceInFlightRef.current = false;
        shouldResumeRef.current = true;
        prepareTrack(track);
        if (activeTrackIdRef.current === track.id && audio.ended) audio.currentTime = 0;
        setIsBuffering(true);
        armFallbackTimer();
        requestPlayback(audio);
      }],
      ["pause", () => {
        shouldResumeRef.current = false;
        clearFallbackTimer();
        clearRecoveryTimer();
        audioRef.current?.pause();
      }],
      ["previoustrack", playPrevious],
      ["nexttrack", playNext],
      ["seekbackward", (details) => {
        const audio = audioRef.current;
        if (audio) audio.currentTime = Math.max(0, audio.currentTime - (details.seekOffset ?? 10));
      }],
      ["seekforward", (details) => {
        const audio = audioRef.current;
        if (audio && Number.isFinite(audio.duration)) {
          audio.currentTime = Math.min(audio.duration, audio.currentTime + (details.seekOffset ?? 10));
        }
      }],
      ["seekto", (details) => {
        const audio = audioRef.current;
        if (audio && details.seekTime !== undefined) audio.currentTime = details.seekTime;
      }],
    ];
    handlers.forEach(([action, handler]) => {
      try {
        mediaSession.setActionHandler(action, handler);
      } catch {
        // The browser can expose Media Session without every action.
      }
    });
    return () => {
      handlers.forEach(([action]) => {
        try {
          mediaSession.setActionHandler(action, null);
        } catch {
          // The browser can expose Media Session without every action.
        }
      });
    };
  }, [armFallbackTimer, clearFallbackTimer, clearRecoveryTimer, currentIndex, currentTrack, playNext, playPrevious, prepareTrack, requestPlayback]);

  const forceSync = () => {
    if (!syncUser || !latestPayloadRef.current) return;
    pendingSyncRef.current = null;
    lastSyncedPayloadRef.current = "";
    queueSync(latestPayloadRef.current);
  };

  const loadAdminStats = async () => {
    if (syncUser?.role !== "admin") return;
    setAdminStatsLoading(true);
    try {
      const response = await fetch("/api/admin/stats", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const result = await response.json() as { stats: NonNullable<typeof adminStats> };
      setAdminStats(result.stats);
    } catch {
      setMessage("Không thể tải trạng thái quản trị lúc này.");
    } finally {
      setAdminStatsLoading(false);
    }
  };

  const progress = duration ? Math.min(100, (currentTime / duration) * 100) : 0;
  const volumeProgress = Math.round(volume * 100);
  const accountLabel = !syncUser ? "Đăng nhập" : syncUser.role === "admin" ? "Admin" : "Tài khoản";
  const sharedCatalogReady = true;
  const albumTracks = sharedCatalogTracks.length ? sharedCatalogTracks : playlist;
  const closeAbout = () => {
    setAboutOpen(false);
    try {
      localStorage.setItem(ABOUT_SEEN_KEY, "1");
    } catch {
      // Closing the dialog should still work when storage is unavailable.
    }
  };

  return (
    <main className="app-shell" onClickCapture={handleButtonFeedback} style={{ "--track-hue": activeHue } as CSSProperties}>
      <audio ref={audioRef} playsInline preload="auto" />
      {!usesSystemVolume && <audio aria-hidden="true" ref={preloadAudioRef} preload="metadata" />}
      {controlNotice && <p aria-live="polite" className="control-notice" role="status">{controlNotice}</p>}

      <header className="topbar">
        <div className="brand">
          <span aria-hidden="true" className="brand-mark"><i>H</i><i>V</i><i>L</i></span>
          <span>
            <strong>HVL 30</strong>
            <small>{`${sharedCatalogTracks.length || 30} bài · HVL`}</small>
          </span>
        </div>
        <div className="header-actions">
          {ACCOUNT_FEATURES_ENABLED && !sharedCatalogReady && <button
            aria-expanded={syncPanelOpen}
            aria-label={syncUser ? "Tài khoản và đồng bộ" : "Mở đăng nhập hoặc đăng ký"}
            className={`icon-button sync-button identity-visible ${syncUser ? "connected" : "signed-out"} ${syncStatus} ${syncStatus === "syncing" || syncStatus === "checking" ? "working" : ""}`}
            onClick={() => setSyncPanelOpen((open) => !open)}
            type="button"
          >
            <Icon name={syncUser?.role === "admin" ? "shield" : "cloud"} size={18} />
            <span className="sync-button-label">{accountLabel}</span>
            <span className="sync-dot" />
          </button>}
          <button aria-label="Giới thiệu HVL và RPT MCK" className="icon-button about-button" onClick={() => setAboutOpen(true)} type="button">
            <Icon name="info" size={18} />
            <span>Giới thiệu</span>
          </button>
          {ACCOUNT_FEATURES_ENABLED && !sharedCatalogReady && <button className="add-button" onClick={() => setFormOpen((open) => !open)} type="button">
            <Icon name={formOpen ? "close" : "add"} size={18} />
            <span>{formOpen ? "Đóng" : "Thêm nhạc"}</span>
          </button>}
        </div>
      </header>

      {ACCOUNT_FEATURES_ENABLED && !sharedCatalogReady && syncPanelOpen && (
        <section aria-label="Tài khoản và đồng bộ" className="sync-panel">
          <span className="sync-panel-icon"><Icon name={syncUser?.role === "admin" ? "shield" : "cloud"} size={20} /></span>
          {syncUser ? (
            <>
              <div className="sync-account-copy">
                <span className="sync-account-title">
                  <strong>{syncUser.displayName}</strong>
                  {syncUser.role === "admin" && <small>Quản trị viên</small>}
                </span>
                <span>{syncUser.email}</span>
                <small>{syncStatusLabel(syncStatus)} · dữ liệu nhạc vẫn lưu cục bộ để mở nhanh</small>
              </div>
              <div className="sync-actions">
                <button disabled={syncStatus === "syncing"} onClick={forceSync} type="button">Đồng bộ ngay</button>
                {syncUser.role === "admin" && (
                  <button disabled={adminStatsLoading} onClick={loadAdminStats} type="button">
                    {adminStatsLoading ? "Đang tải..." : "Xem tài khoản"}
                  </button>
                )}
                <a href="/signout-with-chatgpt?return_to=%2F">Đăng xuất</a>
              </div>
              {syncUser.role === "admin" && adminStats && (
                <div className="admin-stats">
                  <span><strong>{adminStats.accountCount}</strong><small>Tài khoản</small></span>
                  <span><strong>{adminStats.playlistCount}</strong><small>Playlist</small></span>
                  <span><strong>{adminStats.trackCount}</strong><small>Bài hát</small></span>
                  <p>Lần đồng bộ gần nhất: {adminStats.latestSyncAt ? new Date(adminStats.latestSyncAt).toLocaleString("vi-VN") : "Chưa có"}</p>
                  <div className="admin-accounts">
                    <strong>Tên tài khoản</strong>
                    {adminStats.accounts.length ? (
                      <ul>
                        {adminStats.accounts.map((account, index) => (
                          <li key={`${account.name ?? "pending"}-${index}`}>
                            <span>{account.name ?? "Chưa có tên hiển thị"}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <small>Chưa có tài khoản đồng bộ.</small>}
                  </div>
                  <p className="admin-privacy">Quản trị viên chỉ xem tên hiển thị và số liệu tổng hợp, không xem email, nội dung playlist hay link nhạc của từng tài khoản.</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="sync-account-copy">
                <strong>Đăng nhập để đồng bộ</strong>
                <span>Dùng playlist của bạn trên nhiều thiết bị.</span>
                <small>Chưa có tài khoản? Bạn có thể đăng ký ở bước tiếp theo.</small>
                <small>HVL 30 không nhận mật khẩu hoặc nội dung trò chuyện.</small>
              </div>
              <a className="sync-signin" href="/signin-with-chatgpt?return_to=%2F">Tiếp tục đăng nhập</a>
            </>
          )}
        </section>
      )}

      {aboutOpen && (
        <div className="modal-backdrop about-backdrop" onClick={closeAbout} role="presentation">
          <section aria-labelledby="about-title" aria-modal="true" className="install-dialog about-dialog" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="about-topbar">
              <span><Icon name="music" size={19} /><strong>HVL 30</strong></span>
              <button aria-label="Đóng phần giới thiệu" className="dialog-close" onClick={closeAbout} type="button">
                <Icon name="close" size={19} />
              </button>
            </div>

            <div className="about-content">
              <header className="about-hero">
                <div className="about-hero-copy">
                  <p className="eyebrow">RPT MCK / ALBUM 2026</p>
                  <h2 aria-label="HVL" id="about-title"><span>H</span><span>V</span><span>L</span></h2>
                  <p className="about-lead">30 bài hát. 30 artwork. Một thế giới thị giác tối, lạnh và bùng lên bằng màu đỏ.</p>
                  <div className="about-meta" aria-label="Thông tin album">
                    <span>30 ca khúc</span><span>1 giờ 30 phút</span><span>FLAC nguyên bản</span>
                  </div>
                  <div className="about-links">
                    <a className="spotify-link" href="https://open.spotify.com/album/36e3pjcLAYabHjXlaSmWOe" rel="noreferrer" target="_blank"><Icon name="spotify" size={18} /><span>Spotify</span></a>
                    <a className="youtube-link" href="https://www.youtube.com/playlist?list=PLG5bpInXG8Sc" rel="noreferrer" target="_blank"><Icon name="youtube" size={18} /><span>YouTube</span></a>
                  </div>
                </div>
                <div aria-hidden="true" className="about-art-stack">
                  {[3, 12, 18].map((number) => (
                    <img alt="" key={number} src={`/artwork/${String(number).padStart(2, "0")}.jpg`} />
                  ))}
                  <strong>30</strong>
                </div>
              </header>

              <section className="about-statement">
                <p className="eyebrow">MCK · HVL · VĂN HOÁ RAP</p>
                <h3>Có những điều người trẻ chỉ biết nói ra bằng rap.</h3>
                <div className="about-essay">
                  <p>Có một nỗi ấm ức rất khó gọi tên trong người trẻ hôm nay. Họ được bảo phải ngoan hơn, bình thường hơn, dễ nghe hơn. Họ đi qua áp lực, cô đơn, tiền bạc, tình yêu và cảm giác không ai thật sự hiểu mình. Nhiều điều không thể kể với gia đình, không thể nói trong lớp học, cũng không vừa vặn với một dòng trạng thái đẹp đẽ. Rap trở thành nơi họ được phép nói thật, kể cả khi sự thật ấy xấu xí, vụng về và đầy vết xước.</p>
                  <p>Vì vậy, nỗi lo rap đang mất chất không chỉ nằm ở âm thanh. Nó nằm trong cảm giác mọi góc cạnh dần bị mài phẳng để vừa với thuật toán, nhãn hàng và những khuôn mẫu an toàn. Khi một tiếng nói từng thuộc về bên lề bước vào trung tâm, người nghe vừa tự hào vừa sợ rằng nó sẽ quên mất vì sao mình đã cất tiếng từ đầu.</p>
                  <blockquote className="about-pullquote">Nếu mọi điều khó chịu đều bị xoá đi, thứ còn lại có còn là lời thật của một thế hệ không?</blockquote>
                  <p>HVL đặt MCK ngay giữa mâu thuẫn ấy. Album có bản năng, kiêu hãnh, sai lầm, những vết thương tình cảm và cả những câu chữ khiến công chúng phản ứng. Không phải câu nào cũng cần được bênh vực. Tự do biểu đạt không có nghĩa là đứng ngoài trách nhiệm. Nhưng với nhiều người nghe, việc một phần lớn album biến mất vẫn để lại cảm giác hụt hẫng, như một trang nhật ký vừa kịp đọc đã bị xé khỏi cuốn sách.</p>
                  <p><strong>Điều đã xảy ra:</strong> sau khi làm việc với cơ quan chức năng, MCK xin lỗi về ngôn từ chưa phù hợp và cho biết sẽ gỡ các bản ghi liên quan để chỉnh sửa trước khi cân nhắc phát hành lại. Ngày 31 tháng 7 năm 2026, 19 trong 30 bài không còn hiển thị, còn 11 bài được giữ lại trên YouTube Music. Sự việc không chỉ đặt câu hỏi cho riêng MCK. Nó buộc văn hoá rap Việt nhìn lại cách giữ bản sắc, bảo vệ không gian sáng tạo và đồng thời chịu trách nhiệm khi tiếng nói của mình đã chạm tới hàng triệu người.</p>
                  <p className="about-closing">Một album có thể được chỉnh sửa. Một nghệ sĩ có thể nhận sai. Nhưng những đối thoại mà HVL mở ra không nên biến mất cùng nút gỡ bài.</p>
                  <div className="about-source-links">
                    <a href="https://vov.vn/giai-tri/mck-xin-loi-thong-bao-go-bo-cac-noi-dung-khong-phu-hop-trong-album-moi-post1320186.vov" rel="noreferrer" target="_blank">Thông báo và hướng khắc phục</a>
                    <a href="https://kenh14.vn/19-bai-hat-bi-go-cua-mck-215260731173623501.chn" rel="noreferrer" target="_blank">Danh sách 19 bài bị ẩn</a>
                  </div>
                </div>
              </section>

              <section className="about-track-section" aria-labelledby="about-track-title">
                <div className="about-section-heading">
                  <div><p className="eyebrow">30 ARTWORK / 30 CA KHÚC</p><h3 id="about-track-title">Danh sách album</h3></div>
                  <p>Chạm vào một artwork để nghe bài đó.</p>
                </div>
                <ol className="about-track-grid">
                  {albumTracks.map((track, index) => (
                    <li key={track.id}>
                      <button onClick={() => { closeAbout(); playFromActivePlaylist(index); }} type="button">
                        <span className="about-track-art">
                          {track.artworkUrl && <img alt={`Artwork ${track.title}`} loading="lazy" src={track.artworkUrl} />}
                          <small>{String(index + 1).padStart(2, "0")}</small>
                        </span>
                        <span className="about-track-copy"><strong>{track.title}</strong><small>{track.artist}</small></span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="about-finale">
                <p className="eyebrow">NHỮNG GIỌNG NÓI CÙNG XUẤT HIỆN</p>
                <div className="artist-chips">
                  {['marzuz', 'Tage', 'A$AP Ướt Mi', 'Tùng Dương', 'Obito', 'THANHDRAW', 'RPT Orijinn'].map((name) => <span key={name}>{name}</span>)}
                </div>
                <p>30 file FLAC được phát từ kho riêng của HVL 30, giữ nguyên định dạng và không cần tài khoản.</p>
              </section>
            </div>
          </section>
        </div>
      )}

      {ACCOUNT_FEATURES_ENABLED && !sharedCatalogReady && formOpen && (
        <section className={`add-panel ${folderLinkId ? "folder-mode" : ""}`} aria-label="Thêm bài hát hoặc thư mục">
          <div className="panel-heading">
            <span className="panel-icon"><Icon name="link" size={20} /></span>
            <div>
              <h2>Thêm từ liên kết</h2>
              <p>Hỗ trợ file nhạc hoặc cả thư mục Google Drive được chia sẻ công khai.</p>
            </div>
          </div>
          <form onSubmit={addTrack}>
            <label className="field field-wide">
              <span>Link file hoặc thư mục nhạc</span>
              <input
                disabled={isAdding}
                onChange={(event) => {
                  setUrl(event.target.value);
                  setDriveMetadata(null);
                  setReadingMetadata(false);
                  setFolderImport(null);
                }}
                placeholder="https://drive.google.com/drive/folders/..."
                required
                type="url"
                value={url}
              />
            </label>
            {folderImport && (
              <div aria-live="polite" className="metadata-reader" role="status">
                <span className="metadata-reader-icon"><Icon name="drive" size={17} /></span>
                <span className="metadata-reader-copy">
                  <strong>{folderImport.phase === "listing" ? "Đang đọc thư mục Drive" : "Đang nhận diện danh sách nhạc"}</strong>
                  <small>
                    {folderImport.phase === "listing"
                      ? "Đang lọc MP3, FLAC, M4A, AAC, OGG, OPUS và WAV"
                      : `${folderImport.completed}/${folderImport.total}${folderImport.currentName ? ` · ${folderImport.currentName}` : ""}`}
                  </small>
                  <span aria-hidden="true" className={`metadata-progress ${folderImport.total ? "folder-progress" : ""}`}>
                    <i style={folderImport.total ? { width: `${Math.round(folderImport.completed / folderImport.total * 100)}%` } : undefined} />
                  </span>
                </span>
              </div>
            )}
            {readingMetadata && (
              <div aria-live="polite" className="metadata-reader" role="status">
                <span className="metadata-reader-icon"><Icon name="drive" size={17} /></span>
                <span className="metadata-reader-copy">
                  <strong>Đang đọc thông tin file</strong>
                  <small>Tên bài hát, ca sĩ và định dạng</small>
                  <span aria-hidden="true" className="metadata-progress"><i /></span>
                </span>
              </div>
            )}
            {!readingMetadata && driveMetadata && (
              <p aria-live="polite" className="metadata-status detected" role="status">
                Đã nhận {driveMetadata.format || "file nhạc"}
                {driveMetadata.title ? ` · ${driveMetadata.title}` : ""}
                {driveMetadata.artist ? ` — ${driveMetadata.artist}` : ""}
              </p>
            )}
            {!folderLinkId && (
              <div className="field-row">
                <label className="field">
                  <span>Tên bài hát</span>
                  <input onChange={(event) => setTitle(event.target.value)} placeholder="Tự nhận nếu có" value={title} />
                </label>
                <label className="field">
                  <span>Nghệ sĩ</span>
                  <input onChange={(event) => setArtist(event.target.value)} placeholder="Không bắt buộc" value={artist} />
                </label>
              </div>
            )}
            <button className="submit-button" disabled={isAdding} type="submit">
              <Icon name="add" size={18} /> {isAdding
                ? folderLinkId ? "Đang nhập thư mục..." : "Đang thêm..."
                : folderLinkId ? "Nhập cả thư mục" : "Thêm vào playlist"}
            </button>
          </form>
        </section>
      )}

      <section className="player-card" aria-label="Trình phát nhạc">
        <div className={`artwork ${isPlaying ? "is-playing" : ""}`}>
          {currentTrack?.artworkUrl ? (
            <img alt={`Artwork ${currentTrack.title}`} className="artwork-image" src={currentTrack.artworkUrl} />
          ) : (
            <div aria-hidden="true" className="artwork-fallback"><strong>HVL</strong><span>RPT MCK</span></div>
          )}
          <span aria-hidden="true" className="artwork-number">{String((currentIndex ?? 0) + 1).padStart(2, "0")}</span>
          <span className="source-badge"><strong>HVL</strong></span>
        </div>

        <div className="player-content">
          <div className="track-heading">
            <p className="eyebrow">{isPlaying ? "ĐANG PHÁT" : "HVL 30"}</p>
            <h1>{currentTrack?.title ?? "Playlist của bạn đang trống"}</h1>
            <p className="artist-name">{currentTrack?.artist ?? "Thêm một link nhạc để bắt đầu"}</p>
          </div>
          {currentTrack && (
            <div className="quality-row">
              <span>{currentTrack.format || "AUDIO"}</span>
              <span>Chất lượng gốc</span>
            </div>
          )}

          <div className="timeline">
            <input
              aria-label="Tua bài hát"
              disabled={!duration}
              max={duration || 0}
              min="0"
              onChange={(event) => seek(Number(event.target.value))}
              style={{ "--progress": `${progress}%` } as CSSProperties}
              type="range"
              value={Math.min(currentTime, duration || 0)}
            />
            <div className="time-row"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
          </div>

          <div className="controls">
            <button aria-label="Bài trước" data-notice="off" disabled={!playbackQueue.length} onClick={playPrevious} type="button"><Icon name="previous" size={25} /></button>
            <button aria-label={isPlaying ? "Tạm dừng" : "Phát"} className={`play-button ${isBuffering ? "buffering" : ""}`} data-notice="off" disabled={!playbackQueue.length} onClick={togglePlayback} type="button">
              <Icon name={isPlaying ? "pause" : "play"} size={30} />
              {isBuffering && <span className="buffer-ring" />}
            </button>
            <button aria-label="Bài sau" data-notice="off" disabled={!playbackQueue.length} onClick={playNext} type="button"><Icon name="next" size={25} /></button>
          </div>
          {!usesSystemVolume && (
            <div className="volume-control">
              <button aria-label={volume > 0.01 ? "Tắt tiếng" : "Bật tiếng"} onClick={toggleMute} type="button">
                <Icon name={volume > 0.01 ? "volumeHigh" : "volumeMute"} size={17} />
              </button>
              <input
                aria-label="Âm lượng"
                aria-valuetext={`${volumeProgress}%`}
                max="1"
                min="0"
                onChange={(event) => setVolume(Number(event.target.value))}
                step="0.01"
                style={{ "--volume-progress": `${volumeProgress}%` } as CSSProperties}
                type="range"
                value={volume}
              />
              <span aria-hidden="true"><Icon name="volumeHigh" size={19} /></span>
            </div>
          )}
          <div className="playback-options-wrap">
            <div className="playback-options">
              <button
                aria-label="Trộn bài"
                aria-pressed={shuffleEnabled}
                className={shuffleEnabled ? "active" : ""}
                onClick={() => {
                  const next = !shuffleEnabled;
                  clearTrackWarmup();
                  queuedTrackIdRef.current = null;
                  preloadedTrackIdRef.current = null;
                  setShuffleEnabled(next);
                  showControlNotice(`Trộn bài · ${next ? "Đã bật" : "Đã tắt"}`);
                }}
                title="Trộn bài"
                type="button"
              >
                <Icon name="shuffle" size={18} />
              </button>
              <button
                aria-label="Tự động phát"
                aria-pressed={autoPlayEnabled}
                className={autoPlayEnabled ? "active" : ""}
                onClick={() => {
                  const next = !autoPlayEnabled;
                  setAutoPlayEnabled(next);
                  showControlNotice(`Tự động phát · ${next ? "Đã bật" : "Đã tắt"}`);
                }}
                title="Tự động phát"
                type="button"
              >
                <Icon name="autoplay" size={18} />
              </button>
              <button
                aria-label={repeatMode === "off" ? "Phát lại bài hiện tại 1 lần" : repeatMode === "once" ? "Phát lại bài hiện tại 2 lần" : "Tắt lặp"}
                aria-pressed={repeatMode !== "off"}
                className={repeatMode !== "off" ? "active" : ""}
                onClick={() => {
                  const next: RepeatMode = repeatMode === "off" ? "once" : repeatMode === "once" ? "twice" : "off";
                  setRepeatMode(next);
                  repeatCompletionRef.current = 0;
                  showControlNotice(next === "once" ? "Phát lại bài hiện tại 1 lần" : next === "twice" ? "Phát lại bài hiện tại 2 lần" : "Đã tắt lặp");
                }}
                title={repeatMode === "once" ? "Lặp 1 lần" : repeatMode === "twice" ? "Lặp 2 lần" : "Lặp"}
                type="button"
              >
                <Icon name={repeatMode === "once" ? "repeatOne" : repeatMode === "twice" ? "repeatTwo" : "repeat"} size={18} />
              </button>
              <button
                aria-label={libraryVisible ? "Ẩn danh sách phát" : "Hiện danh sách phát"}
                aria-controls="playlist-library"
                aria-expanded={libraryVisible}
                className={libraryVisible ? "active" : ""}
                onClick={() => {
                  const next = !libraryVisible;
                  setLibraryVisible(next);
                  showControlNotice(`Danh sách phát · ${next ? "Đang hiện" : "Đã ẩn"}`);
                }}
                title="Danh sách phát"
                type="button"
              >
                <Icon name="queue" size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {message && <p className="status-message" role="status">{message}</p>}

      <section className="playlist-section" hidden={!libraryVisible} id="playlist-library">
        <div className="section-heading">
          <h2>Danh sách phát</h2>
          <span className="queue-count">{playlist.length} bài hát</span>
        </div>

        {!playlist.length ? (
          <div className="empty-state">
            <span><Icon name="music" size={28} /></span>
            <strong>HVL · RPT MCK</strong>
            <small>Danh sách 30 bài dùng chung</small>
          </div>
        ) : (
          <ol className="track-list">
            {playlist.map((track, index) => (
              <li className={currentTrack?.id === track.id ? "active" : ""} key={track.id}>
                <button className="track-main" onClick={() => playFromActivePlaylist(index)} type="button">
                  <span className="track-cover">
                    {track.artworkUrl && <img alt="" loading="lazy" src={track.artworkUrl} />}
                    {currentTrack?.id === track.id && isPlaying && <span className="track-playing"><Icon name="pause" size={14} /></span>}
                    <small>{String(index + 1).padStart(2, "0")}</small>
                  </span>
                  <span className="track-copy"><strong>{track.title}</strong><small>{track.artist} · {track.format || (isGoogleDriveUrl(track.originalUrl) ? "Google Drive" : "HVL 30")}</small></span>
                </button>
                {!sharedCatalogReady && <button aria-label={`Xóa ${track.title}`} className="remove-button" onClick={() => removeTrack(index)} type="button"><Icon name="trash" size={18} /></button>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <footer>
        <p>Không cần tài khoản. 30 bài nhạc dùng chung được phát từ kho của HVL 30; file giữ nguyên định dạng gốc, không chuyển mã hoặc giảm chất lượng.</p>
        <a href="https://github.com/mm4you" rel="noreferrer" target="_blank">
          <Icon name="github" size={15} /> Built by Khang with Codex · @mm4you
        </a>
      </footer>
    </main>
  );
}
