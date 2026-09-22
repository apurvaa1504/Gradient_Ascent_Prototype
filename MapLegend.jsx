import { SURFACE_VARIABLES } from "../api/oceanData";

export default function MapLegend({ variableId, layerMeta }) {
  const variable = SURFACE_VARIABLES.find((v) => v.id === variableId);
  if (!variable || !layerMeta) return null;

  return (
    <div className="map-legend glass-panel">
      <div className="legend-title">{variable.label}</div>
      <div className="legend-gradient-bar" />
      <div className="legend-range-row">
        <span>{layerMeta.min}{variable.unit}</span>
        <span>{layerMeta.max}{variable.unit}</span>
      </div>
    </div>
  );
}
