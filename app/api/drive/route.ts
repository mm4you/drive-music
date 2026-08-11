const DRIVE_FILE_ID = /^[A-Za-z0-9_-]{10,200}$/;
const DRIVE_FOLDER_TYPE = "application/vnd.google-apps.folder";
const MAX_FOLDER_FILES = 200;
const MAX_FOLDER_DEPTH = 5;
const MAX_FOLDER_PAGE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_AUDIO_EXTENSION = /\.(?:mp3|flac|m4a|aac|ogg|oga|opus|wav)$/i;

type DriveFolderChild = {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
};

type DriveFolderFile = DriveFolderChild & {
  path: string;
};

class DriveFolderError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

type AudioTags = {
  title?: string;
  artist?: string;
  album?: string;
};

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function decodeJavaScriptString(value: string) {
  let decoded = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character !== "\\") {
      decoded += character;
      continue;
    }

    const escaped = value[index + 1];
    if (escaped === undefined) break;
    index += 1;
    if (escaped === "n") decoded += "\n";
    else if (escaped === "r") decoded += "\r";
    else if (escaped === "t") decoded += "\t";
    else if (escaped === "b") decoded += "\b";
    else if (escaped === "f") decoded += "\f";
    else if (escaped === "v") decoded += "\v";
    else if (escaped === "0") decoded += "\0";
    else if (escaped === "x" && /^[0-9a-f]{2}$/i.test(value.slice(index + 1, index + 3))) {
      decoded += String.fromCharCode(Number.parseInt(value.slice(index + 1, index + 3), 16));
      index += 2;
    } else if (escaped === "u" && /^[0-9a-f]{4}$/i.test(value.slice(index + 1, index + 5))) {
      decoded += String.fromCharCode(Number.parseInt(value.slice(index + 1, index + 5), 16));
      index += 4;
    } else if (escaped !== "\n" && escaped !== "\r") {
      decoded += escaped;
    }
  }
  return decoded;
}

function embeddedDriveFolderData(html: string) {
  const marker = Math.max(
    html.indexOf("window['_DRIVE_ivd']"),
    html.indexOf('window["_DRIVE_ivd"]'),
  );
  if (marker < 0) return null;
  const assignment = html.indexOf("=", marker);
  if (assignment < 0) return null;
  const quote = html.indexOf("'", assignment);
  if (quote < 0) return null;

  let encoded = "";
  for (let index = quote + 1; index < html.length; index += 1) {
    const character = html[index];
    if (character === "\\" && index + 1 < html.length) {
      encoded += character + html[index + 1];
      index += 1;
      continue;
    }
    if (character === "'") return encoded;
    encoded += character;
  }
  return null;
}

function folderNameFromHtml(html: string) {
  const rawTitle = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "Thư mục Google Drive";
  return decodeHtml(rawTitle).replace(/\s+-\s+Google Drive\s*$/i, "").trim() || "Thư mục Google Drive";
}

