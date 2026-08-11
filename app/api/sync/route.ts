import { eq } from "drizzle-orm";
import { roleForUser } from "../../authz";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { musicLibraries } from "../../../db/schema";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 768 * 1024;
const MAX_PLAYLISTS = 100;
const MAX_TRACKS = 5000;

type SyncedTrack = {
  id: string;
  title: string;
  artist: string;
  originalUrl: string;
  album?: string;
  format?: string;
  size?: number;
};

type SyncedPlaylist = {
  id: string;
  name: string;
  tracks: SyncedTrack[];
};

type LibraryPayload = {
  playlists: SyncedPlaylist[];
  activePlaylistId: string;
  settings: {
    shuffleEnabled: boolean;
    autoPlayEnabled: boolean;
  };
};

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function optionalString(value: unknown, maxLength: number) {
  const cleaned = cleanString(value, maxLength);
  return cleaned || undefined;
}

function validHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validatePayload(value: unknown): LibraryPayload | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  if (!Array.isArray(source.playlists) || source.playlists.length < 1 || source.playlists.length > MAX_PLAYLISTS) return null;

  let trackCount = 0;
  const playlistIds = new Set<string>();
  const playlists: SyncedPlaylist[] = [];
  for (const rawPlaylist of source.playlists) {
    if (!rawPlaylist || typeof rawPlaylist !== "object") return null;
    const item = rawPlaylist as Record<string, unknown>;
    const id = cleanString(item.id, 100);
    const name = cleanString(item.name, 80);
    if (!id || !name || playlistIds.has(id) || !Array.isArray(item.tracks)) return null;
    playlistIds.add(id);

    const trackIds = new Set<string>();
    const tracks: SyncedTrack[] = [];
    for (const rawTrack of item.tracks) {
      if (!rawTrack || typeof rawTrack !== "object") return null;
      const track = rawTrack as Record<string, unknown>;
      const trackId = cleanString(track.id, 100);
      const title = cleanString(track.title, 500);
      const artist = cleanString(track.artist, 500);
      const originalUrl = cleanString(track.originalUrl, 4096);
      if (!trackId || !title || !artist || !validHttpUrl(originalUrl) || trackIds.has(trackId)) return null;
      trackIds.add(trackId);
      trackCount += 1;
      if (trackCount > MAX_TRACKS) return null;
      const size = typeof track.size === "number" && Number.isFinite(track.size) && track.size >= 0
        ? Math.min(Math.round(track.size), 1_000_000_000_000)
        : undefined;
      tracks.push({
        id: trackId,
        title,
        artist,
        originalUrl,
        album: optionalString(track.album, 500),
        format: optionalString(track.format, 32),
        size,
      });
    }
    playlists.push({ id, name, tracks });
  }

  const settings = source.settings && typeof source.settings === "object"
    ? source.settings as Record<string, unknown>
    : {};
  const requestedActiveId = cleanString(source.activePlaylistId, 100);
  return {
    playlists,
    activePlaylistId: playlistIds.has(requestedActiveId) ? requestedActiveId : playlists[0].id,
    settings: {
      shuffleEnabled: settings.shuffleEnabled === true,
      autoPlayEnabled: settings.autoPlayEnabled !== false,
    },
  };
}

async function ownerId(email: string) {
  const bytes = new TextEncoder().encode(email.trim().toLocaleLowerCase());
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function authenticatedUser() {
  const user = await getChatGPTUser();
  return user ? { user, ownerId: await ownerId(user.email) } : null;
}

function publicUser(user: NonNullable<Awaited<ReturnType<typeof getChatGPTUser>>>) {
  return { displayName: user.displayName, email: user.email, role: roleForUser(user) };
}

export async function GET() {
  const authenticated = await authenticatedUser();
  if (!authenticated) return json({ error: "Sign in required" }, 401);

  const db = getDb();
  const rows = await db
    .select()
    .from(musicLibraries)
    .where(eq(musicLibraries.ownerId, authenticated.ownerId))
    .limit(1);
  const row = rows[0];
  const accountName = authenticated.user.fullName?.trim().slice(0, 200) || null;
  if (row && accountName && row.accountName !== accountName) {
    await db
      .update(musicLibraries)
      .set({ accountName })
      .where(eq(musicLibraries.ownerId, authenticated.ownerId));
  }
  let payload: LibraryPayload | null = null;
  if (row) {
    try {
      payload = validatePayload(JSON.parse(row.payload));
    } catch {
      payload = null;
    }
  }
  return json({
    user: publicUser(authenticated.user),
    snapshot: row && payload ? {
      payload,
      revision: row.revision,
      updatedAt: row.updatedAt,
    } : null,
  });
}

export async function PUT(request: Request) {
  const authenticated = await authenticatedUser();
  if (!authenticated) return json({ error: "Sign in required" }, 401);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Cross-origin sync is not allowed" }, 403);
  if (!request.headers.get("content-type")?.toLocaleLowerCase().startsWith("application/json")) {
    return json({ error: "JSON content type required" }, 415);
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) return json({ error: "Sync payload is too large" }, 413);

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: "Sync payload is too large" }, 413);
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid sync payload" }, 400);
  }

  const payload = validatePayload(body.payload);
  const baseRevision = Number(body.baseRevision ?? 0);
  if (!payload || !Number.isSafeInteger(baseRevision) || baseRevision < 0) return json({ error: "Invalid sync payload" }, 400);

  const db = getDb();
  const rows = await db
    .select()
    .from(musicLibraries)
    .where(eq(musicLibraries.ownerId, authenticated.ownerId))
    .limit(1);
  const current = rows[0];
  if ((current?.revision ?? 0) !== baseRevision) {
    let currentPayload: LibraryPayload | null = null;
    try {
      currentPayload = current ? validatePayload(JSON.parse(current.payload)) : null;
    } catch {
      currentPayload = null;
    }
    return json({
      error: "Sync conflict",
      snapshot: current && currentPayload ? {
        payload: currentPayload,
        revision: current.revision,
        updatedAt: current.updatedAt,
      } : null,
    }, 409);
  }

  const revision = baseRevision + 1;
  const updatedAt = Date.now();
  const accountName = authenticated.user.fullName?.trim().slice(0, 200) || current?.accountName || null;
  const writes = await db
    .insert(musicLibraries)
    .values({
      ownerId: authenticated.ownerId,
      accountName,
      payload: JSON.stringify(payload),
      revision,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: musicLibraries.ownerId,
      setWhere: eq(musicLibraries.revision, baseRevision),
      set: {
        accountName,
        payload: JSON.stringify(payload),
        revision,
        updatedAt,
      },
    })
    .returning({ revision: musicLibraries.revision });

  if (!writes.length) {
    const latestRows = await db
      .select()
      .from(musicLibraries)
      .where(eq(musicLibraries.ownerId, authenticated.ownerId))
      .limit(1);
    const latest = latestRows[0];
    let latestPayload: LibraryPayload | null = null;
    try {
      latestPayload = latest ? validatePayload(JSON.parse(latest.payload)) : null;
    } catch {
      latestPayload = null;
    }
    return json({
      error: "Sync conflict",
      snapshot: latest && latestPayload ? {
        payload: latestPayload,
        revision: latest.revision,
        updatedAt: latest.updatedAt,
      } : null,
    }, 409);
  }

  return json({
    user: publicUser(authenticated.user),
    snapshot: { payload, revision, updatedAt },
  });
}
