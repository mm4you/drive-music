import assert from "node:assert/strict";
import test from "node:test";

test("renders the Drive Music shell with a visible sign-in action", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, /<title>Drive Music<\/title>/i);
  assert.match(html, /<link[^>]+rel=["']manifest["'][^>]+href=["']\/manifest\.webmanifest["']/i);
  assert.match(html, /content=["']width=device-width, initial-scale=1, viewport-fit=cover["']/i);
  assert.match(html, /class=["']sync-button-label["']>Đăng nhập<\/span>/i);
  assert.match(html, /aria-label=["']Âm lượng["']/i);
  assert.match(html, /class=["']volume-control["']/i);
  assert.match(html, /aria-label=["']Ẩn danh sách phát["']/i);
  assert.doesNotMatch(html, />Danh sách phát<\/span>/i);
  assert.match(html, /aria-label=["']Phát lại bài hiện tại 1 lần["']/i);
  assert.match(html, /<h2>Danh sách phát<\/h2>/i);
  assert.doesNotMatch(html, />THƯ VIỆN</i);
});

test("filters audio files from a public Google Drive folder", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("folder-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const folderId = "1PublicFolderRoot";
  const folderData = [[
    ["1PublicAudioFile", [folderId], "01. Sample.flac", "audio/flac"],
    ["1PublicCoverFile", [folderId], "cover.jpg", "image/jpeg"],
  ]];
  const encoded = JSON.stringify(folderData)
    .replace(/[\s\S]/g, (character) => `\\x${character.charCodeAt(0).toString(16).padStart(2, "0")}`);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === `https://drive.google.com/drive/folders/${folderId}`) {
      return new Response(
        `<html><head><title>Album test - Google Drive</title></head><body><script>window['_DRIVE_ivd'] = '${encoded}';</script></body></html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" } },
      );
    }
    return originalFetch(input, init);
  };

  try {
    const response = await worker.fetch(
      new Request(`http://localhost/api/drive?folder=${folderId}`),
      { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
      { waitUntil() {}, passThroughOnException() {} },
    );
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.folderName, "Album test");
    assert.equal(result.files.length, 1);
    assert.equal(result.files[0].name, "01. Sample.flac");
    assert.equal(result.files[0].mimeType, "audio/flac");
    assert.equal(result.skipped, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("retries one transient Google Drive stream failure", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("stream-retry-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const originalFetch = globalThis.fetch;
  let upstreamAttempts = 0;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("https://drive.usercontent.google.com/download")) {
      upstreamAttempts += 1;
      if (upstreamAttempts === 1) {
        return new Response("Temporary failure", { status: 503, headers: { "Content-Type": "text/plain" } });
      }
      assert.equal(new Headers(init?.headers).get("Range"), "bytes=0-3");
      return new Response(new Uint8Array([102, 76, 97, 67]), {
        status: 206,
        headers: {
          "Accept-Ranges": "bytes",
          "Content-Length": "4",
          "Content-Range": "bytes 0-3/4",
          "Content-Type": "audio/flac",
        },
      });
    }
    return originalFetch(input, init);
  };

  try {
    const response = await worker.fetch(
      new Request("http://localhost/api/drive?id=1TransientAudio", {
        headers: { Range: "bytes=0-3" },
      }),
      { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
      { waitUntil() {}, passThroughOnException() {} },
    );
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("content-type"), "audio/flac");
    assert.equal(upstreamAttempts, 2);
    assert.deepEqual(Array.from(new Uint8Array(await response.arrayBuffer())), [102, 76, 97, 67]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("protects account names behind server-verified admin access", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("admin-auth-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };

  const anonymous = await worker.fetch(
    new Request("http://localhost/api/admin/stats"),
    env,
    ctx,
  );
  assert.equal(anonymous.status, 401);

  const regularUser = await worker.fetch(
    new Request("http://localhost/api/admin/stats", {
      headers: { "oai-authenticated-user-email": "listener@example.com" },
    }),
    env,
    ctx,
  );
  assert.equal(regularUser.status, 403);
});
