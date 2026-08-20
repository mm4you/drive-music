export * from "./types";

import { track02Lyrics } from "./track-02";
import { track03Lyrics } from "./track-03";
import { track04Lyrics } from "./track-04";
import { track05Lyrics } from "./track-05";
import { track06Lyrics } from "./track-06";
import { track07Lyrics } from "./track-07";
import { track08Lyrics } from "./track-08";
import { track09Lyrics } from "./track-09";
import { track10Lyrics } from "./track-10";
import { track11Lyrics } from "./track-11";
import { track12Lyrics } from "./track-12";
import { track13Lyrics } from "./track-13";
import { track14Lyrics } from "./track-14";
import { track15Lyrics } from "./track-15";
import { track16Lyrics } from "./track-16";
import { track17Lyrics } from "./track-17";
import { track18Lyrics } from "./track-18";
import { track19Lyrics } from "./track-19";
import { track20Lyrics } from "./track-20";
import { track21Lyrics } from "./track-21";
import { track22Lyrics } from "./track-22";
import { track23Lyrics } from "./track-23";
import { track24Lyrics } from "./track-24";
import { track25Lyrics } from "./track-25";
import { track26Lyrics } from "./track-26";
import { track27Lyrics } from "./track-27";
import { track28Lyrics } from "./track-28";
import { track29Lyrics } from "./track-29";
import { track30Lyrics } from "./track-30";
import type { TrackLyrics } from "./types";
import { estimatedSyncTrackIds, syncedLyricsByTrackId } from "./synced";
import { parseLrc } from "./types";

export const lyricsByTrackId: Record<string, TrackLyrics> = {
  // Stable track IDs
  "track-02": track02Lyrics,
  "track-03": track03Lyrics,
  "track-04": track04Lyrics,
  "track-05": track05Lyrics,
  "track-06": track06Lyrics,
  "track-07": track07Lyrics,
  "track-08": track08Lyrics,
  "track-09": track09Lyrics,
  "track-10": track10Lyrics,
  "track-11": track11Lyrics,
  "track-12": track12Lyrics,
  "track-13": track13Lyrics,
  "track-14": track14Lyrics,
  "track-15": track15Lyrics,
  "track-16": track16Lyrics,
  "track-17": track17Lyrics,
  "track-18": track18Lyrics,
  "track-19": track19Lyrics,
  "track-20": track20Lyrics,
  "track-21": track21Lyrics,
  "track-22": track22Lyrics,
  "track-23": track23Lyrics,
  "track-24": track24Lyrics,
  "track-25": track25Lyrics,
  "track-26": track26Lyrics,
  "track-27": track27Lyrics,
  "track-28": track28Lyrics,
  "track-29": track29Lyrics,
  "track-30": track30Lyrics,

  // Shared catalog / Google Drive file IDs
  "1d6KPv_a2awhVvmimI_uLM-WtZEX1CI-Z": track02Lyrics,
  "1K6Wj-NtZqLLSMD8GxCYIjeGDfzVhsP31": track03Lyrics,
  "1lGApI1rGNDZbbch5tvvmZ0hKVrmBlP5l": track04Lyrics,
  "1oaj87i7fiEEeEmCFvmnc-K3r90CoUZHL": track05Lyrics,
  "1X1Y1kxT55Sv2hvj5-pIzdNh2knFmJCZD": track06Lyrics,
  "1kWv8qY3tK1srcd6gDVNBT0_Y4Yf8fOvx": track07Lyrics,
  "1O70xU-CPQcRhbV7nTAdG68F9MbRquO36": track08Lyrics,
  "1O5x3tCwRsyqY5BLUhI0CFDQZQaVsfIp_": track09Lyrics,
  "1sgaZKgGysGebYWvIGCGT2G6F7Qf0671u": track10Lyrics,
  "1JeACb1D5FBiB3ROInjWEQDy9Vd62rzd5": track11Lyrics,
  "1lc6W3Go9ybXLGhYNGAFN-_ob64MflVVL": track12Lyrics,
  "13tdU4ChHgkDSkjHV87aqLZyPKIeWiun-": track13Lyrics,
  "1KM8BG-8dAm4Q30bJ52UR5UwfDQ5si_bJ": track14Lyrics,
  "1p098x-nFu79GWTAvA5Z59fjHDY2CDH-X": track15Lyrics,
  "1T-XKDC9j9OTzMnVJlTGlZ3XEiOxubMCy": track16Lyrics,
  "1_purQHSHrB_2VikgoxlM1jHMheAqsvN0": track17Lyrics,
  "1dFbzyQF-cbNIsahJFGxoBQUA-Wqkn7u6": track18Lyrics,
  "178thNTHBYs4NoQr6dwiIqmRlTuK2RM1e": track19Lyrics,
  "1m6d-S7RSbse4Er3ZF_vZMLmEUBLAxWhL": track20Lyrics,
  "1TcFn90c3uEtL-UAf1xkJylKdXqkcnnbz": track21Lyrics,
  "1j61Mco96veNwJz1JypcLJYnd3ImgJ0ik": track22Lyrics,
  "1XUqfhsR1yCkRQCNUkFjUmzizKbukBNaP": track23Lyrics,
  "1JPJzJBENfPILgEZqP2pMYeNni1VQPQIR": track24Lyrics,
  "1LGDP3qTNk3mBEUKXsEqY9SExQsxSHvH7": track25Lyrics,
  "155WGcZ7AzD4TavEjvXV8vyux9-ITDhWW": track26Lyrics,
  "1Kv_Z--xAUHlzX0Ui_eMPCrPuq2lZtRP7": track27Lyrics,
  "1rYnKEYchuOill5A4wElid3zZY-UI1yEw": track28Lyrics,
  "1T9z5rVG6KB2gF44MGDWeLLUOddM45tVd": track29Lyrics,
  "1MWwN6KZ9cA1JQRWFvYwxJpQxnjSDjvyc": track30Lyrics,
};

