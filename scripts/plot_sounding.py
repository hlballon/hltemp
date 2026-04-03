#!/usr/bin/env python3
import json
import math
import argparse
from pathlib import Path

import matplotlib.pyplot as plt
from metpy.plots import SkewT
from metpy.units import units
import numpy as np


def wind_components_from_dir_speed(wdir_deg, wspd_kn):
    # meteorologische Richtung -> u/v
    rad = np.deg2rad(wdir_deg)
    speed = np.asarray(wspd_kn)
    u = -speed * np.sin(rad)
    v = -speed * np.cos(rad)
    return u, v


def load_sounding(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    levels = data["levels"]

    p = np.array([lvl["p_hPa"] for lvl in levels], dtype=float) * units.hPa
    t = np.array([lvl["T_C"] for lvl in levels], dtype=float) * units.degC
    td = np.array([lvl["Td_C"] for lvl in levels], dtype=float) * units.degC

    wspd = np.array([
        np.nan if lvl["wspd_kn"] is None else lvl["wspd_kn"]
        for lvl in levels
    ], dtype=float) * units.knots

    wdir = np.array([
        np.nan if lvl["wdir_deg"] is None else lvl["wdir_deg"]
        for lvl in levels
    ], dtype=float) * units.degrees

    u, v = wind_components_from_dir_speed(wdir.magnitude, wspd.magnitude)
    u = u * units.knots
    v = v * units.knots

    meta = {
        "model": data.get("model", ""),
        "valid_time": data.get("valid_time", ""),
        "lat": data.get("target_lat", ""),
        "lon": data.get("target_lon", ""),
        "surface_p_hPa": data.get("surface_p_hPa", ""),
    }

    return p, t, td, u, v, meta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("json_file", help="Pfad zur Sounding-JSON")
    ap.add_argument("-o", "--output", default="sounding_plot.png", help="PNG-Datei")
    args = ap.parse_args()

    p, t, td, u, v, meta = load_sounding(args.json_file)

    fig = plt.figure(figsize=(10, 10))
    skew = SkewT(fig, rotation=45)

    skew.plot(p, t, linewidth=2, label="Temperatur")
    skew.plot(p, td, linewidth=2, label="Taupunkt")
    skew.plot_barbs(p, u, v)

    skew.ax.set_ylim(1000, 100)
    skew.ax.set_xlim(-40, 40)
    skew.ax.set_xlabel("Temperatur (°C)")
    skew.ax.set_ylabel("Druck (hPa)")

    skew.plot_dry_adiabats(alpha=0.35)
    skew.plot_moist_adiabats(alpha=0.35)
    skew.plot_mixing_lines(alpha=0.35)

    title = (
        f"{meta['model']}  {meta['valid_time']}\n"
        f"Lat {meta['lat']}, Lon {meta['lon']}   "
        f"PS {meta['surface_p_hPa']} hPa"
    )
    plt.title(title)
    plt.legend(loc="best")
    plt.tight_layout()

    out = Path(args.output)
    plt.savefig(out, dpi=150)
    print(f"Gespeichert: {out}")


if __name__ == "__main__":
    main()