function parseDriveFolderPage(html: string) {
  const encoded = embeddedDriveFolderData(html);
  if (!encoded) {
    throw new DriveFolderError(
      "Không đọc được thư mục. Hãy đặt quyền Google Drive thành Bất kỳ ai có liên kết.",
      403,
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(decodeJavaScriptString(encoded));
  } catch {
    throw new DriveFolderError("Google Drive trả về danh sách thư mục không hợp lệ.");
  }
  const root = Array.isArray(raw) ? raw : [];
  const entries = Array.isArray(root[0]) ? root[0] : [];
  const children: DriveFolderChild[] = [];
  for (const entry of entries) {
    if (!Array.isArray(entry)) continue;
    const id = typeof entry[0] === "string" ? entry[0] : "";
    const name = typeof entry[2] === "string" ? entry[2].normalize("NFKC").trim() : "";
    const mimeType = typeof entry[3] === "string" ? entry[3].trim().toLowerCase() : "";
    const size = Number(entry[13] ?? 0);
    if (!DRIVE_FILE_ID.test(id) || !name || !mimeType) continue;
    children.push({
      id,
      name: name.slice(0, 500),
      mimeType: mimeType.slice(0, 200),
      size: Number.isFinite(size) && size > 0 ? size : undefined,
    });
  }
  return { name: folderNameFromHtml(html), children };
}

function isSupportedAudioFile(file: DriveFolderChild) {
  return file.mimeType.startsWith("audio/") || SUPPORTED_AUDIO_EXTENSION.test(file.name);
}

async function fetchPublicFolder(folderId: string) {
  const folderUrl = new URL(`https://drive.google.com/drive/folders/${folderId}`);
  const response = await fetch(folderUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "vi,en-US;q=0.8,en;q=0.7",
      "User-Agent": "Mozilla/5.0 (compatible; DriveMusic/1.0)",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    response.body?.cancel();
    throw new DriveFolderError("Google Drive không cho phép đọc thư mục này.", response.status === 404 ? 404 : 502);
  }
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_FOLDER_PAGE_BYTES) {
    response.body?.cancel();
    throw new DriveFolderError("Thư mục quá lớn để đọc an toàn.", 413);
  }
  const html = await response.text();
  if (html.length > MAX_FOLDER_PAGE_BYTES) throw new DriveFolderError("Thư mục quá lớn để đọc an toàn.", 413);
  return parseDriveFolderPage(html);
}

async function folderListingResponse(folderId: string) {
  const queue: Array<{ id: string; path: string; depth: number }> = [{ id: folderId, path: "", depth: 0 }];
  const visited = new Set<string>();
  const files: DriveFolderFile[] = [];
  let folderName = "Thư mục Google Drive";
  let skipped = 0;
  let inaccessibleFolders = 0;
  let truncated = false;

  while (queue.length && files.length < MAX_FOLDER_FILES) {
    const current = queue.shift();
    if (!current || visited.has(current.id)) continue;
    visited.add(current.id);

    let folder;
    try {
      folder = await fetchPublicFolder(current.id);
    } catch (error) {
      if (current.depth === 0) throw error;
      inaccessibleFolders += 1;
      continue;
    }
    if (current.depth === 0) folderName = folder.name;
    const folderPath = current.path || folder.name;

    for (const child of folder.children) {
      if (child.mimeType === DRIVE_FOLDER_TYPE) {
        if (current.depth < MAX_FOLDER_DEPTH) {
          queue.push({ id: child.id, path: `${folderPath}/${child.name}`, depth: current.depth + 1 });
        } else {
          skipped += 1;
        }
        continue;
      }
      if (!isSupportedAudioFile(child)) {
        skipped += 1;
        continue;
      }
      files.push({ ...child, path: `${folderPath}/${child.name}` });
      if (files.length >= MAX_FOLDER_FILES) {
        truncated = true;
        break;
      }
    }
  }
  if (queue.length) truncated = true;

  return Response.json({
    folderId,
    folderName,
    files,
    skipped,
    inaccessibleFolders,
    truncated,
    limit: MAX_FOLDER_FILES,
  }, {
    headers: {
      "Cache-Control": "private, max-age=120",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function confirmationUrl(html: string, fileId: string) {
  const form = html.match(/<form[^>]+action=["']([^"']+)["'][^>]*>([\s\S]*?)<\/form>/i);
  if (form) {
    const action = decodeHtml(form[1]);
    const url = new URL(action, "https://drive.google.com");
    const inputs = form[2].matchAll(/<input\b[^>]*>/gi);
    for (const input of inputs) {
      const name = input[0].match(/\bname=["']([^"']+)["']/i)?.[1];
      const value = input[0].match(/\bvalue=["']([^"']*)["']/i)?.[1] ?? "";
      if (name) url.searchParams.set(decodeHtml(name), decodeHtml(value));
    }
    if (!url.searchParams.has("id")) url.searchParams.set("id", fileId);
    if (!url.searchParams.has("export")) url.searchParams.set("export", "download");
    return url;
  }

  const link = html.match(/https:\/\/drive\.usercontent\.google\.com\/download\?[^"'<>\s]+/i);
  return link ? new URL(decodeHtml(link[0])) : null;
}

function audioType(contentType: string | null, disposition: string | null) {
  if (contentType && contentType !== "application/octet-stream") return contentType;
  const filename = disposition?.toLowerCase() ?? "";
  if (filename.includes(".flac")) return "audio/flac";
  if (filename.includes(".mp3")) return "audio/mpeg";
  if (filename.includes(".m4a") || filename.includes(".mp4")) return "audio/mp4";
  if (filename.includes(".aac")) return "audio/aac";
  if (filename.includes(".ogg") || filename.includes(".oga")) return "audio/ogg";
  if (filename.includes(".wav")) return "audio/wav";
  return contentType || "application/octet-stream";
}

function fileNameFromDisposition(disposition: string | null) {
  if (!disposition) return null;
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded.replace(/^"|"$/g, ""));
    } catch {
      return encoded;
    }
  }
  return disposition.match(/filename="([^"]+)"/i)?.[1] ?? disposition.match(/filename=([^;]+)/i)?.[1]?.trim() ?? null;
}

function cleanText(value: string) {
  return value.replace(/^\uFEFF/, "").replace(/\0/g, "").trim();
}

function decodeText(bytes: Uint8Array, encoding = 3) {
  if (!bytes.length) return "";
  try {
    if (encoding === 0) return cleanText(new TextDecoder("windows-1252").decode(bytes));
    if (encoding === 1) {
      const bigEndian = bytes[0] === 0xfe && bytes[1] === 0xff;
      return cleanText(new TextDecoder(bigEndian ? "utf-16be" : "utf-16le").decode(bytes));
    }
    if (encoding === 2) return cleanText(new TextDecoder("utf-16be").decode(bytes));
    return cleanText(new TextDecoder().decode(bytes));
  } catch {
    return cleanText(new TextDecoder().decode(bytes));
  }
}

function synchsafe(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] & 0x7f) << 21) | ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) | (bytes[offset + 3] & 0x7f);
}

