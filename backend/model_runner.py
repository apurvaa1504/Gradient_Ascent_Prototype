import io
import os
import zipfile
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from typing import Dict, Any, List

DEPTHS = [0, 10, 20, 30, 50, 75, 100, 150, 200, 300, 400, 500, 700, 850, 1000]

class CBAM(nn.Module):
    def __init__(self, channels: int, reduction: int = 8):
        super().__init__()
        red = max(1, channels // reduction)
        self.channel_mlp = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Conv2d(channels, red, 1),
            nn.ReLU(inplace=True),
            nn.Conv2d(red, channels, 1),
            nn.Sigmoid()
        )
        self.spatial_conv = nn.Conv2d(2, 1, kernel_size=7, padding=3)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        ch_att = self.channel_mlp(x)
        x = x * ch_att
        max_out, _ = torch.max(x, dim=1, keepdim=True)
        avg_out = torch.mean(x, dim=1, keepdim=True)
        sp_att = torch.sigmoid(self.spatial_conv(torch.cat([max_out, avg_out], dim=1)))
        return x * sp_att

class ConvBlock(nn.Module):
    def __init__(self, in_ch: int, out_ch: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, 3, padding=1),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True)
        )
        self.attn = CBAM(out_ch)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.attn(self.net(x))

class OceanUNet(nn.Module):
    def __init__(self, in_ch: int = 70, out_ch: int = 15):
        super().__init__()
        self.enc1 = ConvBlock(in_ch, 32)
        self.enc2 = ConvBlock(32, 64)
        self.enc3 = ConvBlock(64, 128)
        self.pool = nn.MaxPool2d(2, 2)
        self.dec2 = ConvBlock(192, 64)
        self.dec1 = ConvBlock(96, 32)
        self.head = nn.Conv2d(32, out_ch, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool(e1))
        e3 = self.enc3(self.pool(e2))

        e3_up = F.interpolate(e3, size=e2.shape[2:], mode='bilinear', align_corners=True)
        d2 = self.dec2(torch.cat([e3_up, e2], dim=1))

        d2_up = F.interpolate(d2, size=e1.shape[2:], mode='bilinear', align_corners=True)
        d1 = self.dec1(torch.cat([d2_up, e1], dim=1))

        out = self.head(d1)
        return out

class ModelRunner:
    def __init__(self, weights_dir: str):
        self.weights_dir = weights_dir
        self.device = torch.device('cpu')
        self.model = OceanUNet(in_ch=70, out_ch=15)
        self._load_model_weights()

    def _load_model_weights(self):
        print(f"Loading PyTorch model weights from {self.weights_dir}...")
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_STORED) as z:
            for root, dirs, files in os.walk(self.weights_dir):
                for file in files:
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, self.weights_dir)
                    z.write(full_path, arcname=os.path.join('archive', rel_path))

        buffer.seek(0)
        weights = torch.load(buffer, map_location=self.device, weights_only=False)
        self.model.load_state_dict(weights, strict=True)
        self.model.eval()
        print("PyTorch model loaded successfully for temperature & profile inference!")

    def calculate_sound_speed(self, temp: float, salinity: float, depth: float) -> float:
        t = temp
        s = salinity
        d = depth
        c = 1448.96 + (4.591 * t) - (0.05304 * t * t) + (0.0002374 * (t ** 3)) + (1.340 * (s - 35)) + (0.0163 * d)
        return round(float(c), 1)

    def predict_temperatures(self, input_tensor_data: np.ndarray, lat: float, lon: float, req_depth: int = 0, vars_at_point: Dict[str, Any] = None) -> Dict[str, Any]:
        lat_idx = vars_at_point["lat_idx"] if vars_at_point else 20
        lon_idx = vars_at_point["lon_idx"] if vars_at_point else 20
        sst_base = vars_at_point["sst"] if vars_at_point else 28.5
        sss_base = vars_at_point["sss"] if vars_at_point else 35.0

        # Prepare PyTorch tensor (1, 70, 41, 49)
        tensor = torch.tensor(input_tensor_data, dtype=torch.float32).unsqueeze(0).to(self.device)

        with torch.no_grad():
            pred_raw = self.model(tensor).squeeze(0).cpu().numpy() # (15, 41, 49)

        is_bob = lon > 80.0
        mld = 30 if is_bob else 50
        thermocline_scale = 150 if is_bob else 200
        deep_temp = 3.8
        surface_sal = sss_base
        deep_sal = 34.8

        vertical_profile = []
        sound_speed_profile = []

        for i, d in enumerate(DEPTHS):
            delta_t = float(pred_raw[i, lat_idx, lon_idx])

            if d <= mld:
                t_phys = sst_base - (d / mld) * 0.12
            else:
                z_scale = (d - mld) / thermocline_scale
                t_phys = deep_temp + (sst_base - 0.12 - deep_temp) * np.exp(-z_scale)

            predicted_temp = round(float(t_phys + delta_t), 2)

            # Salinity S(z)
            if d < 150:
                s_val = surface_sal + (d / 150) * (deep_sal - surface_sal)
            else:
                s_val = deep_sal + 0.15 * np.sin(d * 0.01)
            s_val = round(float(s_val), 2)

            # Sound Speed C(z)
            c_val = self.calculate_sound_speed(predicted_temp, s_val, float(d))
            sound_speed_profile.append(c_val)

            vertical_profile.append({
                "depth_m": d,
                "temperature_degC": predicted_temp,
                "salinity_psu": s_val,
                "sound_speed_ms": c_val
            })

        # Calculate Sonic Layer Depth (SLD)
        max_speed = -1.0
        sld_depth = 0
        for i, d in enumerate(DEPTHS):
            if d <= 200 and sound_speed_profile[i] > max_speed:
                max_speed = sound_speed_profile[i]
                sld_depth = d

        # Match requested depth
        depth_diffs = [abs(d - req_depth) for d in DEPTHS]
        matched_idx = int(np.argmin(depth_diffs))
        req_profile = vertical_profile[matched_idx]

        mhw_status = "Category II (Strong)" if sst_base > 30.2 else ("Category I (Moderate)" if sst_base > 29.5 else "Normal")
        tchp = round(float((sst_base - 26) * 42.5 if sst_base > 28.5 else 18.2), 1)

        return {
            "temperature": req_profile["temperature_degC"],
            "salinity": req_profile["salinity_psu"],
            "sound_speed": req_profile["sound_speed_ms"],
            "sonic_layer_depth_m": sld_depth,
            "max_sound_speed_ms": max_speed,
            "marine_heatwave_status": mhw_status,
            "cyclone_heat_potential_kJ_cm2": tchp,
            "vertical_profile": vertical_profile
        }

weights_path = os.path.join(os.path.dirname(__file__), 'model', 'model_weights')
model_runner = ModelRunner(weights_path)
