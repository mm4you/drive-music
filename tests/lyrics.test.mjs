import assert from "node:assert/strict";
import test from "node:test";
import { getLyricsForTrack, lyricsByTrackId } from "../data/lyrics/index.ts";

test("Track 01 (Intro) explicitly has no lyrics", () => {
  assert.equal(getLyricsForTrack("track-01"), null);
  assert.equal(getLyricsForTrack("18B7wTjbf6YmeeLtzJNv2Etoqq5dyn6R5"), null);
  assert.equal(getLyricsForTrack({ id: "track-01", title: "01. Elegie" }), null);
  assert.equal(getLyricsForTrack({ id: "18B7wTjbf6YmeeLtzJNv2Etoqq5dyn6R5", title: "Elegie" }), null);
});

test("Track 02 through Track 30 all have lyrics mapped", () => {
  for (let i = 2; i <= 30; i++) {
    const num = String(i).padStart(2, "0");
    const trackId = `track-${num}`;
    const lyrics = getLyricsForTrack(trackId);
    assert.ok(lyrics, `Track ${num} must have lyrics`);
    assert.ok(lyrics.lyrics && lyrics.lyrics.length > 0, `Track ${num} lyrics array must not be empty`);
    assert.ok(lyrics.title, `Track ${num} must have a title`);
  }
});

test("Resolves lyrics by Google Drive source file IDs", () => {
  const sampleDriveIds = [
    "1d6KPv_a2awhVvmimI_uLM-WtZEX1CI-Z", // Track 02 IDK
    "1K6Wj-NtZqLLSMD8GxCYIjeGDfzVhsP31", // Track 03 Wtf Bby I'm Lit
    "1lGApI1rGNDZbbch5tvvmZ0hKVrmBlP5l", // Track 04 Anh Khong Muon No De Dang
    "1MWwN6KZ9cA1JQRWFvYwxJpQxnjSDjvyc", // Track 30 Thit Lon
  ];

  sampleDriveIds.forEach((driveId) => {
    const lyrics = getLyricsForTrack(driveId);
    assert.ok(lyrics, `Drive ID ${driveId} should resolve lyrics`);
  });
});

test("Resolves lyrics by track objects with title or URL", () => {
  const trackObj = {
    id: "random-uuid-123",
    title: "02. IDK",
    artist: "RPT MCK",
    originalUrl: "https://drive.music.yo-nathanzarate376.chatgpt.site/api/catalog?audio=audio%2F1d6KPv_a2awhVvmimI_uLM-WtZEX1CI-Z.flac",
  };

  const lyrics = getLyricsForTrack(trackObj);
  assert.ok(lyrics, "Should resolve by originalUrl containing Drive ID");
  assert.equal(lyrics.title, "IDK");
});

test("Lyrics do not contain recommendation artifacts like 'You might also like'", () => {
  Object.values(lyricsByTrackId).forEach((trackLyrics) => {
    if (trackLyrics.lyrics) {
      trackLyrics.lyrics.forEach((line) => {
        assert.doesNotMatch(line, /You might also like/i, `Found recommendation artifact in ${trackLyrics.title}`);
      });
    }
  });
});
