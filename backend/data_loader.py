import os
import random
import numpy as np
import xarray as xr
from typing import Dict, Any, Tuple

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')

# File paths excluding GLORYS dataset
FILES = {
    'sst': os.path.join(DATA_DIR, 'sst_regridded_final.nc'),
    'ssh': os.path.join(DATA_DIR, 'ssh_regridded_final.nc'),
    'sss': os.path.join(DATA_DIR, 'sss_regridded_final.nc'),
    'wind': os.path.join(DATA_DIR, 'wind_regridded_final.nc'),
    'currents': os.path.join(DATA_DIR, 'currents_regridded_final.nc')
}

class OceanDataLoader:
    def __init__(self):
        self.datasets: Dict[str, xr.Dataset] = {}
        self.time_values = []
        self.selected_date: str = ""
        self.selected_time_idx: int = 100
        self.lats = None
        self.lons = None
        self._load_datasets()

    def _load_datasets(self):
        print("Loading NetCDF datasets (excluding GLORYS)...")
        for key, path in FILES.items():
            if os.path.exists(path):
                self.datasets[key] = xr.open_dataset(path)
            else:
                raise FileNotFoundError(f"Required dataset missing: {path}")

        # Extract time array and coordinate axes
        sst_ds = self.datasets['sst']
        self.lats = sst_ds.lat.values
        self.lons = sst_ds.lon.values
        raw_times = sst_ds.time.values
        self.time_values = [str(t)[:10] for t in raw_times]

        # Randomly select one date from 2020, 2021, or 2022 (ensuring >= 10 days history window)
        min_idx = 10
        max_idx = len(self.time_values) - 1
        self.selected_time_idx = random.randint(min_idx, max_idx)
        self.selected_date = self.time_values[self.selected_time_idx]
        print(f"Session Initialized. Selected Random Date: {self.selected_date} (Time Index: {self.selected_time_idx})")

    def get_session_info(self) -> Dict[str, Any]:
        return {
            "selected_date": self.selected_date,
            "selected_time_index": self.selected_time_idx,
            "total_days_available": len(self.time_values),
            "date_range": [self.time_values[0], self.time_values[-1]],
            "lat_bounds": [float(self.lats.min()), float(self.lats.max())],
            "lon_bounds": [float(self.lons.min()), float(self.lons.max())],
            "grid_shape": [len(self.lats), len(self.lons)]
        }

    def get_variables_at_point(self, lat: float, lon: float, time_idx: int = None) -> Dict[str, Any]:
        if time_idx is None:
            time_idx = self.selected_time_idx

        # Nearest neighbor indexing
        lat_idx = int(np.argmin(np.abs(self.lats - lat)))
        lon_idx = int(np.argmin(np.abs(self.lons - lon)))

        sst_val = float(self.datasets['sst']['sst'].values[time_idx, lat_idx, lon_idx])
        ssh_val = float(self.datasets['ssh']['ssh'].values[time_idx, lat_idx, lon_idx])
        sss_val = float(self.datasets['sss']['sss'].values[time_idx, lat_idx, lon_idx])
        
        u_wind = float(self.datasets['wind']['wind_u'].values[time_idx, lat_idx, lon_idx])
        v_wind = float(self.datasets['wind']['wind_v'].values[time_idx, lat_idx, lon_idx])
        wind_speed = float(np.hypot(u_wind, v_wind))

        u_curr = float(self.datasets['currents']['uo_surf'].values[time_idx, lat_idx, lon_idx])
        v_curr = float(self.datasets['currents']['vo_surf'].values[time_idx, lat_idx, lon_idx])
        current_speed = float(np.hypot(u_curr, v_curr))
        current_dir = float((np.degrees(np.arctan2(v_curr, u_curr)) + 360) % 360)

        return {
            "sst": round(sst_val, 2),
            "sss": round(sss_val, 2),
            "ssh": round(ssh_val, 3),
            "wind_speed": round(wind_speed, 2),
            "wind_u": round(u_wind, 2),
            "wind_v": round(v_wind, 2),
            "current_speed": round(current_speed, 2),
            "current_dir": round(current_dir, 1),
            "uo_surf": round(u_curr, 3),
            "vo_surf": round(v_curr, 3),
            "lat_actual": float(self.lats[lat_idx]),
            "lon_actual": float(self.lons[lon_idx]),
            "lat_idx": lat_idx,
            "lon_idx": lon_idx
        }

    def build_input_tensor(self, time_idx: int = None) -> np.ndarray:
        if time_idx is None:
            time_idx = self.selected_time_idx

        # Extract 10-day window [time_idx - 9 ... time_idx]
        start_idx = max(0, time_idx - 9)
        channels = []

        for t in range(start_idx, start_idx + 10):
            channels.append(self.datasets['sst']['sst'].values[t])
            channels.append(self.datasets['ssh']['ssh'].values[t])
            channels.append(self.datasets['sss']['sss'].values[t])
            channels.append(self.datasets['wind']['wind_u'].values[t])
            channels.append(self.datasets['wind']['wind_v'].values[t])
            channels.append(self.datasets['currents']['uo_surf'].values[t])
            channels.append(self.datasets['currents']['vo_surf'].values[t])

        # Stack into (70, 41, 49) array
        tensor_data = np.stack(channels, axis=0).astype(np.float32)
        return tensor_data

# Singleton instance
data_loader = OceanDataLoader()
