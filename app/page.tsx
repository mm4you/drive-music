"use client";

import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

type Track = {
  id: string;
  title: string;
  artist: string;
  originalUrl: string;
  album?: string;
  format?: string;
  size?: number;
};

type MusicPlaylist = {
  id: string;
  name: string;
  tracks: Track[];
};

type LibraryPayload = {
  playlists: MusicPlaylist[];
  activePlaylistId: string;
  settings: {
    shuffleEnabled: boolean;
    autoPlayEnabled: boolean;
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

type IconName =
  | "add"
  | "autoplay"
  | "close"
  | "cloud"
  | "drive"
  | "edit"
  | "github"
  | "install"
  | "link"
  | "music"
  | "next"
  | "pause"
  | "play"
  | "previous"
  | "queue"
  | "share"
  | "shield"
  | "shuffle"
  | "trash"
  | "volumeHigh"
  | "volumeMute";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const STORAGE_KEY = "drive-music-playlists-v2";
const LEGACY_STORAGE_KEY = "drive-music-playlist-v1";
const SETTINGS_KEY = "drive-music-settings-v1";
const SYNC_REVISION_KEY = "drive-music-sync-revision-v1";
const SYNC_PAYLOAD_KEY = "drive-music-sync-payload-v1";
const ACCOUNT_CACHE_KEY = "drive-music-account-cache-v1";
const LAST_ACCOUNT_KEY = "drive-music-last-account-v1";
const VOLUME_KEY = "drive-music-volume-v1";
const LIBRARY_VISIBILITY_KEY = "drive-music-library-visible-v1";
const STARTUP_FALLBACK_MS = 8000;
const SOURCE_RETRY_DELAYS = [450, 1100, 2400];
const PLAY_PERMISSION_RETRY_DELAYS = [180, 650, 1600];
const IOS_END_HANDOFF_SECONDS = 0.55;

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
    edit: (
      <>
        <path d="m4 20 4.2-1 10.6-10.6-3.2-3.2L5 15.8Z" />
        <path d="m13.8 7 3.2 3.2M4 20h4.2" />
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

function formatBytes(value?: number) {
  if (!value || value < 1) return null;
  if (value >= 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(value / 1024)} KB`;
}

function colorHue(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash % 360);
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
): LibraryPayload {
  return {
    playlists,
    activePlaylistId,
    settings: { shuffleEnabled, autoPlayEnabled },
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
    return value;
  } catch {
    return null;
  }
}

function emptyLibraryPayload(): LibraryPayload {
  return libraryPayload(
    [{ id: "default", name: "Playlist của tôi", tracks: [] }],
    "default",
    false,
    true,
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
  const installPromptRef = useRef<InstallPromptEvent | null>(null);
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
  const requestPlaybackRef = useRef<(audio: HTMLAudioElement) => void>(() => undefined);
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
  const [installOpen, setInstallOpen] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [driveMetadata, setDriveMetadata] = useState<DriveMetadata | null>(null);
  const [readingMetadata, setReadingMetadata] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [folderImport, setFolderImport] = useState<FolderImportProgress | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);
  const [playlistFormOpen, setPlaylistFormOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [playlistRenameOpen, setPlaylistRenameOpen] = useState(false);
  const [playlistRenameName, setPlaylistRenameName] = useState("");
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
    () => libraryPayload(playlists, activePlaylistId, shuffleEnabled, autoPlayEnabled),
    [activePlaylistId, autoPlayEnabled, playlists, shuffleEnabled],
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
  const activeHue = useMemo(
    () => colorHue(currentTrack?.id ?? activePlaylistId ?? "drive-music"),
    [activePlaylistId, currentTrack?.id],
  );
  const usesSystemVolume = useSyncExternalStore(
    subscribeDeviceCapability,
    isAppleTouchDevice,
    () => false,
  );

  useEffect(() => {
    document.documentElement.style.setProperty("--track-hue", String(activeHue));
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    themeColor?.setAttribute("content", `hsl(${activeHue} 26% 13%)`);
  }, [activeHue]);

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
        };
        if (typeof settings.shuffleEnabled === "boolean") setShuffleEnabled(settings.shuffleEnabled);
        if (typeof settings.autoPlayEnabled === "boolean") setAutoPlayEnabled(settings.autoPlayEnabled);
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
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ shuffleEnabled, autoPlayEnabled }));
  }, [autoPlayEnabled, hydrated, shuffleEnabled, syncUser]);

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
    setCurrentIndex(playbackTracks.length ? (playingIndex >= 0 ? playingIndex : 0) : null);
    queueMicrotask(() => { syncApplyingRef.current = false; });
  }, []);

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
    if (!hydrated || syncInitializedRef.current) return;
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
      void navigator.serviceWorker.register("/sw.js?v=5", { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch(() => undefined);
    }
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      installPromptRef.current = event as InstallPromptEvent;
      setCanInstall(true);
    };
    const onInstalled = () => {
      installPromptRef.current = null;
      setCanInstall(false);
      setInstallOpen(false);
      setMessage("Drive Music đã được thêm vào màn hình chính.");
    };
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
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
          setMessage("iPhone đang giữ phiên phát nền. Drive Music sẽ tự nối lại khi có thể.");
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
          setMessage("Đang tự nối lại phiên phát...");
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
      setMessage("Đang tải bản nhạc chất lượng gốc...");
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
      if (autoPlayEnabled) {
        playNextAutomatically();
      } else {
        shouldResumeRef.current = false;
        setMessage("Đã phát xong. Tự động phát đang tắt.");
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
        setMessage("iPhone đã tạm dừng kết nối nền. Drive Music sẽ tự nối lại khi ứng dụng hoạt động.");
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
        setMessage("Bài này phản hồi quá chậm, đang tự chuyển sang bài kế tiếp...");
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
  }, [armFallbackTimer, autoPlayEnabled, clearFallbackTimer, clearRecoveryTimer, playNextAutomatically, requestPlayback]);

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
      setMessage("Đang tự nối lại phiên nghe nhạc...");
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
      setMessage("Đang tải bản nhạc chất lượng gốc...");
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

  const openPlaylist = (target: MusicPlaylist) => {
    const audio = audioRef.current;
    const keepCurrentPlayback = Boolean(
      activeTrackIdRef.current &&
      audio?.src &&
      (!audio.paused || shouldResumeRef.current || (audio.currentTime > 0 && !audio.ended)),
    );
    metadataUpgradeStartedRef.current = false;
    setPlaylistRenameOpen(false);
    setPlaylistRenameName("");
    setActivePlaylistId(target.id);
    if (!keepCurrentPlayback) {
      shouldResumeRef.current = false;
      clearFallbackTimer();
      audio?.pause();
      if (audio) {
        audio.removeAttribute("src");
        audio.load();
      }
      const preloader = preloadAudioRef.current;
      if (preloader) {
        preloader.removeAttribute("src");
        preloader.load();
      }
      activeTrackIdRef.current = null;
      queuedTrackIdRef.current = null;
      preloadedTrackIdRef.current = null;
      clearTrackWarmup();
      playlistRef.current = target.tracks;
      setPlaybackPlaylistId(target.id);
      setCurrentIndex(target.tracks.length ? 0 : null);
      setCurrentTime(0);
      setDuration(0);
      setIsBuffering(false);
    }
    setMessage(keepCurrentPlayback
      ? `Đã mở ${target.name}. Bài đang nghe vẫn tiếp tục phát.`
      : `Đã mở ${target.name}.`);
  };

  const playFromActivePlaylist = (index: number) => {
    playlistRef.current = playlist;
    setPlaybackPlaylistId(activePlaylistId);
    playAt(index);
  };

  const createPlaylist = (event: FormEvent) => {
    event.preventDefault();
    const name = newPlaylistName.trim();
    if (!name) return;
    if (playlists.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setMessage("Tên playlist này đã tồn tại.");
      return;
    }
    const created: MusicPlaylist = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `playlist-${Date.now()}`,
      name,
      tracks: [],
    };
    setPlaylists((current) => [...current, created]);
    setNewPlaylistName("");
    setPlaylistFormOpen(false);
    setPlaylistRenameOpen(false);
    setPlaylistRenameName("");
    openPlaylist(created);
  };

  const togglePlaylistRename = () => {
    if (!activePlaylist) return;
    if (playlistRenameOpen) {
      setPlaylistRenameOpen(false);
      setPlaylistRenameName("");
      return;
    }
    setPlaylistFormOpen(false);
    setNewPlaylistName("");
    setPlaylistRenameName(activePlaylist.name);
    setPlaylistRenameOpen(true);
  };

  const renameActivePlaylist = (event: FormEvent) => {
    event.preventDefault();
    const target = activePlaylist;
    const name = playlistRenameName.trim();
    if (!target || !name) return;
    if (playlists.some((item) => (
      item.id !== target.id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    ))) {
      setMessage("Tên playlist này đã tồn tại.");
      return;
    }
    if (name === target.name) {
      setPlaylistRenameOpen(false);
      setPlaylistRenameName("");
      setMessage("Tên playlist không thay đổi.");
      return;
    }
    setPlaylists((current) => current.map((item) => (
      item.id === target.id ? { ...item, name } : item
    )));
    setPlaylistRenameOpen(false);
    setPlaylistRenameName("");
    setMessage(`Đã đổi tên playlist thành “${name}”.`);
  };

  const deleteActivePlaylist = () => {
    const target = activePlaylist;
    if (!target || playlists.length <= 1) {
      setMessage("Cần giữ lại ít nhất một playlist.");
      return;
    }
    const trackLabel = target.tracks.length
      ? ` và ${target.tracks.length} bài hát bên trong`
      : "";
    if (!window.confirm(`Xóa playlist “${target.name}”${trackLabel}?`)) return;

    const remaining = playlists.filter((item) => item.id !== target.id);
    const fallback = remaining.find((item) => item.id === playbackPlaylistId) ?? remaining[0];
    const deletesPlaybackQueue = target.id === playbackPlaylistId;
    setPlaylists(remaining);
    setActivePlaylistId(fallback.id);
    setPlaylistFormOpen(false);
    setNewPlaylistName("");
    setPlaylistRenameOpen(false);
    setPlaylistRenameName("");
    metadataUpgradeStartedRef.current = false;

    if (deletesPlaybackQueue) {
      shouldResumeRef.current = false;
      clearFallbackTimer();
      clearRecoveryTimer();
      clearTrackWarmup();
      const audio = audioRef.current;
      audio?.pause();
      if (audio) {
        audio.removeAttribute("src");
        audio.load();
      }
      const preloader = preloadAudioRef.current;
      if (preloader) {
        preloader.removeAttribute("src");
        preloader.load();
      }
      activeTrackIdRef.current = null;
      queuedTrackIdRef.current = null;
      preloadedTrackIdRef.current = null;
      playlistRef.current = fallback.tracks;
      setPlaybackPlaylistId(fallback.id);
      setCurrentIndex(fallback.tracks.length ? 0 : null);
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
      setIsBuffering(false);
    }
    setMessage(`Đã xóa playlist “${target.name}”.`);
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
        album: "Drive Music",
        artwork: [
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

  const requestInstall = async () => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone) {
      setMessage("Bạn đang dùng Drive Music ở chế độ ứng dụng.");
      return;
    }
    const prompt = installPromptRef.current;
    if (prompt) {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setCanInstall(false);
      return;
    }
    setInstallOpen(true);
  };

  const shareApp = async () => {
    const shareData = {
      title: "Drive Music",
      text: "Nghe nhạc từ MP3, FLAC và Google Drive công khai.",
      url: window.location.origin,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        return;
      }
    } else {
      await navigator.clipboard.writeText(shareData.url);
      setMessage("Đã sao chép link Drive Music.");
    }
  };

  const progress = duration ? Math.min(100, (currentTime / duration) * 100) : 0;
  const volumeProgress = Math.round(volume * 100);
  const accountLabel = !syncUser ? "Đăng nhập" : syncUser.role === "admin" ? "Admin" : "Tài khoản";

  return (
    <main className="app-shell" style={{ "--track-hue": activeHue } as CSSProperties}>
      <audio ref={audioRef} playsInline preload="auto" />
      {!usesSystemVolume && <audio aria-hidden="true" ref={preloadAudioRef} preload="metadata" />}

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Icon name="music" size={22} /></span>
          <span>
            <strong>Drive Music</strong>
            <small>{syncUser ? syncStatusLabel(syncStatus) : "Playlist trên thiết bị của bạn"}</small>
          </span>
        </div>
        <div className="header-actions">
          <button
            aria-expanded={syncPanelOpen}
            aria-label={syncUser ? "Tài khoản và đồng bộ" : "Mở đăng nhập hoặc đăng ký"}
            className={`icon-button sync-button identity-visible ${syncUser ? "connected" : "signed-out"} ${syncStatus} ${syncStatus === "syncing" || syncStatus === "checking" ? "working" : ""}`}
            onClick={() => setSyncPanelOpen((open) => !open)}
            type="button"
          >
            <Icon name={syncUser?.role === "admin" ? "shield" : "cloud"} size={18} />
            <span className="sync-button-label">{accountLabel}</span>
            <span className="sync-dot" />
          </button>
          <button aria-label="Chia sẻ Drive Music" className="icon-button" onClick={shareApp} type="button">
            <Icon name="share" size={18} />
          </button>
          <button aria-label="Thêm vào màn hình chính" className={`icon-button ${canInstall ? "install-ready" : ""}`} onClick={requestInstall} type="button">
            <Icon name="install" size={18} />
          </button>
          <button className="add-button" onClick={() => setFormOpen((open) => !open)} type="button">
            <Icon name={formOpen ? "close" : "add"} size={18} />
            <span>{formOpen ? "Đóng" : "Thêm nhạc"}</span>
          </button>
        </div>
      </header>

      {syncPanelOpen && (
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
                <small>Drive Music không nhận mật khẩu hoặc nội dung trò chuyện.</small>
              </div>
              <a className="sync-signin" href="/signin-with-chatgpt?return_to=%2F">Tiếp tục đăng nhập</a>
            </>
          )}
        </section>
      )}

      {installOpen && (
        <div className="modal-backdrop" onClick={() => setInstallOpen(false)} role="presentation">
          <section aria-labelledby="install-title" aria-modal="true" className="install-dialog" onClick={(event) => event.stopPropagation()} role="dialog">
            <button aria-label="Đóng hướng dẫn" className="dialog-close" onClick={() => setInstallOpen(false)} type="button">
              <Icon name="close" size={19} />
            </button>
            <span className="dialog-mark"><Icon name="install" size={25} /></span>
            <p className="eyebrow">CÀI DRIVE MUSIC</p>
            <h2 id="install-title">Thêm vào màn hình chính</h2>
            <p className="dialog-copy">Trên iPhone, hãy mở trang bằng Safari rồi làm theo ba bước:</p>
            <ol className="install-steps">
              <li><span>1</span><div>Chạm nút <strong>Chia sẻ</strong> của Safari.</div></li>
              <li><span>2</span><div>Chọn <strong>Thêm vào Màn hình chính</strong>.</div></li>
              <li><span>3</span><div>Chạm <strong>Thêm</strong> để hoàn tất.</div></li>
            </ol>
            <button className="dialog-done" onClick={() => setInstallOpen(false)} type="button">Đã hiểu</button>
          </section>
        </div>
      )}

      {formOpen && (
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
                  <small>Tên bài hát, ca sĩ, định dạng và dung lượng</small>
                  <span aria-hidden="true" className="metadata-progress"><i /></span>
                </span>
              </div>
            )}
            {!readingMetadata && driveMetadata && (
              <p aria-live="polite" className="metadata-status detected" role="status">
                Đã nhận {driveMetadata.format || "file nhạc"}
                {formatBytes(driveMetadata.size) ? ` · ${formatBytes(driveMetadata.size)}` : ""}
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
          <span aria-hidden="true" className="artwork-aurora" />
          <div className="artwork-grid" />
          <div className="sound-bars" aria-hidden="true">
            <i /><i /><i /><i /><i />
          </div>
          <span className="source-badge"><Icon name={currentTrack && isGoogleDriveUrl(currentTrack.originalUrl) ? "drive" : "music"} size={16} /></span>
        </div>

        <div className="player-content">
          <div className="track-heading">
            <p className="eyebrow">{isPlaying ? "ĐANG PHÁT" : "DRIVE MUSIC"}</p>
            <h1>{currentTrack?.title ?? "Playlist của bạn đang trống"}</h1>
            <p className="artist-name">{currentTrack?.artist ?? "Thêm một link nhạc để bắt đầu"}</p>
          </div>
          {currentTrack && (
            <div className="quality-row">
              <span>{currentTrack.format || "AUDIO"}</span>
              <span>Chất lượng gốc</span>
              {formatBytes(currentTrack.size) && <span>{formatBytes(currentTrack.size)}</span>}
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
            <button aria-label="Bài trước" disabled={!playbackQueue.length} onClick={playPrevious} type="button"><Icon name="previous" size={25} /></button>
            <button aria-label={isPlaying ? "Tạm dừng" : "Phát"} className={`play-button ${isBuffering ? "buffering" : ""}`} disabled={!playbackQueue.length} onClick={togglePlayback} type="button">
              <Icon name={isPlaying ? "pause" : "play"} size={30} />
              {isBuffering && <span className="buffer-ring" />}
            </button>
            <button aria-label="Bài sau" disabled={!playbackQueue.length} onClick={playNext} type="button"><Icon name="next" size={25} /></button>
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
          <div className="playback-options">
            <button
              aria-pressed={shuffleEnabled}
              className={shuffleEnabled ? "active" : ""}
              onClick={() => {
                clearTrackWarmup();
                queuedTrackIdRef.current = null;
                preloadedTrackIdRef.current = null;
                setShuffleEnabled((enabled) => !enabled);
              }}
              type="button"
            >
              <Icon name="shuffle" size={16} /><span>Trộn bài</span>
            </button>
            <button
              aria-pressed={autoPlayEnabled}
              className={autoPlayEnabled ? "active" : ""}
              onClick={() => setAutoPlayEnabled((enabled) => !enabled)}
              type="button"
            >
              <Icon name="autoplay" size={16} /><span>Tự động phát</span>
            </button>
            <button
              aria-controls="playlist-library"
              aria-expanded={libraryVisible}
              className={libraryVisible ? "active" : ""}
              onClick={() => setLibraryVisible((visible) => !visible)}
              type="button"
            >
              <Icon name="queue" size={16} /><span>Danh sách phát</span>
            </button>
          </div>
        </div>
      </section>

      {message && <p className="status-message" role="status">{message}</p>}

      <section className="playlist-section" hidden={!libraryVisible} id="playlist-library">
        <div className="section-heading">
          <div><p className="eyebrow">THƯ VIỆN</p><h2>{activePlaylist?.name ?? "Playlist"}</h2></div>
          <div className="playlist-heading-actions">
            <span>{playlist.length} bài hát</span>
            <button
              aria-label={playlistRenameOpen ? "Đóng phần đổi tên playlist" : `Đổi tên playlist ${activePlaylist?.name ?? "hiện tại"}`}
              className={`playlist-rename ${playlistRenameOpen ? "active" : ""}`}
              onClick={togglePlaylistRename}
              type="button"
            >
              <Icon name={playlistRenameOpen ? "close" : "edit"} size={15} />
              <span>{playlistRenameOpen ? "Đóng" : "Đổi tên"}</span>
            </button>
            {playlists.length > 1 && (
              <button aria-label={`Xóa playlist ${activePlaylist?.name ?? "hiện tại"}`} className="playlist-delete" onClick={deleteActivePlaylist} type="button">
                <Icon name="trash" size={15} />
                <span>Xóa playlist</span>
              </button>
            )}
            <button
              aria-label={playlistFormOpen ? "Đóng phần tạo playlist" : "Tạo playlist mới"}
              onClick={() => {
                setPlaylistRenameOpen(false);
                setPlaylistRenameName("");
                setPlaylistFormOpen((open) => !open);
              }}
              type="button"
            >
              <Icon name={playlistFormOpen ? "close" : "add"} size={15} />
              <span>{playlistFormOpen ? "Đóng" : "Playlist mới"}</span>
            </button>
          </div>
        </div>

        {playlistFormOpen && (
          <form className="playlist-create" onSubmit={createPlaylist}>
            <label className="field">
              <span>Tên playlist mới</span>
              <input
                autoFocus
                maxLength={48}
                onChange={(event) => setNewPlaylistName(event.target.value)}
                placeholder="Ví dụ: Nhạc lái xe"
                required
                value={newPlaylistName}
              />
            </label>
            <button className="submit-button" type="submit"><Icon name="add" size={16} /> Tạo playlist</button>
          </form>
        )}

        {playlistRenameOpen && (
          <form className="playlist-create playlist-rename-form" onSubmit={renameActivePlaylist}>
            <label className="field">
              <span>Tên mới của playlist</span>
              <input
                autoFocus
                maxLength={48}
                onChange={(event) => setPlaylistRenameName(event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                placeholder="Nhập tên playlist"
                required
                value={playlistRenameName}
              />
            </label>
            <button className="submit-button" type="submit"><Icon name="edit" size={16} /> Lưu tên mới</button>
          </form>
        )}

        <div aria-label="Danh sách playlist" className="playlist-tabs">
          {playlists.map((item) => (
            <button
              aria-current={item.id === activePlaylistId ? "true" : undefined}
              className={item.id === activePlaylistId ? "active" : ""}
              key={item.id}
              onClick={() => {
                if (item.id !== activePlaylistId) openPlaylist(item);
              }}
              type="button"
            >
              <Icon name="music" size={14} />
              <span>{item.name}</span>
              <small>{item.tracks.length}</small>
            </button>
          ))}
        </div>

        {!playlist.length ? (
          <button className="empty-state" onClick={() => setFormOpen(true)} type="button">
            <span><Icon name="music" size={28} /></span>
            <strong>Chưa có bài hát</strong>
            <small>Thêm link MP3, FLAC hoặc Google Drive công khai</small>
          </button>
        ) : (
          <ol className="track-list">
            {playlist.map((track, index) => (
              <li className={currentTrack?.id === track.id ? "active" : ""} key={track.id}>
                <button className="track-main" onClick={() => playFromActivePlaylist(index)} type="button">
                  <span className="track-cover" style={{ "--cover-hue": colorHue(track.id) } as CSSProperties}>
                    {currentTrack?.id === track.id && isPlaying ? <Icon name="pause" size={16} /> : <Icon name="music" size={17} />}
                    <small>{String(index + 1).padStart(2, "0")}</small>
                  </span>
                  <span className="track-copy"><strong>{track.title}</strong><small>{track.artist} · {track.format || (isGoogleDriveUrl(track.originalUrl) ? "Google Drive" : "Link âm thanh")}{formatBytes(track.size) ? ` · ${formatBytes(track.size)}` : ""}</small></span>
                </button>
                <button aria-label={`Xóa ${track.title}`} className="remove-button" onClick={() => removeTrack(index)} type="button"><Icon name="trash" size={18} /></button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <footer>
        <p>Không bắt buộc tài khoản. Chế độ khách lưu playlist trên thiết bị; đăng nhập sẽ đồng bộ metadata và link giữa các thiết bị. File nhạc vẫn phát trực tiếp từ nguồn gốc, không tải lên server, không chuyển mã hoặc giảm chất lượng.</p>
        <a href="https://github.com/mm4you" rel="noreferrer" target="_blank">
          <Icon name="github" size={15} /> Built by Khang with Codex · @mm4you
        </a>
      </footer>
    </main>
  );
}