const titleNormalizationMap: Record<string, TrackLyrics> = {
  "idk": track02Lyrics,
  "wtf bby i'm lit": track03Lyrics,
  "wtf bby i’m lit": track03Lyrics,
  "anh không muốn nó dễ dàng": track04Lyrics,
  "baby": track05Lyrics,
  "yêu anh giết anh": track06Lyrics,
  "mắt môi tay chân": track07Lyrics,
  "đao của anh vừa": track08Lyrics,
  "là gì của nhau": track09Lyrics,
  "night in prague": track10Lyrics,
  "một cái ôm": track11Lyrics,
  "liệm": track12Lyrics,
  "nếu như ta chẳng còn": track13Lyrics,
  "ai mới là kẻ xấu xa": track14Lyrics,
  "slippery": track15Lyrics,
  "intenpol": track16Lyrics,
  "tây thi": track17Lyrics,
  "hút và hút": track18Lyrics,
  "dưa chua": track19Lyrics,
  "xa xôi": track20Lyrics,
  "che phủ": track21Lyrics,
  "oanh m = thuoc": track22Lyrics,
  "ghet xog lai thik": track23Lyrics,
  "nhìn kẻ thù của tao": track24Lyrics,
  "envy": track25Lyrics,
  "cảm ơn": track26Lyrics,
  "không cần lo cho tao": track27Lyrics,
  "huh": track28Lyrics,
  "nguyễn văn mười": track29Lyrics,
  "thịt lợn": track30Lyrics,
};

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^\d{1,2}[.\s_-]+/, "")
    .replace(/\(feat\.[^)]+\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Get lyrics for a track by ID or track object.
 * Track 01 (Intro) explicitly returns null.
 */
export function getLyricsForTrack(
  trackOrId: string | { id?: string; title?: string; originalUrl?: string } | null | undefined
): TrackLyrics | null {
  if (!trackOrId) return null;

  let result: TrackLyrics | null = null;

  if (typeof trackOrId === "string") {
    const id = trackOrId.trim();
    if (id === "track-01" || id === "18B7wTjbf6YmeeLtzJNv2Etoqq5dyn6R5") return null;
    if (lyricsByTrackId[id]) {
      result = lyricsByTrackId[id];
    } else {
      const normalized = normalizeTitle(id);
      if (titleNormalizationMap[normalized]) result = titleNormalizationMap[normalized];
    }
  } else {
    const { id, title, originalUrl } = trackOrId;

    // Track 01 Intro exclusion
    if (id === "track-01" || id === "18B7wTjbf6YmeeLtzJNv2Etoqq5dyn6R5") return null;
    if (title && normalizeTitle(title) === "elegie") return null;

    if (id && lyricsByTrackId[id]) {
      result = lyricsByTrackId[id];
    } else if (originalUrl) {
      for (const [key, lyrics] of Object.entries(lyricsByTrackId)) {
        if (originalUrl.includes(key)) {
          result = lyrics;
          break;
        }
      }
    }

    if (!result && title) {
      const normalized = normalizeTitle(title);
      if (titleNormalizationMap[normalized]) result = titleNormalizationMap[normalized];
    }
  }

  if (result) {
    const lrc = syncedLyricsByTrackId[result.trackId] || result.lrc;
    if (lrc) {
      return {
        ...result,
        lrc,
        syncedLyrics: parseLrc(lrc),
        syncQuality: estimatedSyncTrackIds.has(result.trackId) ? "estimated" : "timed",
      };
    }
  }

  return result;
}
