import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

const SOURCE_FOLDER_ID = "1yLdID1cWy3JmLB3TAUiazxBcRAja0Xpt";
const MANIFEST_KEY = "catalog/manifest-v1.json";
const AUDIO_EXTENSION = /\.(mp3|flac|m4a|aac|ogg|oga|opus|wav)$/i;
const MULTIPART_CHUNK_BYTES = 5 * 1024 * 1024;

type SourceFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
};

const SOURCE_FILES: SourceFile[] = [
  { id: "18B7wTjbf6YmeeLtzJNv2Etoqq5dyn6R5", name: "01. Elegie.flac", mimeType: "audio/flac", size: 30379582 },
  { id: "1d6KPv_a2awhVvmimI_uLM-WtZEX1CI-Z", name: "02. IDK.flac", mimeType: "audio/flac", size: 75523434 },
  { id: "1K6Wj-NtZqLLSMD8GxCYIjeGDfzVhsP31", name: "03. Wtf Bby I'm Lit.flac", mimeType: "audio/flac", size: 62455274 },
  { id: "1lGApI1rGNDZbbch5tvvmZ0hKVrmBlP5l", name: "04. Anh Không Muốn Nó Dễ Dàng.flac", mimeType: "audio/flac", size: 65108805 },
  { id: "1oaj87i7fiEEeEmCFvmnc-K3r90CoUZHL", name: "05. Baby (feat. marzuz).flac", mimeType: "audio/flac", size: 66434021 },
  { id: "1X1Y1kxT55Sv2hvj5-pIzdNh2knFmJCZD", name: "06. Yêu Anh Giết Anh.flac", mimeType: "audio/flac", size: 62517851 },
  { id: "1kWv8qY3tK1srcd6gDVNBT0_Y4Yf8fOvx", name: "07. Mắt Môi Tay Chân (feat. Tage).flac", mimeType: "audio/flac", size: 72374098 },
  { id: "1O70xU-CPQcRhbV7nTAdG68F9MbRquO36", name: "08. Đao Của Anh Vừa.flac", mimeType: "audio/flac", size: 48187111 },
  { id: "1O5x3tCwRsyqY5BLUhI0CFDQZQaVsfIp_", name: "09. Là Gì Của Nhau.flac", mimeType: "audio/flac", size: 51592565 },
  { id: "1sgaZKgGysGebYWvIGCGT2G6F7Qf0671u", name: "10. Night In Prague.flac", mimeType: "audio/flac", size: 78563687 },
  { id: "1JeACb1D5FBiB3ROInjWEQDy9Vd62rzd5", name: "11. Một Cái Ôm.flac", mimeType: "audio/flac", size: 65446972 },
  { id: "1lc6W3Go9ybXLGhYNGAFN-_ob64MflVVL", name: "12. Liệm.flac", mimeType: "audio/flac", size: 90835362 },
  { id: "13tdU4ChHgkDSkjHV87aqLZyPKIeWiun-", name: "13. Nếu Như Ta Chẳng Còn (feat. A$AP Ướt Mi).flac", mimeType: "audio/flac", size: 116995739 },
  { id: "1KM8BG-8dAm4Q30bJ52UR5UwfDQ5si_bJ", name: "14. Ai Mới Là Kẻ Xấu Xa.flac", mimeType: "audio/flac", size: 77945681 },
  { id: "1p098x-nFu79GWTAvA5Z59fjHDY2CDH-X", name: "15. Slippery (feat. Tùng Dương).flac", mimeType: "audio/flac", size: 89012975 },
  { id: "1T-XKDC9j9OTzMnVJlTGlZ3XEiOxubMCy", name: "16. Intenpol.flac", mimeType: "audio/flac", size: 23025982 },
  { id: "1_purQHSHrB_2VikgoxlM1jHMheAqsvN0", name: "17. Tây Thi.flac", mimeType: "audio/flac", size: 42739607 },
  { id: "1dFbzyQF-cbNIsahJFGxoBQUA-Wqkn7u6", name: "18. Hút và Hút.flac", mimeType: "audio/flac", size: 54178193 },
  { id: "178thNTHBYs4NoQr6dwiIqmRlTuK2RM1e", name: "19. Dưa Chua.flac", mimeType: "audio/flac", size: 71208489 },
  { id: "1m6d-S7RSbse4Er3ZF_vZMLmEUBLAxWhL", name: "20. Xa Xôi (feat. Obito).flac", mimeType: "audio/flac", size: 83790468 },
  { id: "1TcFn90c3uEtL-UAf1xkJylKdXqkcnnbz", name: "21. Che Phủ.flac", mimeType: "audio/flac", size: 60252257 },
  { id: "1j61Mco96veNwJz1JypcLJYnd3ImgJ0ik", name: "22. Oanh M = Thuoc.flac", mimeType: "audio/flac", size: 79752274 },
  { id: "1XUqfhsR1yCkRQCNUkFjUmzizKbukBNaP", name: "23. Ghet Xog Lai Thik.flac", mimeType: "audio/flac", size: 50278961 },
  { id: "1JPJzJBENfPILgEZqP2pMYeNni1VQPQIR", name: "24. Nhìn Kẻ Thù Của Tao.flac", mimeType: "audio/flac", size: 90706418 },
  { id: "1LGDP3qTNk3mBEUKXsEqY9SExQsxSHvH7", name: "25. Envy (feat. THANHDRAW).flac", mimeType: "audio/flac", size: 90218850 },
  { id: "155WGcZ7AzD4TavEjvXV8vyux9-ITDhWW", name: "26. Cảm Ơn.flac", mimeType: "audio/flac", size: 51784858 },
  { id: "1Kv_Z--xAUHlzX0Ui_eMPCrPuq2lZtRP7", name: "27. Không Cần Lo Cho Tao.flac", mimeType: "audio/flac", size: 63918584 },
  { id: "1rYnKEYchuOill5A4wElid3zZY-UI1yEw", name: "28. Huh (feat. RPT Orijinn & THANHDRAW).flac", mimeType: "audio/flac", size: 97542998 },
  { id: "1T9z5rVG6KB2gF44MGDWeLLUOddM45tVd", name: "29. Nguyễn Văn Mười.flac", mimeType: "audio/flac", size: 77174193 },
  { id: "1MWwN6KZ9cA1JQRWFvYwxJpQxnjSDjvyc", name: "30. Thịt Lợn.flac", mimeType: "audio/flac", size: 90422264 },
];

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
  migration?: {
    fileId: string;
    objectKey: string;
    uploadId: string;
    nextPart: number;
    offset: number;
    size: number;
    parts: Array<{ partNumber: number; etag: string }>;
  };
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
  const tracks = manifest?.tracks.map((track) => {
    const title = displayTitle(track.title);
    return {
      id: track.id,
      title,
      artist: featuredArtist(title),
      album: track.album || "HVL",
      format: track.format,
      originalUrl: new URL(`/api/catalog?audio=${encodeURIComponent(track.objectKey)}`, requestUrl).href,
    };
  }) ?? [];
  return {
    complete: manifest?.complete ?? false,
    imported: tracks.length,
    total: manifest?.total ?? 30,
    tracks,
  };
}

