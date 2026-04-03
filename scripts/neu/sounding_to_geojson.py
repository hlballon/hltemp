#!/usr/bin/env python3
import json
import argparse
from pathlib import Path
from datetime import datetime, timezone


def parse_valid_time(valid_time: str) -> datetime:
    return datetime.strptime(valid_time, "%Y-%m-%dT%H:%MZ").replace(tzinfo=timezone.utc)


def coord_token(value: float) -> str:
    sign = "m" if value < 0 else ""
    return f"{sign}{abs(value):.2f}".replace(".", "p")


def build_output_name(lat: float, lon: float, valid_dt: datetime) -> str:
    ts = valid_dt.strftime("%Y%m%d_%H%M%S")
    return f"{coord_token(lat)}_{coord_token(lon)}_{ts}.geojson"


def sounding_to_featurecollection(data: dict) -> dict:
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

        wspd_kn = lvl.get("wspd_kn")
        wdir_deg = lvl.get("wdir_deg")
        wspd_ms = None if wspd_kn is None else float(wspd_kn) * 0.514444

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat, round(z_m, 1)]
            },
            "properties": {
                "pressure": round(p_hpa, 3),
                "temp": round(t_c + 273.15, 2),
                "dewpoint": round(td_c + 273.15, 2),
                "gpheight": round(z_m, 1),
                "time": epoch,
                "flags": 0,
                "windSpeedKn": None if wspd_kn is None else round(float(wspd_kn), 1),
                "windSpeedMs": None if wspd_ms is None else round(wspd_ms, 2),
                "windDirDeg": None if wdir_deg is None else round(float(wdir_deg), 1),
            }
        })

    return {
        "type": "FeatureCollection",
        "features": features
    }


def main():
    ap = argparse.ArgumentParser(description="Convert sounding JSON to GeoJSON")
    ap.add_argument("input_json", help="Input sounding JSON")
    ap.add_argument("-o", "--output", help="Output geojson file")
    args = ap.parse_args()

    in_path = Path(args.input_json)
    if not in_path.exists():
        raise FileNotFoundError(f"Input file not found: {in_path}")

    with in_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    valid_dt = parse_valid_time(data["valid_time"])
    lat = float(data["target_lat"])
    lon = float(data["target_lon"])

    out_path = Path(args.output) if args.output else Path(build_output_name(lat, lon, valid_dt))
    out_path.parent.mkdir(parents=True, exist_ok=True)

    fc = sounding_to_featurecollection(data)

    with out_path.open("w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False, indent=2)

    print(f"Gespeichert: {out_path}")


if __name__ == "__main__":
    main()
