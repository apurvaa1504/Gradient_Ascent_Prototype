import { useMemo, useState } from "react";
import {
  BarChart3,
  Check,
  ChevronDown,
  Clipboard,
  Download,
  FileText,
  Info,
  MapPin,
  Radio,
  ShieldCheck,
  Thermometer,
  X,
  Zap,
} from "lucide-react";
import { tchpMockData, regionOptions } from "./tchpMockData";
import {
  calculateTchp,
  calculateTemperatureDefinedLayerDepth,
  calculateThermoclineDepth,
  classifyTchp,
  findIsothermDepth,
} from "./tchpPhysics";
import "./tchp.css";
import "./tchpInteractions.css";
import GlobalHeader from "./features/otec/components/GlobalHeader.jsx";
import TchpMap from "./TchpMap.jsx";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const layerOptions = [
  "TCHP",
  "D26 depth",
  "SST anomaly",
  "100m anomaly",
  "Confidence",
  "Currents",
  "Cyclone corridor",
];

function makeProfile(region, point) {
  if (!point) return region.profile;
  const lon = 45 + point.x * 0.6;
  const lat = 30 - point.y * (25 / 70);
  const heatIndex = point.x * 0.72 + (70 - point.y) * 0.28;
  const tchp = Math.round(clamp(12 + heatIndex * 0.9, 12, 105));
  const d26 = Math.round(clamp(35 + tchp * 1.05, 35, 180));
  const d20 = Math.round(clamp(150 + tchp * 1.5, 150, 350));
  return {
    ...region.profile,
    location: `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`,
    tchp,
    d26,
    d20,
    confidence: Math.round(
      clamp(region.profile.confidence - Math.abs(50 - point.x) * 0.12, 55, 95),
    ),
  };
}

function ProfileChart({ profile, onClose }) {
  const x = (temperature) => 45 + (temperature / 32) * 370;
  const y = (depth) => 20 + (depth / 1000) * 190;
  const line = profile.temperature
    .map(
      (temperature, index) =>
        `${index ? "L" : "M"}${x(temperature).toFixed(1)},${y(profile.depths[index]).toFixed(1)}`,
    )
    .join(" ");
  const climate = profile.climatology
    .map(
      (temperature, index) =>
        `${index ? "L" : "M"}${x(temperature).toFixed(1)},${y(profile.depths[index]).toFixed(1)}`,
    )
    .join(" ");
  return (
    <div className="profile-card">
      <div className="section-head">
        <div>
          <span className="eyebrow">SELECTED LOCATION · 24 SEP 2026</span>
          <h3>
            Depth profile <span className="muted">· {profile.location}</span>
          </h3>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close profile"
        >
          <X size={16} />
        </button>
      </div>
      <svg
        viewBox="0 0 520 245"
        className="profile-svg"
        role="img"
        aria-label="Temperature depth profile"
      >
        <rect x="45" y="20" width="370" height="190" fill="#07151f" rx="4" />
        {[0, 100, 200, 500, 1000].map((depth) => (
          <g key={depth}>
            <line
              x1="45"
              x2="415"
              y1={y(depth)}
              y2={y(depth)}
              stroke="#88b5c0"
              strokeOpacity=".12"
            />
            <text
              x="38"
              y={y(depth) + 3}
              textAnchor="end"
              fill="#7895a3"
              fontSize="9"
            >
              {depth}m
            </text>
          </g>
        ))}
        {[10, 20, 30].map((temp) => (
          <text
            key={temp}
            x={x(temp)}
            y="228"
            textAnchor="middle"
            fill="#7895a3"
            fontSize="9"
          >
            {temp}°
          </text>
        ))}
        <path
          d={climate}
          fill="none"
          stroke="#738895"
          strokeDasharray="4 3"
          strokeWidth="1.5"
        />
        <path d={line} fill="none" stroke="#55e0d0" strokeWidth="3" />
        {[
          [profile.d26, "D26"],
          [profile.d20, "D20"],
          [profile.thermocline, "THERMOCLINE"],
          [profile.layer, "TEMP LAYER"],
        ].map(([depth, label]) => (
          <g key={label}>
            <line
              x1="45"
              x2="415"
              y1={y(depth)}
              y2={y(depth)}
              stroke="#ffb74b"
              strokeDasharray="3 3"
            />
            <text x="420" y={y(depth) + 3} fill="#ffca75" fontSize="8">
              {label}
            </text>
          </g>
        ))}
        <text x="45" y="14" fill="#a9c6d0" fontSize="9">
          Temperature (°C)
        </text>
        <text x="415" y="242" textAnchor="end" fill="#7895a3" fontSize="9">
          Depth ↓
        </text>
      </svg>
      <div className="metric-strip">
        <span>
          <b>{profile.tchp}</b> kJ/cm² TCHP
        </span>
        <span>
          <b>{profile.d26}m</b> D26
        </span>
        <span>
          <b>{profile.d20}m</b> D20
        </span>
        <span>
          <b>{profile.confidence}%</b> confidence
        </span>
      </div>
    </div>
  );
}