function parseId3(bytes: Uint8Array): AudioTags {
  if (bytes.length < 10 || String.fromCharCode(...bytes.slice(0, 3)) !== "ID3") return {};
  const version = bytes[3];
  const end = Math.min(bytes.length, 10 + synchsafe(bytes, 6));
  const tags: Record<string, string> = {};
  let offset = 10;
  while (offset + 10 <= end) {
    const id = String.fromCharCode(...bytes.slice(offset, offset + 4));
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const size = version === 4
      ? synchsafe(bytes, offset + 4)
      : ((bytes[offset + 4] << 24) >>> 0) + (bytes[offset + 5] << 16) + (bytes[offset + 6] << 8) + bytes[offset + 7];
    if (size <= 0 || offset + 10 + size > bytes.length) break;
    if (["TIT2", "TPE1", "TALB"].includes(id)) {
      const data = bytes.slice(offset + 10, offset + 10 + size);
      tags[id] = decodeText(data.slice(1), data[0]);
    }
    offset += 10 + size;
  }
  return { title: tags.TIT2, artist: tags.TPE1, album: tags.TALB };
}

function readLittleEndian32(bytes: Uint8Array, offset: number) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function parseFlac(bytes: Uint8Array): AudioTags {
  if (bytes.length < 8 || String.fromCharCode(...bytes.slice(0, 4)) !== "fLaC") return {};
  let offset = 4;
  while (offset + 4 <= bytes.length) {
    const header = bytes[offset];
    const blockType = header & 0x7f;
    const blockLength = (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    const start = offset + 4;
    const end = start + blockLength;
    if (end > bytes.length) break;
    if (blockType === 4 && blockLength >= 8) {
      let cursor = start;
      const vendorLength = readLittleEndian32(bytes, cursor);
      cursor += 4 + vendorLength;
      if (cursor + 4 > end) return {};
      const commentCount = Math.min(readLittleEndian32(bytes, cursor), 500);
      cursor += 4;
      const comments: Record<string, string> = {};
      for (let index = 0; index < commentCount && cursor + 4 <= end; index += 1) {
        const length = readLittleEndian32(bytes, cursor);
        cursor += 4;
        if (cursor + length > end) break;
        const comment = new TextDecoder().decode(bytes.slice(cursor, cursor + length));
        cursor += length;
        const separator = comment.indexOf("=");
        if (separator > 0) comments[comment.slice(0, separator).toUpperCase()] = cleanText(comment.slice(separator + 1));
      }
      return { title: comments.TITLE, artist: comments.ARTIST, album: comments.ALBUM };
    }
    offset = end;
    if (header & 0x80) break;
  }
  return {};
}

function parsedTags(bytes: Uint8Array, contentType: string): AudioTags {
  return contentType.includes("flac") ? parseFlac(bytes) : parseId3(bytes);
}

function tagsFromFileName(filename: string | null): AudioTags {
  if (!filename) return {};
  const base = filename
    .replace(/\.(flac|mp3|m4a|aac|ogg|oga|wav)$/i, "")
    .replace(/^\s*\d{1,3}[.\s_-]+/, "")
    .trim();
  if (!base) return {};
  const parts = base.split(/\s+-\s+/);
  if (parts.length >= 2) {
    const left = parts.shift()?.trim() || "";
    const right = parts.join(" - ").trim();
    const leftWords = left.split(/\s+/).filter(Boolean).length;
    const rightWords = right.split(/\s+/).filter(Boolean).length;
    if (rightWords <= 3 && leftWords >= rightWords + 2) return { title: left, artist: right };
    return { artist: left, title: right };
  }
  return { title: base };
}

function normalizedTag(value?: string) {
  return value?.normalize("NFKC").toLocaleLowerCase().trim() ?? "";
}

function upstreamHeaders(request: Request, cookie?: string | null, rangeOverride?: string) {
  const headers = new Headers({
    Accept: "audio/*,application/octet-stream;q=0.9,*/*;q=0.5",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131 Safari/537.36",
  });
  const range = rangeOverride ?? request.headers.get("range");
  if (range) headers.set("Range", range);
  if (cookie) {
    const cookieHeader = cookie
      .split(/,(?=[^;,]+=)/)
      .map((part) => part.split(";", 1)[0].trim())
      .filter(Boolean)
      .join("; ");
    if (cookieHeader) headers.set("Cookie", cookieHeader);
  }
  return headers;
}

async function fetchDriveAttempt(request: Request, fileId: string, rangeOverride?: string) {
  const direct = new URL("https://drive.usercontent.google.com/download");
  direct.searchParams.set("id", fileId);
  direct.searchParams.set("export", "download");
  direct.searchParams.set("confirm", "t");

  let response = await fetch(direct, {
    headers: upstreamHeaders(request, null, rangeOverride),
    redirect: "follow",
  });

  const firstType = response.headers.get("content-type") ?? "";
  if (firstType.includes("text/html")) {
    const cookie = response.headers.get("set-cookie");
    const html = await response.text();
    const confirmed = confirmationUrl(html, fileId);
    if (confirmed) {
      response = await fetch(confirmed, {
        headers: upstreamHeaders(request, cookie, rangeOverride),
        redirect: "follow",
      });
    }
  }

  return response;
}

async function fetchDriveFile(request: Request, fileId: string, rangeOverride?: string) {
  let response = await fetchDriveAttempt(request, fileId, rangeOverride);
  const contentType = response.headers.get("content-type") ?? "";
  const transientFailure = response.status === 403 || response.status === 408 ||
    response.status === 425 || response.status === 429 || response.status >= 500 ||
    contentType.includes("text/html");
  if (!transientFailure) return response;

  try {
    await response.body?.cancel();
  } catch {
    // A confirmation page may already have consumed the first response body.
  }
  await new Promise((resolve) => setTimeout(resolve, 280));
  response = await fetchDriveAttempt(request, fileId, rangeOverride);
  return response;
}

async function metadataResponse(request: Request, fileId: string) {
  const upstream = await fetchDriveFile(request, fileId, "bytes=0-524287");
  const upstreamType = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || upstreamType.includes("text/html")) {
    upstream.body?.cancel();
    return Response.json({ error: "Unable to read Google Drive metadata" }, { status: 502 });
  }
  const disposition = upstream.headers.get("content-disposition");
  const filename = fileNameFromDisposition(disposition);
  const contentType = audioType(upstreamType, disposition);
  const contentRange = upstream.headers.get("content-range");
  const totalSize = Number(contentRange?.match(/\/(\d+)$/)?.[1] ?? upstream.headers.get("content-length") ?? 0);
  const bytes = new Uint8Array(await upstream.arrayBuffer());
  const tags = parsedTags(bytes, contentType);
  const filenameTags = tagsFromFileName(filename);
  const sourceTags = tags.title && tags.artist && filenameTags.title && filenameTags.artist &&
      normalizedTag(tags.title) === normalizedTag(filenameTags.artist) &&
      normalizedTag(tags.artist) === normalizedTag(filenameTags.title)
    ? filenameTags
    : tags;
  return Response.json({
    title: sourceTags.title || filenameTags.title || null,
    artist: sourceTags.artist || filenameTags.artist || null,
    album: sourceTags.album || tags.album || null,
    filename,
    contentType,
    format: contentType.includes("flac") ? "FLAC" : contentType.includes("mpeg") ? "MP3" : contentType.split("/").pop()?.toUpperCase() || "AUDIO",
    size: Number.isFinite(totalSize) ? totalSize : 0,
  }, { headers: { "Cache-Control": "private, max-age=300" } });
}

