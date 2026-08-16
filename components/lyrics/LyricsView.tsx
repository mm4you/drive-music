import React, { useCallback, useEffect, useRef, useState } from "react";
import type { TrackLyrics } from "@/data/lyrics/types";
import { SyncedLyrics } from "./SyncedLyrics";
import { StaticLyrics } from "./StaticLyrics";

type LyricsViewProps = {
  trackLyrics: TrackLyrics | null;
  trackTitle?: string;
  trackArtist?: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  onClose?: () => void;
  isCompact?: boolean;
};

export const LyricsView = React.memo(function LyricsView({
  trackLyrics,
  trackTitle,
  trackArtist,
  currentTime,
  onSeek,
  onClose,
  isCompact = false,
}: LyricsViewProps) {
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle user manual scroll with 3.5s debounce before resuming auto-scroll
  const handleUserInteraction = useCallback(() => {
    setIsUserScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
      scrollTimeoutRef.current = null;
    }, 3500);
  }, []);

  // Reset scroll and user scroll state on track change
  useEffect(() => {
    setIsUserScrolling(false);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [trackLyrics?.trackId]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const hasSynced = Boolean(trackLyrics?.syncedLyrics && trackLyrics.syncedLyrics.length > 0);
  const hasStatic = Boolean(trackLyrics?.lyrics && trackLyrics.lyrics.length > 0);

  return (
    <section
      aria-label="Lời bài hát"
      className={`lyrics-view-panel ${isCompact ? "compact-mode" : "full-mode"}`}
      ref={containerRef}
      onWheel={handleUserInteraction}
      onTouchMove={handleUserInteraction}
      onPointerDown={handleUserInteraction}
    >
      <div className="lyrics-view-header">
        <div className="lyrics-track-info">
          <span className="eyebrow">LỜI BÀI HÁT</span>
          <h3>{trackTitle || trackLyrics?.title || "HVL 30"}</h3>
          {trackArtist && <p className="lyrics-artist">{trackArtist}</p>}
        </div>
        {onClose && (
          <button
            type="button"
            className="lyrics-close-btn"
            onClick={onClose}
            aria-label="Đóng lời bài hát"
          >
            <svg
              aria-hidden="true"
              fill="none"
              height="18"
              viewBox="0 0 24 24"
              width="18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      <div className="lyrics-view-body">
        {hasSynced && trackLyrics?.syncedLyrics ? (
          <SyncedLyrics
            syncedLyrics={trackLyrics.syncedLyrics}
            currentTime={currentTime}
            isUserScrolling={isUserScrolling}
            onSeek={onSeek}
          />
        ) : hasStatic && trackLyrics?.lyrics ? (
          <StaticLyrics lyrics={trackLyrics.lyrics} />
        ) : (
          <div className="no-lyrics-state">
            <p>Không có lyrics cho bài này</p>
          </div>
        )}
      </div>

      {isUserScrolling && hasSynced && (
        <div className="lyrics-scroll-resume-hint" aria-live="polite">
          <button
            type="button"
            onClick={() => setIsUserScrolling(false)}
            aria-label="Quay lại dòng đang phát"
          >
            <span>Đang tạm dừng cuộn · Chạm để tiếp tục</span>
          </button>
        </div>
      )}
    </section>
  );
});
