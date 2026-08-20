import React, { type CSSProperties } from "react";
import type { SyncedLyricLine } from "@/data/lyrics/types";

type LyricLineProps = {
  line: SyncedLyricLine;
  isActive: boolean;
  isPast: boolean;
  isUpcoming: boolean;
  onSeek: (time: number) => void;
  progress: number;
};

export const LyricLine = React.memo(function LyricLine({
  line,
  isActive,
  isPast,
  isUpcoming,
  onSeek,
  progress,
}: LyricLineProps) {
  const isSectionHeader = line.text.startsWith("[") && line.text.endsWith("]");
  const isEmpty = line.text.trim() === "";

  if (isEmpty) {
    return <div aria-hidden="true" className="lyric-line-spacer" />;
  }

  if (isSectionHeader) {
    return (
      <div aria-hidden="true" className="lyric-section-header">
        <span>{line.text.slice(1, -1)}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`lyric-line ${isActive ? "active" : ""} ${isPast ? "past" : ""} ${isUpcoming ? "upcoming" : ""}`}
      onClick={() => onSeek(line.time)}
      aria-label={`Tua đến ${line.text}`}
      aria-current={isActive ? "true" : undefined}
      style={{ "--lyric-progress": `${progress}%` } as CSSProperties}
    >
      <span className="lyric-line-text">{line.text}</span>
    </button>
  );
});
