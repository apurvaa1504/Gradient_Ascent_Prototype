import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

/**
 * Renders temperature (x-axis) against depth (y-axis, inverted so 0m is at
 * the top). Expects `profile` shaped like the fetchTemperatureProfile()
 * return value from src/api/oceanData.js.
 */
export default function ProfileChart({ profile }) {
  if (!profile) {
    return (
      <div className="chart-wrap">
        <div className="empty-state">Click anywhere on the ocean to reconstruct a vertical temperature profile.</div>
      </div>
    );
  }

  const data = profile.depths.map((d, i) => ({
    depth: d,
    temp: profile.temperature[i],
  }));

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} layout="vertical" margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
          <XAxis
            type="number"
            dataKey="temp"
            domain={["dataMin - 1", "dataMax + 1"]}
            stroke="#64748b"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            label={{ value: "°C", position: "insideBottomRight", fill: "#64748b", fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="depth"
            reversed
            stroke="#64748b"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            label={{ value: "Depth (m)", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(6,18,36,0.94)",
              border: "1px solid rgba(0,240,255,0.35)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value) => [`${value} °C`, "Temperature"]}
            labelFormatter={(label) => `${label} m`}
          />
          <Line type="monotone" dataKey="temp" stroke="#00f0ff" strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
