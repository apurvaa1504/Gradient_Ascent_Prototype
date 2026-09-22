import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { fetchArgoFloats } from "../api/oceanData";

// North Indian Ocean bounds from the problem statement
const BOUNDS = { latMin: 5, latMax: 30, lonMin: 45, lonMax: 105 };

const argoIcon = L.divIcon({
  className: "",
  html: '<div class="argo-pin"></div>',
  iconSize: [14, 14],
});

function ClickCatcher({ onPick }) {
  useMapEvents({
    click(e) {
      const lat = Math.round(e.latlng.lat * 100) / 100;
      const lon = Math.round(e.latlng.lng * 100) / 100;
      if (lat >= BOUNDS.latMin && lat <= BOUNDS.latMax && lon >= BOUNDS.lonMin && lon <= BOUNDS.lonMax) {
        onPick(lat, lon);
      }
    },
  });
  return null;
}

export default function MapView({ onPointSelected, selectedCoord }) {
  const [floats, setFloats] = useState([]);

  useEffect(() => {
    fetchArgoFloats().then(setFloats);
  }, []);

  return (
    <div className="map-viewport">
      <MapContainer
        center={[15.5, 75.0]}
        zoom={5}
        minZoom={4}
        maxZoom={11}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="&copy; Esri, Maxar, Earthstar"
        />

        <ClickCatcher onPick={onPointSelected} />

        {selectedCoord && (
          <Marker position={[selectedCoord.lat, selectedCoord.lon]}>
            <Popup>
              {selectedCoord.lat.toFixed(2)}°N, {selectedCoord.lon.toFixed(2)}°E
            </Popup>
          </Marker>
        )}

        {floats.map((f) => (
          <Marker key={f.id} position={[f.lat, f.lon]} icon={argoIcon}>
            <Popup>
              <strong>{f.id}</strong>
              <br />
              Surface temp (obs): {f.tempObs}°C
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
