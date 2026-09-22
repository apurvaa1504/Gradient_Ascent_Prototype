import { useEffect, useState } from "react";
import ProfileChart from "./ProfileChart";
import { fetchScorecard } from "../api/oceanData";

export default function RightDrawer({ coord, profile, isLoading, onClose }) {
  const [tab, setTab] = useState("profile");
  const [scorecard, setScorecard] = useState([]);

  useEffect(() => {
    if (tab === "scorecard" && scorecard.length === 0) {
      fetchScorecard().then(setScorecard);
    }
  }, [tab, scorecard.length]);

  return (
    <div className="right-drawer glass-panel">
      <div className="drawer-header">
        <div>
          <div className="drawer-title">Point Intelligence</div>
          <div className="drawer-subtitle">Model output at the selected location</div>
        </div>
        <button className="drawer-close" onClick={onClose}>✕</button>
      </div>

      <div className="tab-row">
        <button className={`tab-btn ${tab === "profile" ? "active" : ""}`} onClick={() => setTab("profile")}>
          Profile T(z)
        </button>
        <button className={`tab-btn ${tab === "scorecard" ? "active" : ""}`} onClick={() => setTab("scorecard")}>
          Scorecard
        </button>
      </div>

      <div className="drawer-body">
        {tab === "profile" && (
          <>
            <div className="coord-readout">
              {coord.lat.toFixed(2)}°N, {coord.lon.toFixed(2)}°E
            </div>

            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">Mixed Layer Depth</div>
                <div className="stat-value">
                  {isLoading || !profile ? "—" : profile.mld_m}
                  <span className="stat-unit">m</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">26°C Isotherm</div>
                <div className="stat-value">
                  {isLoading || !profile || profile.isotherm26_m === null
                    ? "—"
                    : profile.isotherm26_m}
                  <span className="stat-unit">m</span>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="chart-wrap">
                <div className="empty-state">Reconstructing profile…</div>
              </div>
            ) : (
              <ProfileChart profile={profile} />
            )}
          </>
        )}

        {tab === "scorecard" && (
          <div className="panel-block">
            <div className="panel-block-title">VALIDATION AGAINST INDEPENDENT ARGO</div>
            <table className="score-table">
              <thead>
                <tr>
                  <th>Depth</th>
                  <th>Corr.</th>
                  <th>RMSE</th>
                  <th>Bias</th>
                </tr>
              </thead>
              <tbody>
                {scorecard.map((row) => (
                  <tr key={row.depth_m}>
                    <td>{row.depth_m}m</td>
                    <td>{row.correlation.toFixed(2)}</td>
                    <td>{row.rmse.toFixed(2)}</td>
                    <td>{row.bias.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