function TrendChart({ region, onNotify }) {
  const values = region.trend.tchp;
  const points = values
    .map((value, index) => `${12 + index * 6.8},${92 - (value / 90) * 70}`)
    .join(" ");
  return (
    <div className="chart-card">
      <div className="section-head">
        <div>
          <span className="eyebrow">14-DAY HISTORY</span>
          <h3>TCHP trend</h3>
        </div>
        <span className="trend-badge">
          ↗ +{region.name === "Bay of Bengal" ? 18 : 11}% baseline
        </span>
      </div>
      <svg
        viewBox="0 0 108 105"
        className="trend-svg"
        role="img"
        aria-label="Fourteen day TCHP trend"
      >
        <line
          x1="10"
          y1="92"
          x2="104"
          y2="92"
          stroke="#61808d"
          strokeOpacity=".3"
        />
        <polyline
          points={points}
          fill="none"
          stroke="#ffb74b"
          strokeWidth="1.8"
        />
        {values.map((value, index) => (
          <circle
            key={index}
            cx={12 + index * 6.8}
            cy={92 - (value / 90) * 70}
            r={index === values.length - 1 ? 2.5 : 1.2}
            fill={index === values.length - 1 ? "#fff4bc" : "#ffb74b"}
          />
        ))}
        <text x="10" y="103" fill="#728b98" fontSize="4">
          11 Sep
        </text>
        <text x="96" y="103" fill="#728b98" fontSize="4">
          24 Sep
        </text>
      </svg>
      <p className="microcopy">
        TCHP increased gradually. This indicates a growing ocean heat reservoir,
        not a deterministic storm forecast.
      </p>
      <button
        className="text-button"
        onClick={() =>
          onNotify(
            `Latest TCHP: ${values.at(-1)} kJ/cm² · D26: ${region.trend.d26.at(-1)} m`,
          )
        }
      >
        Inspect latest trend point
      </button>
    </div>
  );
}

