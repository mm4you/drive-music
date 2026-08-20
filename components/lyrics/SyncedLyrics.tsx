import React, { useEffect, useMemo, useRef, useState } from "react";
import type { SyncedLyricLine } from "@/data/lyrics/types";
import { LyricLine } from "./LyricLine";

type SyncedLyricsProps = {
  syncedLyrics: SyncedLyricLine[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isUserScrolling: boolean;
  mediaElement?: HTMLAudioElement | null;
  onSeek: (time: number) => void;
};

const FRAME_INTERVAL_MS = 32;

function findActiveLine(lines: SyncedLyricLine[], playbackTime: number): number {
  let low = 0;
  let high = lines.length - 1;
  let active = -1;

  while (low <= high) {
    const middle = (low + high) >> 1;
    if (lines[middle].time <= playbackTime) {
      active = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return active;
}

export const SyncedLyrics = React.memo(function SyncedLyrics({
  syncedLyrics,
  currentTime,
  duration,
  isPlaying,
  isUserScrolling,
  mediaElement,
  onSeek,
}: SyncedLyricsProps) {
  const [playbackTime, setPlaybackTime] = useState(currentTime);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef(currentTime);
  const lineRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
    if (!isPlaying || !mediaElement) setPlaybackTime(currentTime);
  }, [currentTime, isPlaying, mediaElement]);

  useEffect(() => {
    setPlaybackTime(mediaElement?.currentTime || currentTimeRef.current);
  }, [mediaElement, syncedLyrics]);

  useEffect(() => {
    if (!isPlaying || !mediaElement) return;

    let animationFrame = 0;
    let lastFrameAt = 0;
    const update = (frameAt: number) => {
      if (frameAt - lastFrameAt >= FRAME_INTERVAL_MS) {
        const nextTime = Number.isFinite(mediaElement.currentTime)
          ? mediaElement.currentTime
          : currentTimeRef.current;
        setPlaybackTime((previous) => Math.abs(previous - nextTime) >= 0.015 ? nextTime : previous);
        lastFrameAt = frameAt;
      }
      animationFrame = window.requestAnimationFrame(update);
    };

    animationFrame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [isPlaying, mediaElement]);

  const activeIndex = useMemo(
    () => findActiveLine(syncedLyrics, playbackTime),
    [playbackTime, syncedLyrics],
  );

  const activeProgress = useMemo(() => {
    if (activeIndex < 0) return 0;
    const line = syncedLyrics[activeIndex];
    const endTime = line.endTime ?? syncedLyrics[activeIndex + 1]?.time ?? duration;
    const lineDuration = Math.max(0.15, endTime - line.time);
    return Math.min(100, Math.max(0, ((playbackTime - line.time) / lineDuration) * 100));
  }, [activeIndex, duration, playbackTime, syncedLyrics]);

  useEffect(() => {
    if (isUserScrolling || activeIndex < 0) return;
    const targetElement = lineRefs.current[activeIndex];
    const container = containerRef.current;
    if (!targetElement || !container) return;

    const desiredScrollTop =
      targetElement.offsetTop - container.clientHeight * 0.42 + targetElement.clientHeight / 2;

    container.scrollTo({
      top: Math.max(0, desiredScrollTop),
      behavior: "smooth",
    });
  }, [activeIndex, isUserScrolling]);

  return (
    <div className="synced-lyrics-container" ref={containerRef}>
      <div className="synced-lyrics-list" role="feed" aria-label="Lời bài hát đồng bộ">
        {syncedLyrics.map((line, index) => {
          const isActive = index === activeIndex;
          return (
            <div
              className="lyric-line-wrapper"
              key={`${index}-${line.time}`}
              ref={(element) => {
                lineRefs.current[index] = element;
              }}
            >
              <LyricLine
                isActive={isActive}
                isPast={activeIndex >= 0 && index < activeIndex}
                isUpcoming={activeIndex < 0 || index > activeIndex}
                line={line}
                onSeek={onSeek}
                progress={isActive ? activeProgress : index < activeIndex ? 100 : 0}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});
