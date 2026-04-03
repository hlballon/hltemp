#!/usr/bin/env python3
"""
sounding_to_geojson.py — Convert sounding JSON to GeoJSON (library + CLI)
"""

import json
import argparse
from pathlib import Path
from datetime import datetime, timezone

def parse_valid_time(valid_time: str) -> datetime:
    return datetime.strptime(valid_time, "%Y-%m-%dT%H:%MZ").replace(tzinfo=timezone.utc)

def coord_token(value: float) -> str:
    sign = "m" if value < 0 else ""
    return f"{sign}{abs(value):.2f}".replace(".", "p")

def build_filename(lat: float, lon: float, valid_dt: datetime) -> str:
    ts = valid_dt.strftime("%Y%m%d_%H%M%S")
    return f"{coord_token(lat)}_{coord_token(lon)}_{ts}.geojson"

def sounding_to_featurecollection(data: dict) -> dict:
    # Your original function — unchanged
    lon = float(data["target_lon"])
    lat = float(data["target_lat"])
    valid_dt = parse_valid_time(data["valid_time"])
    epoch = int(valid_dt.timestamp())

    features = []
    for lvl in data["levels"]:
        z_m = float(lvl["z_m"])
        p_hpa = float(lvl["p_hPa"])
        t_c = float(lvl["T_C"])
        td_c = float(lvl["Td_C"])

        feature = {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat, round(z_m, 1)]},
            "properties": {
                "pressure": round(p_hpa, 3),
                "temp": round(t_c + 273.15, 2),
                "dewpoint": round(td_c + 273.15, 2),
                "gpheight": round(z_m, 1),
                "time": epoch,
                "flags": 0,
            }
        }
        if lvl.get("wspd_kn") is not None:
            feature["properties"]["wspd_kn"] = round(float(lvl["wspd_kn"]), 1)
        if lvl.get("wdir_deg") is not None:
            feature["properties"]["wdir_deg"] = round(float(lvl["wdir_deg"]), 1)
        features.append(feature)

    return {"type": "FeatureCollection", "features": features}

def sounding_json_to_geojson(input_json_path: str | Path, output_geojson: str | Path | None = None) -> Path:
    in_path = Path(input_json_path)
    with in_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    fc = sounding_to_featurecollection(data)

    lat = float(data["target_lat"])
    lon = float(data["target_lon"])
    valid_dt = parse_valid_time(data["valid_time"])

    out_name = output_geojson or build_filename(lat, lon, valid_dt)
    out_path = Path(out_name)
    out_path.write_text(json.dumps(fc, ensure_ascii=False, indent=2))

    print(f"Gespeichert: {out_path}")
    return out_path

# CLI compatibility
if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("input_json", help="Input sounding JSON")
    ap.add_argument("-o", "--output", help="Output .geojson")
    args = ap.parse_args()
    sounding_json_to_geojson(args.input_json, args.output)