function ExpertData({ profile, region, onNotify }) {
  const rows = profile.depths.map((depth, index) => ({
    depth,
    temperature: profile.temperature[index],
    uncertainty: profile.uncertainty[index],
    climatology: profile.climatology[index],
    difference: profile.temperature[index] - profile.climatology[index],
  }));
  const copyCsv = async () => {
    const csv = [
      "depth,temperature,uncertainty,climatology,difference",
      ...rows.map(
        (row) =>
          `${row.depth},${row.temperature},${row.uncertainty},${row.climatology},${row.difference.toFixed(2)}`,
      ),
    ].join("\n");
    await navigator.clipboard?.writeText(csv);
    onNotify("Profile CSV copied");
  };
  return (
    <section className="expert-grid">
      <div className="expert-card">
        <div className="section-head">
          <div>
            <span className="eyebrow">EXPERT VIEW</span>
            <h2>Surface signals used by OceanEmbed</h2>
          </div>
          <ShieldCheck className="cyan-text" />
        </div>
        {region.inputs.map(([label, value, status]) => (
          <div className="input-row" key={label}>
            <span>{label}</span>
            <b>{value}</b>
            <small>
              <Check size={11} /> {status}
            </small>
          </div>
        ))}
        <div className="confidence-block">
          <b>Confidence breakdown · {profile.confidence}% overall</b>
          {[
            ["SST quality", 92],
            ["SSS quality", 64],
            ["SSH quality", 88],
            ["Current quality", 86],
            ["Wind quality", 91],
            ["Historical support", 81],
            ["Regional support", 74],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <i>
                <em style={{ width: `${value}%` }} />
              </i>
              <small>{value}%</small>
            </div>
          ))}
        </div>
        <p className="microcopy">
          Confidence is not the probability of cyclone intensification. SSS is
          reduced near rainfall and coastal freshwater regions.
        </p>
      </div>
      <div className="expert-card">
        <div className="section-head">
          <div>
            <span className="eyebrow">PROFILE DATA</span>
            <h2>Depth observations</h2>
          </div>
          <button className="ghost-button" onClick={copyCsv}>
            <Clipboard size={13} /> Copy CSV
          </button>
        </div>
        <div className="data-table">
          <div className="data-row data-head">
            <span>Depth</span>
            <span>Temp</span>
            <span>±σ</span>
            <span>Clim.</span>
            <span>Δ</span>
          </div>
          {rows.map((row) => (
            <div className="data-row" key={row.depth}>
              <span>{row.depth}m</span>
              <span>{row.temperature.toFixed(1)}°</span>
              <span>±{row.uncertainty.toFixed(2)}</span>
              <span>{row.climatology.toFixed(1)}°</span>
              <span
                className={row.difference >= 0 ? "cyan-text" : "amber-text"}
              >
                {row.difference >= 0 ? "+" : ""}
                {row.difference.toFixed(1)}°
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function TchpPage() {
  const [regionId, setRegionId] = useState("bayOfBengal");
  const [mode, setMode] = useState("forecaster");
  const [layer, setLayer] = useState("TCHP");
  const [profileOpen, setProfileOpen] = useState(true);
  const [showFormula, setShowFormula] = useState(false);
  const [showMethod, setShowMethod] = useState(false);
  const [showProvenance, setShowProvenance] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [corridorPoint, setCorridorPoint] = useState(2);
  const baseRegion =
    tchpMockData.regions[regionId === "fullDomain" ? "bayOfBengal" : regionId];
  const region = useMemo(
    () =>
      regionId === "fullDomain"
        ? {
            ...baseRegion,
            name: "Full North Indian Ocean",
            summary: {
              title: "North Indian Ocean overview",
              text: "The full domain combines prototype diagnostics from the Arabian Sea and Bay of Bengal. Select a cell to inspect its local profile.",
            },
          }
        : baseRegion,
    [baseRegion, regionId],
  );
  const profile = useMemo(
    () => makeProfile(region, selectedPoint),
    [region, selectedPoint],
  );
  const calculated = useMemo(
    () => calculateTchp(profile.temperature, profile.depths),
    [profile],
  );
  const calculatedD26 = useMemo(
    () => findIsothermDepth(profile.temperature, profile.depths, 26),
    [profile],
  );
  const calculatedD20 = useMemo(
    () => findIsothermDepth(profile.temperature, profile.depths, 20),
    [profile],
  );
  const thermocline = useMemo(
    () => calculateThermoclineDepth(profile.temperature, profile.depths),
    [profile],
  );
  const temperatureLayer = useMemo(
    () =>
      calculateTemperatureDefinedLayerDepth(
        profile.temperature,
        profile.depths,
      ),
    [profile],
  );
  const notify = (text) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const selectRegion = (value) => {
    setRegionId(value);
    setSelectedPoint(null);
    notify(
      `Showing ${value === "fullDomain" ? "Full North Indian Ocean" : tchpMockData.regions[value].name}`,
    );
  };
  const downloadBrief = () => {
    const point = tchpMockData.corridor[corridorPoint];
    const text = `OceanEmbed TCHP demonstration brief\nRegion: ${region.name}\nAnalysis date: 24 September 2026\nSelected profile: ${profile.location}\nTCHP: ${profile.tchp} kJ/cm²\nD26: ${profile.d26} m\nStatus: ${classifyTchp(profile.tchp)}\n\nPrototype only; not an official warning or cyclone-intensity forecast.`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `oceanembed-tchp-${point.label.replaceAll(" ", "-")}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("Demonstration brief downloaded");
  };
  return (
    <main className="tchp-page">
      <GlobalHeader subLabel="OceanEmbed / Ocean Heat / TCHP Intelligence" />
      <div className="tchp-header">
        <div className="header-context">TCHP Intelligence · Ocean Heat</div>
        <div className="header-actions">
          <select
            value={regionId}
            onChange={(event) => selectRegion(event.target.value)}
            aria-label="Select region"
          >
            {regionOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
            <option value="fullDomain">Full North Indian Ocean</option>
          </select>
          <div className="mode-switch">
            <button
              className={mode === "forecaster" ? "active" : ""}
              onClick={() => setMode("forecaster")}
            >
              Forecaster
            </button>
            <button
              className={mode === "expert" ? "active" : ""}
              onClick={() => setMode("expert")}
            >
              Expert
            </button>
          </div>
        </div>
      </div>
      <div className="tchp-shell">
        <section className="hero-strip">
          <div>
            <span className="eyebrow">
              OCEANEMBED TCHP INTELLIGENCE · PROTOTYPE DECISION-SUPPORT LAYER
            </span>
            <h1>
              Where is the warm-water reservoir <i>beneath the surface?</i>
            </h1>
            <p>
              TCHP converts depth-aware temperature profiles into
              cyclone-relevant ocean heat diagnostics for the Arabian Sea and
              Bay of Bengal.
            </p>
          </div>
          {/* <div className="prototype-stamp">
            <Radio size={15} />
            <b>DEMONSTRATION ANALYSIS</b>
            <span>Hardcoded data · 24 Sep 2026 · v1.0</span>
          </div> */}
        </section>
        <section className="caution-line">
          <Info size={15} />
          <span>
            <b>Interpretation note:</b> TCHP is an oceanic support indicator—not
            a deterministic cyclone forecast. Use official atmospheric guidance
            and track forecasts.
          </span>
        </section>
        <section className="kpi-grid">
          {region.kpis.map((kpi) => (
            <article
              className="kpi-card"
              title={
                kpi.label === "TCHP"
                  ? "Integrated upper-ocean heat above the 26°C isotherm."
                  : kpi.label === "D26"
                    ? "Depth of the first downward 26°C crossing."
                    : kpi.label === "Confidence"
                      ? "Estimated reliability from input quality and model uncertainty."
                      : kpi.label
              }
            >
              <span className="kpi-label">
                {kpi.label}
                <Info size={12} />
              </span>
              <strong>
                {kpi.value}
                <small>{kpi.unit}</small>
              </strong>
              <span className="kpi-note">{kpi.note}</span>
              <span className="kpi-trend">↗ {kpi.trend}</span>
            </article>
          ))}
        </section>
        <section className="analysis-grid">
          <div>
            <div className="panel-tabs">
              {layerOptions.map((option) => (
                <button
                  key={option}
                  className={layer === option ? "selected" : ""}
                  onClick={() => {
                    setLayer(option);
                    notify(`${option} layer selected`);
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
            <TchpMap
              region={region}
              layer={layer}
              selectedPoint={selectedPoint}
              onSelect={(point) => {
                setSelectedPoint(point);
                setProfileOpen(true);
              }}
              onNotify={notify}
            />
          </div>
          <aside className="intel-panel">
            <div className="panel-title">
              <span className="signal-icon">
                <Zap size={16} />
              </span>
              <div>
                <span className="eyebrow">SELECTED REGION INTELLIGENCE</span>
                <h2>{region.summary.title}</h2>
              </div>
            </div>
            <p>{region.summary.text}</p>
            <div className="evidence-chips">
              {[
                ["TCHP", `${profile.tchp} kJ/cm²`],
                ["D26", `${profile.d26} m`],
                ["SLA", regionId === "bayOfBengal" ? "+9 cm" : "+6 cm"],
                ["100m ΔT", regionId === "bayOfBengal" ? "+0.9°C" : "+0.5°C"],
                ["CONFIDENCE", `${profile.confidence}%`],
              ].map(([label, value]) => (
                <span key={label}>
                  <small>{label}</small>
                  <b>{value}</b>
                </span>
              ))}
            </div>
            <div className="support-meter">
              <div>
                <span>Oceanic support context</span>
                <b>{classifyTchp(profile.tchp)}</b>
              </div>
              <div className="meter">
                <i style={{ width: `${clamp(profile.tchp, 0, 100)}%` }} />
              </div>
            </div>
            <div className="button-row">
              <button
                className="primary-button"
                onClick={() => setProfileOpen(true)}
              >
                Inspect profile
              </button>
              <button
                className="ghost-button"
                onClick={() =>
                  document
                    .getElementById("corridor")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Open corridor
              </button>
              <button className="ghost-button" onClick={downloadBrief}>
                <Download size={13} />
              </button>
            </div>
            <div className="compact-alerts">
              {region.alerts.map((alert) => (
                <button
                  className="alert-row"
                  key={alert.title}
                  onClick={() => notify(`${alert.title}: ${alert.detail}`)}
                >
                  <span
                    className={
                      alert.level.includes("DATA")
                        ? "alert-dot caution"
                        : "alert-dot"
                    }
                  />
                  <div>
                    <b>{alert.title}</b>
                    <small>{alert.detail}</small>
                  </div>
                  <ChevronDown size={14} />
                </button>
              ))}
            </div>
          </aside>
        </section>
        <section className="lower-grid">
          {profileOpen ? (
            <ProfileChart
              profile={{
                ...profile,
                thermocline: profile.thermocline || thermocline,
              }}
              onClose={() => setProfileOpen(false)}
            />
          ) : (
            <div className="empty-profile">
              <BarChart3 size={28} />
              <h3>Select a location to inspect the profile</h3>
              <button
                className="primary-button"
                onClick={() => setProfileOpen(true)}
              >
                Open selected profile
              </button>
            </div>
          )}
          <TrendChart region={region} onNotify={notify} />
        </section>
        <section className="corridor-panel" id="corridor">
          <div className="section-head">
            <div>
              <span className="eyebrow">DEMONSTRATION TRACK · NIO-07</span>
              <h2>Cyclone corridor analysis</h2>
            </div>
            <span className="prototype-pill">Prototype only</span>
          </div>
          <div className="corridor-layout">
            <div className="corridor-route">
              {tchpMockData.corridor.map((point, index) => (
                <button
                  className="corridor-node"
                  key={point.label}
                  onClick={() => {
                    setCorridorPoint(index);
                    notify(
                      `${point.label}: ${point.tchp} kJ/cm² oceanic support`,
                    );
                  }}
                >
                  <span
                    className={corridorPoint === index ? "node active" : "node"}
                  />
                  <b>{point.label}</b>
                  <small>
                    {point.tchp} kJ/cm² · D26 {point.d26}m
                  </small>
                </button>
              ))}
            </div>
            <div className="corridor-table">
              <div className="table-row table-head">
                <span>Point</span>
                <span>TCHP</span>
                <span>D26</span>
                <span>SST</span>
                <span>Confidence</span>
              </div>
              {tchpMockData.corridor.map((point) => (
                <div className="table-row" key={point.label}>
                  <span>
                    {point.label}
                    <small>
                      {point.lat}°N, {point.lon}°E
                    </small>
                  </span>
                  <span>{point.tchp}</span>
                  <span>{point.d26}m</span>
                  <span>{point.sst}°C</span>
                  <span className="cyan-text">{point.confidence}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="disclaimer">
            This demonstration does not predict cyclone intensity and does not
            replace IMD/RSMC forecasts. It visualizes the oceanic thermal
            environment along a hypothetical track.
          </p>
          <button className="primary-button" onClick={downloadBrief}>
            <FileText size={13} /> Generate corridor brief
          </button>
        </section>
        {mode === "expert" && (
          <>
            <ExpertData profile={profile} region={region} onNotify={notify} />
            <section className="expert-grid">
              <div className="expert-card">
                <div className="section-head">
                  <div>
                    <span className="eyebrow">CALCULATION TRACE</span>
                    <h2>How TCHP is derived</h2>
                  </div>
                  <button
                    className="ghost-button"
                    onClick={() => setShowFormula(!showFormula)}
                  >
                    {showFormula ? "Hide" : "Explain"} calculation
                  </button>
                </div>
                <div className="flow">
                  <span>15-depth profile</span>
                  <b>↓</b>
                  <span>Find 26°C crossing</span>
                  <b>↓</b>
                  <span>Integrate heat</span>
                  <b>↓</b>
                  <span>Return kJ/cm²</span>
                </div>
                {showFormula && (
                  <div className="formula-box">
                    <code>TCHP = ρ × Cp × ∫ max(T(z) − 26, 0) dz</code>
                    <p>
                      ρ = 1025 kg/m³ · Cp = 3985 J/(kg °C) · D26 ={" "}
                      {calculatedD26?.toFixed(1)}m · D20 ={" "}
                      {calculatedD20?.toFixed(1)}m · temperature-defined layer ={" "}
                      {temperatureLayer?.toFixed(1)}m · computed demonstration
                      estimate = {calculated?.toFixed(1)} kJ/cm²
                    </p>
                  </div>
                )}
              </div>
              <div className="expert-card">
                <div className="section-head">
                  <div>
                    <span className="eyebrow">DATA PROVENANCE</span>
                    <h2>Production concept</h2>
                  </div>
                  <button
                    className="ghost-button"
                    onClick={() => setShowProvenance(!showProvenance)}
                  >
                    {showProvenance ? "Hide" : "View"} provenance
                  </button>
                </div>
                {showProvenance && (
                  <div className="provenance">
                    <p>
                      <b>Conceptual inputs:</b> CMEMS OSTIA SST · NASA RSS SMAP
                      SSS · CMEMS DUACS SLA · NASA OSCAR currents · CMEMS
                      blended wind.
                    </p>
                    <p>
                      <b>Model output:</b> OceanEmbed UNetOcean3D · 16-day
                      sequence · 15 depths · 0.25° North Indian Ocean domain.
                    </p>
                    <p>
                      <b>Validation concept:</b> ARGO profiles · INCOIS moorings
                      / RAMA · CTD / XBT where available.
                    </p>
                    {/* <p className="amber-text">
                      Current page uses hardcoded demonstration values; no live
                      data or official warning is represented.
                    </p> */}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
        <section className="method-panel">
          <button
            className="method-toggle"
            onClick={() => setShowMethod(!showMethod)}
          >
            <span>
              <Info size={15} /> Methodology and interpretation
            </span>
            <ChevronDown className={showMethod ? "rotate" : ""} size={16} />
          </button>
          {showMethod && (
            <div className="method-content">
              <div>
                <b>What is TCHP?</b>
                <p>
                  Vertically integrated heat content above the 26°C isotherm.
                </p>
              </div>
              <div>
                <b>Why it matters</b>
                <p>
                  Deep warm water can reduce cyclone-induced surface cooling.
                </p>
              </div>
              <div>
                <b>What it does not mean</b>
                <p>
                  TCHP alone cannot predict cyclone intensity or replace
                  official guidance.
                </p>
              </div>
              <div className="method-flow">
                Surface observations → OceanEmbed reconstruction → D26 → TCHP →
                decision support
              </div>
            </div>
          )}
        </section>
        <footer className="tchp-footer">
          <span>
            <Thermometer size={14} /> OceanEmbed prototype · INCOIS-ready
            concept
          </span>
          {/* <span>
            Hardcoded demonstration data · no official warning · production
            values would come from the inference API.
          </span> */}
          <button onClick={downloadBrief}>
            <Download size={13} /> Brief
          </button>
        </footer>
      </div>
      {notice && (
        <div className="toast">
          <Check size={15} /> {notice}
        </div>
      )}
    </main>
  );
}
