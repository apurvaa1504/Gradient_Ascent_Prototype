import { useEffect, useRef, useState } from "react";

const TOTAL_DAYS = 10;

export default function TimelineBar({ dayIndex, onDayChange }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        onDayChange((d) => (d + 1) % TOTAL_DAYS);
      }, 1200);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  return (
    <div className="timeline-bar glass-panel">
      <div className="timeline-controls">
        <button className="timeline-btn" onClick={() => onDayChange(0)}>⏮</button>
        <button className="timeline-btn primary" onClick={() => setIsPlaying((p) => !p)}>
          {isPlaying ? "⏸" : "▶"}
        </button>
      </div>

      <div className="timeline-track">
        <div className="timeline-label-row">
          <span>Day {dayIndex + 1} / {TOTAL_DAYS}</span>
          <span>North Indian Ocean · Daily Reconstruction</span>
        </div>
        <input
          type="range"
          className="timeline-slider"
          min={0}
          max={TOTAL_DAYS - 1}
          value={dayIndex}
          onChange={(e) => onDayChange(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
