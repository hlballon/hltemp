import json
import time
from datetime import datetime
from pathlib import Path
import paho.mqtt.client as mqtt
import subprocess
import ssl

MQTT_BROKER_HOST = "w471.gimmbh.com"
MQTT_PORT = 8084
MQTT_PATH = "/mqtt"
MQTT_TOPIC_REQUEST = "balloon/request_sounding"
MQTT_USER = "lorMQTT"
MQTT_PASS = "l0rHBQND"

ARCHIVE_BASE = Path("/home/uhd/soundingFD/data")
REPO_PATH = Path("/home/uhd/soundingFD/hltemp")
LIVE_FILENAME = "latest_icon_sounding.geojson"

MIN_INTERVAL_SEC = 300
last_fetch_time = 0


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
        import shutil
        import traceback

        result = fetch_sounding_direct(
            lat,
            lon,
            step=0,
            jobs=20,
            archive_base=ARCHIVE_BASE
        )

        json_path = None

        if isinstance(result, dict):
            json_path_value = (
                result.get("json_path")
                or result.get("raw_json")
                or result.get("raw_json_path")
                or result.get("path")
                or result.get("filename")
            )
            if json_path_value:
                json_path = Path(json_path_value)

        elif isinstance(result, str):
            json_path = Path(result)

        elif isinstance(result, tuple):
            for item in result:
                if isinstance(item, (str, Path)):
                    json_path = Path(item)
                    break

        if json_path is None:
            raw_dir = ARCHIVE_BASE / "raw"
            candidates = sorted(
                raw_dir.glob("sounding_*.json"),
                key=lambda p: p.stat().st_mtime,
                reverse=True
            )

            if not candidates:
                print("❌ Fetch failed: no raw JSON file found")
                return

            json_path = candidates[0]
            print(f"⚠️ Falling back to newest raw JSON: {json_path}")

        if not json_path.exists():
            print(f"❌ JSON path does not exist: {json_path}")
            return

        geojson_path = sounding_json_to_geojson(
            json_path,
            geojson_base=ARCHIVE_BASE / "geojson"
        )

        live_file = REPO_PATH / LIVE_FILENAME
        live_file.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(geojson_path, live_file)

        print(f"✅ Live file prepared: {live_file}")
        print("✅ Sounding fetch and local GeoJSON update completed")

        try:
            subprocess.run(
                ["git", "-C", str(REPO_PATH), "add", LIVE_FILENAME],
                check=True,
                capture_output=True,
                text=True
            )

            commit_result = subprocess.run(
                [
                    "git",
                    "-C",
                    str(REPO_PATH),
                    "commit",
                    "-m",
                    f"Update sounding {datetime.now().strftime('%Y-%m-%d %H:%M')}"
                ],
                check=False,
                capture_output=True,
                text=True
            )

            commit_stdout = (commit_result.stdout or "").strip()
            commit_stderr = (commit_result.stderr or "").strip()

            if commit_result.returncode != 0:
                nothing_to_commit = (
                    "nothing to commit" in commit_stdout.lower()
                    or "nothing to commit" in commit_stderr.lower()
                )
                if not nothing_to_commit:
                    raise subprocess.CalledProcessError(
                        commit_result.returncode,
                        commit_result.args,
                        commit_result.stdout,
                        commit_result.stderr
                    )
                print("ℹ️ No git changes to commit")
            else:
                print("✅ Git commit successful")

            push_result = subprocess.run(
                ["git", "-C", str(REPO_PATH), "push"],
                check=True,
                capture_output=True,
                text=True
            )
            print("✅ Git push successful")
            if push_result.stdout:
                print(push_result.stdout.strip())

            print("🎉 Full cycle completed successfully!")

        except subprocess.CalledProcessError as e:
            stderr = e.stderr.strip() if isinstance(e.stderr, str) else str(e)
            print(f"⚠️ Git push failed: {stderr}")
            print("✅ Local sounding update completed, but GitHub publish failed")
            print("   Tip: run 'git pull --rebase origin main' in ~/soundingFD/hltemp, then retry")

    except Exception as e:
        import traceback
        print(f"❌ Error in sounding fetch: {e}")
        traceback.print_exc()


def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        print("✅ Connected to MQTT broker successfully")
        result, mid = client.subscribe(MQTT_TOPIC_REQUEST, qos=1)
        if result == mqtt.MQTT_ERR_SUCCESS:
            print(f"Subscribed to {MQTT_TOPIC_REQUEST}")
        else:
            print(f"⚠️ Subscribe failed with result code {result}")
    else:
        print(f"❌ MQTT connect failed with rc={rc}")


def on_message(client, userdata, msg):
    if msg.topic != MQTT_TOPIC_REQUEST:
        return

    print(f"📨 Received sounding REQUEST on {msg.topic} (payload length: {len(msg.payload)} bytes)")

    try:
        payload = json.loads(msg.payload.decode())
        print(f"   Decoded keys: {list(payload.keys())}")

        lat = payload.get("Lat_deg")
        lon = payload.get("Lon_deg")

        if lat is None or lon is None:
            print("⚠️ Missing Lat_deg or Lon_deg in request payload")
            return

        lat = float(lat)
        lon = float(lon)

        if lat == 0 or lon == 0:
            print(f"⚠️ Ignoring invalid coordinates Lat={lat}, Lon={lon}")
            return

        print(f"   Extracted position → Lat: {lat}, Lon: {lon}")
        trigger_sounding_fetch(lat, lon)

    except Exception as e:
        print(f"❌ Error processing request: {e}")


def on_subscribe(client, userdata, mid, granted_qos, properties=None):
    print(f"✅ Subscription acknowledged (mid={mid}, qos={granted_qos})")


def on_disconnect(client, userdata, rc, properties=None):
    if rc == 0:
        print("MQTT disconnected cleanly")
    else:
        print(f"⚠️ MQTT disconnected unexpectedly (rc={rc})")


if __name__ == "__main__":
    print("Starting live sounding service (on-demand via balloon/request_sounding)...")

    client = mqtt.Client(transport="websockets")
    client.ws_set_options(path=MQTT_PATH)
    client.username_pw_set(MQTT_USER, MQTT_PASS)

    context = ssl.create_default_context()
    client.tls_set_context(context)

    client.on_connect = on_connect
    client.on_message = on_message
    client.on_subscribe = on_subscribe
    client.on_disconnect = on_disconnect

    print(f"Connecting to wss://{MQTT_BROKER_HOST}:{MQTT_PORT}{MQTT_PATH} ...")
    client.connect(MQTT_BROKER_HOST, MQTT_PORT, 60)

    try:
        client.loop_forever()
    except KeyboardInterrupt:
        print("\nService stopped by user")
    except Exception as e:
        print(f"Unexpected error: {e}")