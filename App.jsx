import { useEffect, useState } from "react";
import TopHud from "./components/TopHud";
import LeftDrawer from "./components/LeftDrawer";
import RightDrawer from "./components/RightDrawer";
import MapView from "./components/MapView";
import TimelineBar from "./components/TimelineBar";
import MapLegend from "./components/MapLegend";
import {
  fetchTemperatureProfile,
  fetchLayerMeta,
  checkBackendHealth,
} from "./api/oceanData";
import "./styles.css";

function basinNameFor(lat, lon) {
  if (lon < 77.5) return "Arabian Sea";
  if (lon > 80) return "Bay of Bengal";
  return "Equatorial Front";
}

export default function App() {
  const [coord, setCoord] = useState({ lat: 15.0, lon: 70.0 });
  const [activeVariable, setActiveVariable] = useState("temp");
  const [depthIndex, setDepthIndex] = useState(10); // 200m default
  const [dayIndex, setDayIndex] = useState(0);

  const [profile, setProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [layerMeta, setLayerMeta] = useState(null);
  const [isOnline, setIsOnline] = useState(false);

  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  // Load a profile whenever the selected point or day changes.
  useEffect(() => {
    setIsLoadingProfile(true);
    fetchTemperatureProfile(coord.lat, coord.lon, dayIndex)
      .then(setProfile)
      .finally(() => setIsLoadingProfile(false));
  }, [coord, dayIndex]);

  // Load legend metadata whenever the active layer/depth changes.
  useEffect(() => {
    const depthM = activeVariable === "temp" ? 200 : 0; // surface vars ignore depth
    fetchLayerMeta(activeVariable, depthM).then(setLayerMeta);
  }, [activeVariable, depthIndex]);

  useEffect(() => {
    checkBackendHealth().then((res) => setIsOnline(res.online));
  }, []);

  return (
    <div className="app-shell">
      <MapView selectedCoord={coord} onPointSelected={(lat, lon) => setCoord({ lat, lon })} />

      <TopHud basinName={basinNameFor(coord.lat, coord.lon)} coord={coord} isOnline={isOnline} />

      {leftOpen && (
        <LeftDrawer
          activeVariable={activeVariable}
          onVariableChange={setActiveVariable}
          depthIndex={depthIndex}
          onDepthIndexChange={setDepthIndex}
          onClose={() => setLeftOpen(false)}
        />
      )}

      {rightOpen && (
        <RightDrawer
          coord={coord}
          profile={profile}
          isLoading={isLoadingProfile}
          onClose={() => setRightOpen(false)}
        />
      )}

      <MapLegend variableId={activeVariable} layerMeta={layerMeta} />

      <TimelineBar dayIndex={dayIndex} onDayChange={setDayIndex} />
    </div>
  );
}
