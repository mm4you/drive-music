import React from "react";

type StaticLyricsProps = {
  lyrics: string[];
};

export const StaticLyrics = React.memo(function StaticLyrics({ lyrics }: StaticLyricsProps) {
  return (
    <div className="static-lyrics-container">
      <div className="static-lyrics-list">
        {lyrics.map((line, index) => {
          const trimmed = line.trim();
          const isSectionHeader = trimmed.startsWith("[") && trimmed.endsWith("]");
          const isEmpty = trimmed === "";

          if (isEmpty) {
            return <div key={`spacer-${index}`} aria-hidden="true" className="lyric-line-spacer" />;
          }

          if (isSectionHeader) {
            return (
              <div key={`header-${index}`} aria-hidden="true" className="lyric-section-header">
                <span>{trimmed.slice(1, -1)}</span>
              </div>
            );
          }

          return (
            <p key={`line-${index}`} className="static-lyric-line">
              {line}
            </p>
          );
        })}
      </div>
    </div>
  );
});
