import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

const SOURCE_FOLDER_ID = "1yLdID1cWy3JmLB3TAUiazxBcRAja0Xpt";
const MANIFEST_KEY = "catalog/manifest-v1.json";
const AUDIO_EXTENSION = /\.(mp3|flac|m4a|aac|ogg|oga|opus|wav)$/i;

type SourceFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
};

type CatalogTrack = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  format?: string;
  objectKey: string;
};

type CatalogManifest = {
  sourceFolderId: string;
  total: number;
  complete: boolean;
  updatedAt: number;
  tracks: CatalogTrack[];
};

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function readManifest(): Promise<CatalogManifest | null> {
  const object = await env.BUCKET.get(MANIFEST_KEY);
  if (!object) return null;
  try {
    return await object.json<CatalogManifest>();
  } catch {
    return null;
  }
}

function publicManifest(manifest: CatalogManifest | null, requestUrl: string) {
  const tracks = manifest?.tracks.map((track) => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    format: track.format,
    originalUrl: new URL(`/api/catalog?audio=${encodeURIComponent(track.objectKey)}`, requestUrl).href,
  })) ?? [];
  return {
    complete: manifest?.complete ?? false,
    imported: tracks.length,
    total: manifest?.total ?? 30,
    tracks,
  };
}

function safeObjectKey(file: SourceFile) {
  const extension = file.name.match(AUDIO_EXTENSION)?.[0]?.toLowerCase() ?? "";
  return `audio/${file.id}${extension}`;
}

function fallbackTitle(filename: string) {
  return filename
    .replace(AUDIO_EXTENSION, "")
    .replace(/^\s*\d{1,3}[.\s_-]+/, "")
    .replace(/[_]+/g, " ")
    .trim() || "Drive Music";
}

function formatFromFile(file: SourceFile) {
  const extension = file.name.match(AUDIO_EXTENSION)?.[1];
  return extension?.toUpperCase() || file.mimeType.replace(/^audio\//i, "").toUpperCase() || "AUDIO";
}

async function getSourceFiles(request: Request): Promise<SourceFile[]> {
  const url = new URL(`/api/drive?folder=${SOURCE_FOLDER_ID}`, request.url);
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Không đọc được thư mục nguồn.");
  const listing = await response.json() as { files?: SourceFile[] };
  return Array.isArray(listing.files) ? listing.files : [];
}

async function importNext(request: Request) {
  const files = await getSourceFiles(request);
  if (!files.length) return json({ error: "Thư mục nguồn chưa có file nhạc công khai." }, 502);

  const current = await readManifest();
  const existingTracks = current?.sourceFolderId === SOURCE_FOLDER_ID ? current.tracks : [];
  const importedIds = new Set(existingTracks.map((track) => track.id));
  const nextFile = files.find((file) => !importedIds.has(file.id));
  if (!nextFile) {
    const completeManifest: CatalogManifest = {
      sourceFolderId: SOURCE_FOLDER_ID,
      total: files.length,
      complete: true,
      updatedAt: Date.now(),
      tracks: existingTracks,
    };
    await env.BUCKET.put(MANIFEST_KEY, JSON.stringify(completeManifest), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
    return json(publicManifest(completeManifest, request.url));
  }

  const objectKey = safeObjectKey(nextFile);
  const streamUrl = new URL(`/api/drive?id=${encodeURIComponent(nextFile.id)}&stream=catalog-v1`, request.url);
  const audioResponse = await fetch(streamUrl, { headers: { Accept: "audio/*,application/octet-stream" } });
  const contentType = audioResponse.headers.get("content-type") ?? nextFile.mimeType ?? "application/octet-stream";
  if (!audioResponse.ok || contentType.includes("text/html") || !audioResponse.body) {
    audioResponse.body?.cancel();
    return json({ error: `Chưa thể lưu ${nextFile.name}. Sẽ thử lại ở lượt sau.` }, 502);
  }

  await env.BUCKET.put(objectKey, audioResponse.body, {
    httpMetadata: { contentType },
    customMetadata: { sourceId: nextFile.id, sourceName: nextFile.name.slice(0, 500) },
  });

  let title = fallbackTitle(nextFile.name);
  let artist = "Drive Music";
  let album: string | undefined;
  let format = formatFromFile(nextFile);
  try {
    const metadataUrl = new URL(`/api/drive?id=${encodeURIComponent(nextFile.id)}&metadata=1`, request.url);
    const metadataResponse = await fetch(metadataUrl, { headers: { Accept: "application/json" } });
    if (metadataResponse.ok) {
      const metadata = await metadataResponse.json() as {
        title?: string | null;
        artist?: string | null;
        album?: string | null;
        format?: string | null;
      };
      title = metadata.title?.trim() || title;
      artist = metadata.artist?.trim() || artist;
      album = metadata.album?.trim() || undefined;
      format = metadata.format?.trim() || format;
    }
  } catch {
    // Filename metadata is enough to keep the shared catalog usable.
  }

  const tracks = [...existingTracks, {
    id: nextFile.id,
    title,
    artist,
    album,
    format,
    objectKey,
  }];
  const manifest: CatalogManifest = {
    sourceFolderId: SOURCE_FOLDER_ID,
    total: files.length,
    complete: tracks.length >= files.length,
    updatedAt: Date.now(),
    tracks,
  };
  await env.BUCKET.put(MANIFEST_KEY, JSON.stringify(manifest), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
  return json(publicManifest(manifest, request.url));
}

function parseRange(value: string | null, size: number) {
  const match = value?.match(/^bytes=(\d*)-(\d*)$/i);
  if (!match) return null;
  const start = match[1] ? Number(match[1]) : Number.NaN;
  const end = match[2] ? Number(match[2]) : Number.NaN;
  if (Number.isFinite(start)) {
    const safeEnd = Number.isFinite(end) ? Math.min(end, size - 1) : size - 1;
    if (start < 0 || start >= size || safeEnd < start) return null;
    return { offset: start, length: safeEnd - start + 1 };
  }
  if (Number.isFinite(end) && end > 0) {
    const length = Math.min(end, size);
    return { offset: size - length, length };
  }
  return null;
}

async function audioResponse(request: Request, objectKey: string, headOnly = false) {
  if (!objectKey.startsWith("audio/") || objectKey.includes("..")) return json({ error: "Invalid audio key" }, 400);
  const head = await env.BUCKET.head(objectKey);
  if (!head) return json({ error: "Audio not found" }, 404);
  const rangeHeader = request.headers.get("range");
  const range = parseRange(rangeHeader, head.size);
  if (rangeHeader && !range) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${head.size}` } });
  }
  const object = headOnly ? null : await env.BUCKET.get(objectKey, range ? { range } : undefined);
  if (!headOnly && !object) return json({ error: "Audio not found" }, 404);
  const headers = new Headers();
  head.writeHttpMetadata(headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=86400, immutable");
  headers.set("ETag", head.httpEtag);
  headers.set("Content-Length", String(range?.length ?? head.size));
  if (range) headers.set("Content-Range", `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`);
  return new Response(headOnly ? null : object?.body, {
    status: range ? 206 : 200,
    headers,
  });
}

export async function GET(request: Request) {
  const audioKey = new URL(request.url).searchParams.get("audio");
  if (audioKey) return audioResponse(request, audioKey);
  return json(publicManifest(await readManifest(), request.url));
}

export async function HEAD(request: Request) {
  const audioKey = new URL(request.url).searchParams.get("audio");
  if (!audioKey) return new Response(null, { status: 204 });
  return audioResponse(request, audioKey, true);
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Cross-origin import is not allowed." }, 403);
  return importNext(request);
}
