export default function TopHud({ basinName, coord, isOnline }) {
  return (
    <div className="top-hud glass-panel">
      <div className="hud-brand">
        <span className="pulse-dot" />
        <div>
          <div className="hud-title">Subsurface Ocean Twin</div>
          <div className="hud-sub">North Indian Ocean · 0.25° Reconstruction</div>
        </div>
      </div>

      <div className="hud-chip">
        <span>{basinName}</span>
        <span style={{ color: "var(--text-muted)" }}>/</span>
        <span className="coord">
          {coord.lat.toFixed(2)}°N, {coord.lon.toFixed(2)}°E
        </span>
      </div>

      <span className={`status-pill ${isOnline ? "online" : ""}`}>
        {isOnline ? "MODEL ONLINE" : "MOCK DATA"}
      </span>
    </div>
  );
}
