import { STANDARD_DEPTHS, SURFACE_VARIABLES } from "../api/oceanData";

export default function LeftDrawer({
  activeVariable,
  onVariableChange,
  depthIndex,
  onDepthIndexChange,
  onClose,
}) {
  const depthM = STANDARD_DEPTHS[depthIndex];

  return (
    <div className="left-drawer glass-panel">
      <div className="drawer-header">
        <div>
          <div className="drawer-title">Layers</div>
          <div className="drawer-subtitle">Surface observations & reconstructed field</div>
        </div>
        <button className="drawer-close" onClick={onClose}>✕</button>
      </div>

      <div className="drawer-body">
        <div className="panel-block">
          <div className="panel-block-title">RECONSTRUCTED DEPTH LAYER</div>

          <div className="depth-value-row">
            <div>
              <span className="depth-value">{depthM} m</span>
            </div>
            <span className="depth-value-sub">
              Layer {depthIndex + 1}/{STANDARD_DEPTHS.length}
            </span>
          </div>

          <input
            type="range"
            className="depth-slider"
            min={0}
            max={STANDARD_DEPTHS.length - 1}
            value={depthIndex}
            onChange={(e) => onDepthIndexChange(Number(e.target.value))}
          />

          <div className="depth-pill-row">
            {[0, 5, 10, 12].map((idx) => (
              <button
                key={idx}
                className={`depth-pill ${idx === depthIndex ? "active" : ""}`}
                onClick={() => onDepthIndexChange(idx)}
              >
                {STANDARD_DEPTHS[idx]}m
              </button>
            ))}
          </div>
        </div>

        <div className="panel-block">
          <div className="panel-block-title">MAP VARIABLE</div>
          {SURFACE_VARIABLES.map((v) => (
            <div
              key={v.id}
              className={`variable-row ${activeVariable === v.id ? "active" : ""}`}
              onClick={() => onVariableChange(v.id)}
            >
              <div>
                <div className="variable-row-label">{v.label}</div>
                <div className="variable-row-meta">{v.source}</div>
              </div>
              <span className="variable-row-badge">{v.unit}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
