#!/usr/bin/env python3
import json
import argparse
from pathlib import Path
from datetime import datetime, timezone

def parse_valid_time_to_epoch(valid_time: str) -> int:
    # Erwartet z. B. 2026-03-27T18:00Z
    dt = datetime.strptime(valid_time, "%Y-%m-%dT%H:%MZ")
    return int(dt.replace(tzinfo=timezone.utc).timestamp())

def sounding_to_geojson(data: dict) -> dict:
    lon = data["target_lon"]
    lat = data["target_lat"]
    ts = parse_valid_time_to_epoch(data["valid_time"])

    features = []
    for lvl in data["levels"]:
        z_m = float(lvl["z_m"])
        p_hpa = float(lvl["p_hPa"])
        t_c = float(lvl["T_C"])
        td_c = float(lvl["Td_C"])

        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat, z_m]
            },
            "properties": {
                "pressure": round(p_hpa, 3),
                "dewpoint": round(td_c + 273.15, 2),  # Kelvin wie im Beispiel
                "temp": round(t_c + 273.15, 2),       # Kelvin wie im Beispiel
                "gpheight": round(z_m, 1),
                "flags": 0,
                "time": ts
            }
        }
        features.append(feature)

    return {
        "type": "FeatureCollection",
        "features": features
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input_json", help="Sounding-JSON aus fetch_sounding.py")
    ap.add_argument("-o", "--output", help="Ausgabe-GeoJSON")
    args = ap.parse_args()

    in_path = Path(args.input_json)
    out_path = Path(args.output) if args.output else in_path.with_suffix(".geojson")

    with in_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    geojson = sounding_to_geojson(data)

    with out_path.open("w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)

    print(f"Gespeichert: {out_path}")

if __name__ == "__main__":
    main()