function streamedResponse(upstream: Response, headOnly = false) {
  const headers = new Headers();
  const copyHeaders = ["accept-ranges", "content-length", "content-range", "etag", "last-modified"];
  for (const name of copyHeaders) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("Content-Type", audioType(upstream.headers.get("content-type"), upstream.headers.get("content-disposition")));
  headers.set("Content-Disposition", "inline");
  headers.set("Cache-Control", "private, max-age=3600, no-transform");
  headers.set("Vary", "Range");
  headers.set("X-Content-Type-Options", "nosniff");
  if (headOnly) void upstream.body?.cancel();
  return new Response(headOnly ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

async function handle(request: Request, headOnly = false) {
  const url = new URL(request.url);
  const folderId = url.searchParams.get("folder")?.trim() ?? "";
  if (folderId) {
    if (!DRIVE_FILE_ID.test(folderId)) {
      return Response.json({ error: "Invalid Google Drive folder ID" }, { status: 400 });
    }
    if (headOnly) return new Response(null, { status: 204 });
    try {
      return await folderListingResponse(folderId);
    } catch (error) {
      if (error instanceof DriveFolderError) {
        return Response.json({ error: error.message }, { status: error.status });
      }
      return Response.json({ error: "Không thể kết nối tới thư mục Google Drive." }, { status: 502 });
    }
  }
  const fileId = url.searchParams.get("id")?.trim() ?? "";
  if (!DRIVE_FILE_ID.test(fileId)) {
    return Response.json({ error: "Invalid Google Drive file ID" }, { status: 400 });
  }

  try {
    if (url.searchParams.get("metadata") === "1") return metadataResponse(request, fileId);
    const upstream = await fetchDriveFile(request, fileId);
    const contentType = upstream.headers.get("content-type") ?? "";
    if (!upstream.ok || contentType.includes("text/html")) {
      upstream.body?.cancel();
      return Response.json(
        { error: "Google Drive did not return a playable public file" },
        { status: upstream.status >= 400 ? upstream.status : 502 },
      );
    }
    return streamedResponse(upstream, headOnly);
  } catch {
    return Response.json({ error: "Unable to reach Google Drive" }, { status: 502 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function HEAD(request: Request) {
  return handle(request, true);
}
