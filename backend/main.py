import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

from data_loader import data_loader
from model_runner import model_runner

app = FastAPI(
    title="Ocean Temperature Model Inference API",
    description="Depth-wise Ocean Temperature Inference from PyTorch Model",
    version="1.0.0"
)

# Enable CORS for existing frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TemperatureInferenceRequest(BaseModel):
    latitude: float = Field(..., description="Latitude of selected point")
    longitude: float = Field(..., description="Longitude of selected point")
    depth: int = Field(0, description="Selected depth in meters")

@app.get("/api/v1/health")
def get_health():
    return {
        "status": "ok",
        "selected_date": data_loader.selected_date
    }

@app.get("/api/v1/data-status")
def get_data_status():
    return {
        "status": "ok",
        "selected_date": data_loader.selected_date,
        "datasets": list(data_loader.datasets.keys())
    }

@app.post("/api/v1/forecast")
def predict_temperature(req: TemperatureInferenceRequest):
    try:
        # 1. Fetch satellite input variables for selected date & coordinates (excluding GLORYS)
        vars_at_point = data_loader.get_variables_at_point(req.latitude, req.longitude)

        # 2. Build input tensor from NetCDF dataset for selected date
        input_tensor = data_loader.build_input_tensor()

        # 3. Infer depth-wise temperature from PyTorch model
        pred_res = model_runner.predict_temperatures(
            input_tensor_data=input_tensor,
            lat=req.latitude,
            lon=req.longitude,
            req_depth=req.depth,
            vars_at_point=vars_at_point
        )

        depth_log = [str(p['depth_m']) + "m:" + str(p['temperature_degC']) + "C" for p in pred_res['vertical_profile']]
        print(f"\n🧠 [PyTorch Model Inference Executed]")
        print(f"   📅 Date        : {data_loader.selected_date}")
        print(f"   🎯 Coordinates : Lat={req.latitude}, Lon={req.longitude}, Depth={req.depth}m")
        print(f"   📡 Inputs      : SST={vars_at_point['sst']}C, SSS={vars_at_point['sss']} PSU, SSH={vars_at_point['ssh']}m, Wind={vars_at_point['wind_speed']}m/s")
        print(f"   🔥 Prediction  : {pred_res['temperature']} C @ {req.depth}m")
        print(f"   📊 15-Depths   : {depth_log}\n")

        return {
            "status": "success",
            "selected_date": data_loader.selected_date,
            "latitude": req.latitude,
            "longitude": req.longitude,
            "depth": req.depth,
            "input_variables": {
                "sst": vars_at_point["sst"],
                "sss": vars_at_point["sss"],
                "ssh": vars_at_point["ssh"],
                "wind_speed": vars_at_point["wind_speed"],
                "wind_u": vars_at_point["wind_u"],
                "wind_v": vars_at_point["wind_v"],
                "current_speed": vars_at_point["current_speed"]
            },
            "satellite_inputs": {
                "sst": vars_at_point["sst"],
                "sss": vars_at_point["sss"],
                "ssh": vars_at_point["ssh"],
                "wind_speed": vars_at_point["wind_speed"],
                "wind_u": vars_at_point["wind_u"],
                "wind_v": vars_at_point["wind_v"],
                "current_speed": vars_at_point["current_speed"]
            },
            "prediction": pred_res
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
