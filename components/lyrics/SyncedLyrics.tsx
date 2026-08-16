import React, { useEffect, useMemo, useRef } from "react";
import type { SyncedLyricLine } from "@/data/lyrics/types";
import { LyricLine } from "./LyricLine";

type SyncedLyricsProps = {
  syncedLyrics: SyncedLyricLine[];
  currentTime: number;
  isUserScrolling: boolean;
  onSeek: (time: number) => void;
};

export const SyncedLyrics = React.memo(function SyncedLyrics({
  syncedLyrics,
  currentTime,
  isUserScrolling,
  onSeek,
}: SyncedLyricsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Array<HTMLElement | null>>([]);

  // Calculate active index without heavy loops
  const activeIndex = useMemo(() => {
    let index = -1;
    for (let i = 0; i < syncedLyrics.length; i++) {
      if (syncedLyrics[i].time <= currentTime) {
        index = i;
      } else {
        break;
      }
    }
    return index;
  }, [currentTime, syncedLyrics]);

  // Smooth auto-scroll when active line changes and user is not manually scrolling
  useEffect(() => {
    if (isUserScrolling || activeIndex < 0) return;
    const targetElement = lineRefs.current[activeIndex];
    const container = containerRef.current;
    if (!targetElement || !container) return;

    const containerHeight = container.clientHeight;
    const targetTop = targetElement.offsetTop;
    const targetHeight = targetElement.clientHeight;

    // Center the active line or place it slightly above center
    const desiredScrollTop = targetTop - (containerHeight / 2) + (targetHeight / 2);

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
          const isPast = activeIndex >= 0 && index < activeIndex;
          const isUpcoming = activeIndex < 0 || index > activeIndex;

          return (
            <div
              key={`${index}-${line.time}`}
              ref={(el) => {
                lineRefs.current[index] = el;
              }}
              className="lyric-line-wrapper"
            >
              <LyricLine
                line={line}
                index={index}
                isActive={isActive}
                isPast={isPast}
                isUpcoming={isUpcoming}
                onSeek={onSeek}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});
