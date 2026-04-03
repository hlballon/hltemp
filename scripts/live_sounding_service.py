#!/usr/bin/env python3
import json, time, os
from pathlib import Path
import paho.mqtt.client as mqtt
from fetch_sounding import fetch_sounding_direct   # import the new function
from sounding_to_geojson import sounding_json_to_geojson

# CONFIG
MQTT_BROKER = "w471.gimmbh.com"   # hostname only
MQTT_PORT = 8084
MQTT_TOPIC = "balloon/readings"
MQTT_USER = "lorMQTT"
MQTT_PASS = "l0rHBQND"

REPO_PATH = Path("/path/to/your/hltemp-repo")          # git clone here
LIVE_GEOJSON = REPO_PATH / "latest_icon_sounding.geojson"

ARCHIVE_DIR = Path("/var/soundings_archive")          # persistent archive

LAST_FETCH = 0.0
MIN_INTERVAL_SEC = 300   # 5 min

def on_message(client, userdata, msg):
    global LAST_FETCH
    try:
        data = json.loads(msg.payload)
        lat = float(data.get("Lat_deg", 0))
        lon = float(data.get("Lon_deg", 0))
        if abs(lat) < 0.01 or abs(lon) < 0.01:
            return

        now = time.time()
        if now - LAST_FETCH < MIN_INTERVAL_SEC:
            return

        print(f"📍 Triggered by position {lat:.4f}, {lon:.4f}")

        # Fetch with automatic model selection (or you can pass a fixed model)
        sounding, original_json_name = fetch_sounding_direct(
            lat=lat, lon=lon, step=0, archive_dir=ARCHIVE_DIR
        )

        if not sounding:
            return

        # Convert to GeoJSON (keep original name in archive)
        geo_path = ARCHIVE_DIR / original_json_name.replace(".json", ".geojson")
        sounding_json_to_geojson(
            ARCHIVE_DIR / original_json_name,   # input
            geo_path                            # output (local archive)
        )

        # Overwrite the live file for the app
        live_geo = sounding_json_to_geojson(
            ARCHIVE_DIR / original_json_name,
            LIVE_GEOJSON
        )

        # Git push
        os.chdir(REPO_PATH)
        os.system(f"git add {LIVE_GEOJSON.name}")
        os.system(f'git commit -m "Auto: Live ICON sounding @ {lat:.2f},{lon:.2f}"')
        os.system("git push")

        LAST_FETCH = now
        print(f"✅ Updated {LIVE_GEOJSON} and pushed")

    except Exception as e:
        print("Service error:", e)

# MQTT with WebSocket support
client = mqtt.Client(transport="websockets")
client.username_pw_set(MQTT_USER, MQTT_PASS)
client.on_message = on_message

print("Connecting to MQTT over WebSocket...")
client.connect(MQTT_BROKER, MQTT_PORT, 60)
client.subscribe(MQTT_TOPIC)
client.loop_forever()