function displayTitle(title: string) {
  return title.replace(/\bAAP Ướt Mi\b/g, "A$AP Ướt Mi");
}

function featuredArtist(title: string) {
  const featured = title.match(/\(feat\.\s*([^)]+)\)/i)?.[1]?.trim();
  return featured ? `RPT MCK feat. ${featured}` : "RPT MCK";
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

function migrationAuthorized(request: Request) {
  const expected = (env as typeof env & { CATALOG_MIGRATION_TOKEN?: string }).CATALOG_MIGRATION_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || expected.length < 32 || supplied.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  }
  return difference === 0;
}

async function saveManifest(manifest: CatalogManifest) {
  await env.BUCKET.put(MANIFEST_KEY, JSON.stringify(manifest), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

async function acquireMigrationLock() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS catalog_migration_lock (
    id INTEGER PRIMARY KEY,
    owner TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )`).run();
  const owner = crypto.randomUUID();
  const now = Date.now();
  await env.DB.prepare(
    "INSERT OR IGNORE INTO catalog_migration_lock (id, owner, expires_at) VALUES (1, ?, ?)",
  ).bind(owner, now + 60_000).run();
  const result = await env.DB.prepare(
    "UPDATE catalog_migration_lock SET owner = ?, expires_at = ? WHERE id = 1 AND (owner = ? OR expires_at < ?)",
  ).bind(owner, now + 60_000, owner, now).run();
  return result.meta.changes > 0 ? owner : null;
}

async function releaseMigrationLock(owner: string) {
  await env.DB.prepare(
    "UPDATE catalog_migration_lock SET expires_at = 0 WHERE id = 1 AND owner = ?",
  ).bind(owner).run();
}

async function trackMetadata(request: Request, file: SourceFile, objectKey: string): Promise<CatalogTrack> {
  let title = fallbackTitle(file.name);
  let artist = "Drive Music";
  let album: string | undefined;
  let format = formatFromFile(file);
  try {
    const metadataUrl = new URL(`/api/drive?id=${encodeURIComponent(file.id)}&metadata=1`, request.url);
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
  return { id: file.id, title, artist, album, format, objectKey };
}

async function initializeNext(request: Request) {
  const files = SOURCE_FILES;
  if (!files.length) return json({ error: "Thư mục nguồn chưa có file nhạc công khai." }, 502);

  const current = await readManifest();
  const existingTracks = current?.sourceFolderId === SOURCE_FOLDER_ID ? current.tracks : [];
  const currentMigration = current?.sourceFolderId === SOURCE_FOLDER_ID ? current.migration : undefined;

  if (currentMigration) {
    const file = files.find((item) => item.id === currentMigration.fileId);
    return json({ ...publicManifest(current, request.url), migration: currentMigration, file });
  }

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
    await saveManifest(completeManifest);
    return json(publicManifest(completeManifest, request.url));
  }

  const objectKey = safeObjectKey(nextFile);
  if (!nextFile.size || nextFile.size < 1) return json({ error: `Chưa đọc được kích thước của ${nextFile.name}.` }, 502);
  const multipart = await env.BUCKET.createMultipartUpload(objectKey, {
    httpMetadata: { contentType: nextFile.mimeType || "application/octet-stream" },
    customMetadata: { sourceId: nextFile.id, sourceName: nextFile.name.slice(0, 500) },
  });
  const manifest: CatalogManifest = {
    sourceFolderId: SOURCE_FOLDER_ID,
    total: files.length,
    complete: false,
    updatedAt: Date.now(),
    tracks: existingTracks,
    migration: {
      fileId: nextFile.id,
      objectKey,
      uploadId: multipart.uploadId,
      nextPart: 1,
      offset: 0,
      size: nextFile.size,
      parts: [],
    },
  };
  await saveManifest(manifest);
  return json(publicManifest(manifest, request.url));
}

async function uploadMigrationPart(request: Request) {
  if (!request.body) return json({ error: "Audio chunk required." }, 400);
  const current = await readManifest();
  const migration = current?.migration;
  if (!current || !migration) return json({ error: "No active catalog migration." }, 409);
  const file = SOURCE_FILES.find((item) => item.id === migration.fileId);
  if (!file) return json({ error: "Migration source file not found." }, 409);
  const expectedLength = Math.min(MULTIPART_CHUNK_BYTES, migration.size - migration.offset);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength !== expectedLength) {
    return json({ error: `Expected ${expectedLength} bytes, received ${contentLength}.` }, 400);
  }

  const multipart = env.BUCKET.resumeMultipartUpload(migration.objectKey, migration.uploadId);
  const uploadedPart = await multipart.uploadPart(migration.nextPart, request.body);
  const nextMigration = {
    ...migration,
    nextPart: migration.nextPart + 1,
    offset: migration.offset + expectedLength,
    parts: [...migration.parts, uploadedPart],
  };
  if (nextMigration.offset < nextMigration.size) {
    const partialManifest: CatalogManifest = { ...current, updatedAt: Date.now(), migration: nextMigration };
    await saveManifest(partialManifest);
    return json({ ...publicManifest(partialManifest, request.url), migration: nextMigration, file });
  }

  await multipart.complete(nextMigration.parts);
  const tracks = [...current.tracks, await trackMetadata(request, file, migration.objectKey)];
  const manifest: CatalogManifest = {
    sourceFolderId: SOURCE_FOLDER_ID,
    total: SOURCE_FILES.length,
    complete: tracks.length >= SOURCE_FILES.length,
    updatedAt: Date.now(),
    tracks,
  };
  await saveManifest(manifest);
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
  const url = new URL(request.url);
  const audioKey = url.searchParams.get("audio");
  if (audioKey) return audioResponse(request, audioKey);
  const manifest = await readManifest();
  if (url.searchParams.get("migration") === "1") {
    if (!migrationAuthorized(request)) return json({ error: "Unauthorized" }, 401);
    const file = SOURCE_FILES.find((item) => item.id === manifest?.migration?.fileId);
    return json({ ...publicManifest(manifest, request.url), migration: manifest?.migration ?? null, file });
  }
  return json(publicManifest(manifest, request.url));
}

export async function HEAD(request: Request) {
  const audioKey = new URL(request.url).searchParams.get("audio");
  if (!audioKey) return new Response(null, { status: 204 });
  return audioResponse(request, audioKey, true);
}

export async function POST(request: Request) {
  if (!migrationAuthorized(request)) return json({ error: "Unauthorized" }, 401);
  const lockOwner = await acquireMigrationLock();
  if (!lockOwner) return json({ error: "Thư viện đang được lưu bởi một tiến trình khác.", retry: true }, 409);
  try {
    return await initializeNext(request);
  } finally {
    await releaseMigrationLock(lockOwner);
  }
}

export async function PUT(request: Request) {
  if (!migrationAuthorized(request)) return json({ error: "Unauthorized" }, 401);
  const lockOwner = await acquireMigrationLock();
  if (!lockOwner) return json({ error: "Catalog migration is busy.", retry: true }, 409);
  try {
    return await uploadMigrationPart(request);
  } finally {
    await releaseMigrationLock(lockOwner);
  }
}
