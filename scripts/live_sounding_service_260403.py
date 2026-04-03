import json
import time
from datetime import datetime
from pathlib import Path
import paho.mqtt.client as mqtt
import subprocess
import ssl

# ========================= CONFIG =========================
MQTT_BROKER_HOST = "w471.gimmbh.com"      # ← Only hostname, no wss://
MQTT_PORT = 8084
MQTT_PATH = "/mqtt"                       # WebSocket path
MQTT_TOPIC_REQUEST = "balloon/request_sounding"

# Paths
ARCHIVE_BASE = Path("/home/uhd/soundingFD/data")
REPO_PATH = Path("/home/uhd/soundingFD/hltemp")
LIVE_FILENAME = "latest_icon_sounding.geojson"

MIN_INTERVAL_SEC = 300  # 5 minutes debounce

last_fetch_time = 0
# =========================================================

def trigger_sounding_fetch(lat: float, lon: float):
    global last_fetch_time
    now = time.time()
    if now - last_fetch_time < MIN_INTERVAL_SEC:
        print(f"⏳ Debounce active — ignoring request (last fetch {int(now - last_fetch_time)}s ago)")
        return

    last_fetch_time = now
    print(f"🚀 Triggering sounding fetch for {lat:.4f}, {lon:.4f}")

    try:
        from fetch_sounding import fetch_sounding_direct
        from sounding_to_geojson import sounding_json_to_geojson

        result = fetch_sounding_direct(lat, lon, model="icon_d2", step=0, jobs=20, archive_base=ARCHIVE_BASE)

        if not result or 'json_path' not in result:
            print("❌ Fetch failed")
            return

        json_path = Path(result['json_path'])
        geojson_path = sounding_json_to_geojson(json_path, geojson_base=ARCHIVE_BASE / "geojson")

        # Copy to live file
        live_file = REPO_PATH / LIVE_FILENAME
        live_file.parent.mkdir(parents=True, exist_ok=True)
        import shutil
        shutil.copy2(geojson_path, live_file)

        print(f"✅ Live file prepared: {live_file}")

        # Git push
        try:
            subprocess.run(["git", "-C", str(REPO_PATH), "add", LIVE_FILENAME], check=True, capture_output=True)
            subprocess.run(["git", "-C", str(REPO_PATH), "commit", "-m", f"Update sounding {datetime.now().strftime('%Y-%m-%d %H:%M')}"],
                         check=True, capture_output=True)
            push_result = subprocess.run(["git", "-C", str(REPO_PATH), "push"], check=True, capture_output=True)
            print("✅ Git push successful")
        except subprocess.CalledProcessError as e:
            print(f"⚠️ Git push failed: {e.stderr.decode().strip() if e.stderr else e}")
            print("   Tip: Make sure you ran 'git init', added remote, and pulled once in ~/soundingFD/hltemp")

        print("🎉 Full cycle completed successfully!")

    except Exception as e:
        print(f"❌ Error in sounding fetch: {e}")

# ====================== MQTT CALLBACKS ======================
def on_connect(client, userdata, flags, rc):
    print("✅ Connected to MQTT broker successfully")
    client.subscribe(MQTT_TOPIC_REQUEST)
    print(f"Subscribed to {MQTT_TOPIC_REQUEST}")

def on_message(client, userdata, msg):
    if msg.topic == MQTT_TOPIC_REQUEST:
        print(f"📨 Received sounding REQUEST on {msg.topic} (payload length: {len(msg.payload)} bytes)")
        try:
            payload = json.loads(msg.payload.decode())
            print(f"   Decoded keys: {list(payload.keys())}")

            lat = payload.get("Lat_deg")
            lon = payload.get("Lon_deg")

            if lat is not None and lon is not None:
                print(f"   Extracted position → Lat: {lat}, Lon: {lon}")
                trigger_sounding_fetch(float(lat), float(lon))
            else:
                print("⚠️ Missing Lat_deg or Lon_deg in request payload")
        except Exception as e:
            print(f"❌ Error processing request: {e}")

# ====================== MAIN ======================
if __name__ == "__main__":
    print("Starting live sounding service (on-demand via balloon/request_sounding)...")

    client = mqtt.Client(transport="websockets")
    client.ws_set_options(path=MQTT_PATH)

    # TLS for Let's Encrypt
    context = ssl.create_default_context()
    client.tls_set_context(context)
    # client.tls_insecure_set(True)  # only if you still have certificate issues

    client.on_connect = on_connect
    client.on_message = on_message

    print(f"Connecting to wss://{MQTT_BROKER_HOST}:{MQTT_PORT}{MQTT_PATH} ...")
    client.connect(MQTT_BROKER_HOST, MQTT_PORT, 60)

    try:
        client.loop_forever()
    except KeyboardInterrupt:
        print("\nService stopped by user")
    except Exception as e:
        print(f"Unexpected error: {e}")
