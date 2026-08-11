import { isAdminUser, roleForUser } from "../../../authz";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { musicLibraries } from "../../../../db/schema";

export const dynamic = "force-dynamic";

function response(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return response({ error: "Sign in required" }, 401);
  if (!isAdminUser(user)) return response({ error: "Admin access required" }, 403);

  const rows = await getDb().select({
    accountName: musicLibraries.accountName,
    payload: musicLibraries.payload,
    updatedAt: musicLibraries.updatedAt,
  }).from(musicLibraries);
  let playlistCount = 0;
  let trackCount = 0;
  let latestSyncAt = 0;
  for (const row of rows) {
    latestSyncAt = Math.max(latestSyncAt, row.updatedAt);
    try {
      const parsed = JSON.parse(row.payload) as { playlists?: Array<{ tracks?: unknown[] }> };
      if (!Array.isArray(parsed.playlists)) continue;
      playlistCount += parsed.playlists.length;
      trackCount += parsed.playlists.reduce((total, playlist) => total + (Array.isArray(playlist.tracks) ? playlist.tracks.length : 0), 0);
    } catch {
      // Invalid rows are ignored instead of exposing their stored contents.
    }
  }

  return response({
    user: { displayName: user.displayName, email: user.email, role: roleForUser(user) },
    stats: {
      accountCount: rows.length,
      playlistCount,
      trackCount,
      latestSyncAt: latestSyncAt || null,
      accounts: [...rows]
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .map((row) => ({ name: row.accountName })),
    },
  });
}
