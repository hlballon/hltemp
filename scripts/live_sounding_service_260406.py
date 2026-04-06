import json
import time
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path
import paho.mqtt.client as mqtt
import subprocess
import ssl
import uuid
import traceback

MQTT_BROKER_HOST = "w471.gimmbh.com"
MQTT_PORT = 8084
MQTT_PATH = "/mqtt"
MQTT_TOPIC_REQUEST = "balloon/request_sounding"
MQTT_USER = "lorMQTT"
MQTT_PASS = "l0rHBQND"

ARCHIVE_BASE = Path("/home/uhd/soundingFD/data")
REPO_PATH = Path("/home/uhd/soundingFD/hltemp")

LIVE_FILENAME = "latest_icon_sounding.geojson"
LIVE_STATUS_FILENAME = "latest_icon_status.json"

MIN_INTERVAL_SEC = 300
last_fetch_time = 0


def utc_now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def live_file_path() -> Path:
    return REPO_PATH / LIVE_FILENAME


def status_file_path() -> Path:
    return REPO_PATH / LIVE_STATUS_FILENAME


def default_status() -> dict:
    return {
        "state": "idle",
        "message": "No active request",
        "request_id": None,
        "request_time_utc": None,
        "source_lat": None,
        "source_lon": None,
        "model_name": None,
        "model_run_utc": None,
        "forecast_hour": None,
        "displayed_version": None,
        "pending_version": None,
        "published_version": None,
        "data_time_utc": None,
        "updated_at_utc": utc_now_iso()
    }


def load_status() -> dict:
    path = status_file_path()
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"⚠️ Failed to read status file, using defaults: {e}")
    return default_status()


def save_status(status: dict):
    status["updated_at_utc"] = utc_now_iso()
    path = status_file_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(status, indent=2), encoding="utf-8")
    print(f"✅ Status file updated: {path}")


def update_status(**kwargs):
    status = load_status()
    status.update(kwargs)
    save_status(status)


def git_commit_and_push(files_to_add, commit_message: str):
    subprocess.run(
        ["git", "-C", str(REPO_PATH), "add", *files_to_add],
        check=True,
        capture_output=True,
        text=True
    )

    commit_result = subprocess.run(
        ["git", "-C", str(REPO_PATH), "commit", "-m", commit_message],
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


def publish_status_only(
    *,
    state: str,
    message: str,
    request_id: str,
    request_time_utc: str,
    lat: float,
    lon: float,
    pending_version: str | None,
    displayed_version: str | None = None,
    published_version: str | None = None,
    data_time_utc: str | None = None,
    model_name: str | None = None,
    model_run_utc: str | None = None,
    forecast_hour: int | None = None,
):
    update_status(
        state=state,
        message=message,
        request_id=request_id,
        request_time_utc=request_time_utc,
        source_lat=lat,
        source_lon=lon,
        displayed_version=displayed_version,
        pending_version=pending_version,
        published_version=published_version,
        data_time_utc=data_time_utc,
        model_name=model_name,
        model_run_utc=model_run_utc,
        forecast_hour=forecast_hour,
    )

    git_commit_and_push(
        [LIVE_STATUS_FILENAME],
        f"Update sounding status: {state} {request_time_utc}"
    )


def extract_model_time_info(json_path: Path | None, request_version: str) -> dict:
    """
    Extract timing information from the raw sounding filename.

    Example filename:
    sounding_ICON-D2_20260405_21Z_+000h_52.30N_13.05E.json
    """
    fallback = {
        "model_name": None,
        "model_run_utc": request_version,
        "forecast_hour": None,
        "data_time_utc": request_version,
    }

    if json_path is None:
        return fallback

    name = json_path.name

    pattern = re.compile(
        r"^sounding_(?P<model>.+?)_(?P<date>\d{8})_(?P<hour>\d{2})Z_\+(?P<step>\d{3})h_"
    )

    match = pattern.search(name)
    if not match:
        print(f"⚠️ Could not parse model timing from filename: {name}")
        return fallback

    try:
        model_name = match.group("model")
        run_date = match.group("date")
        run_hour = match.group("hour")
        forecast_hour = int(match.group("step"))

        run_dt = datetime.strptime(
            f"{run_date}{run_hour}",
            "%Y%m%d%H"
        ).replace(tzinfo=timezone.utc)

        valid_dt = run_dt + timedelta(hours=forecast_hour)

        return {
            "model_name": model_name,
            "model_run_utc": run_dt.isoformat().replace("+00:00", "Z"),
            "forecast_hour": forecast_hour,
            "data_time_utc": valid_dt.isoformat().replace("+00:00", "Z"),
        }

    except Exception as e:
        print(f"⚠️ Failed to compute model timing from filename {name}: {e}")
        return fallback


def inject_geojson_metadata(
    geojson_path: Path,
    request_id: str,
    version: str,
    data_time_utc: str,
    model_name: str | None,
    model_run_utc: str | None,
    forecast_hour: int | None,
    request_time_utc: str,
):
    try:
        data = json.loads(geojson_path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            print("⚠️ GeoJSON root is not a dict, skipping metadata injection")
            return

        metadata = data.get("metadata", {})
        if not isinstance(metadata, dict):
            metadata = {}

        metadata.update({
            "request_id": request_id,
            "version": version,
            "request_time_utc": request_time_utc,
            "data_time_utc": data_time_utc,
            "model_name": model_name,
            "model_run_utc": model_run_utc,
            "forecast_hour": forecast_hour,
            "generated_at_utc": utc_now_iso()
        })

        data["metadata"] = metadata
        geojson_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        print(f"✅ Injected GeoJSON metadata into {geojson_path}")

    except Exception as e:
        print(f"⚠️ Failed to inject GeoJSON metadata: {e}")


def trigger_sounding_fetch(lat: float, lon: float):
    global last_fetch_time

    now = time.time()
    if now - last_fetch_time < MIN_INTERVAL_SEC:
        elapsed = int(now - last_fetch_time)
        print(f"⏳ Debounce active — ignoring request (last fetch {elapsed}s ago)")
        return

    last_fetch_time = now

    request_id = str(uuid.uuid4())
    request_version = utc_now_iso()

    previous_status = load_status()
    previous_displayed_version = previous_status.get("displayed_version")
    previous_published_version = previous_status.get("published_version")

    print(f"🚀 Triggering sounding fetch for {lat:.4f}, {lon:.4f}")
    print(f"🆔 Request ID: {request_id}")
    print(f"🕒 Request version: {request_version}")

    try:
        publish_status_only(
            state="pending",
            message="New sounding requested. Previous sounding may still be displayed.",
            request_id=request_id,
            request_time_utc=request_version,
            lat=lat,
            lon=lon,
            pending_version=request_version,
            displayed_version=previous_displayed_version,
            published_version=previous_published_version,
            data_time_utc=previous_status.get("data_time_utc"),
            model_name=previous_status.get("model_name"),
            model_run_utc=previous_status.get("model_run_utc"),
            forecast_hour=previous_status.get("forecast_hour"),
        )
        print("✅ Published PENDING status")
    except Exception as e:
        print(f"⚠️ Failed to publish pending status: {e}")
        traceback.print_exc()

    try:
        from fetch_sounding import fetch_sounding_direct
        from sounding_to_geojson import sounding_json_to_geojson
        import shutil

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
                raise RuntimeError("Fetch failed: no raw JSON file found")

            json_path = candidates[0]
            print(f"⚠️ Falling back to newest raw JSON: {json_path}")

        if not json_path.exists():
            raise FileNotFoundError(f"JSON path does not exist: {json_path}")

        time_info = extract_model_time_info(json_path, request_version)

        model_name = time_info["model_name"]
        model_run_utc = time_info["model_run_utc"]
        forecast_hour = time_info["forecast_hour"]
        data_time_utc = time_info["data_time_utc"]

        print(
            f"🕒 Model timing: model={model_name}, run={model_run_utc}, "
            f"forecast_hour=+{forecast_hour:03d}h, valid={data_time_utc}"
            if forecast_hour is not None
            else f"🕒 Model timing fallback: valid={data_time_utc}"
        )

        geojson_path = sounding_json_to_geojson(
            json_path,
            geojson_base=ARCHIVE_BASE / "geojson"
        )

        inject_geojson_metadata(
            geojson_path=Path(geojson_path),
            request_id=request_id,
            version=request_version,
            request_time_utc=request_version,
            data_time_utc=data_time_utc,
            model_name=model_name,
            model_run_utc=model_run_utc,
            forecast_hour=forecast_hour,
        )

        try:
            publish_status_only(
                state="publishing",
                message="New sounding prepared locally. Publishing in progress.",
                request_id=request_id,
                request_time_utc=request_version,
                lat=lat,
                lon=lon,
                pending_version=request_version,
                displayed_version=previous_displayed_version,
                published_version=previous_published_version,
                data_time_utc=data_time_utc,
                model_name=model_name,
                model_run_utc=model_run_utc,
                forecast_hour=forecast_hour,
            )
            print("✅ Published PUBLISHING status")
        except Exception as e:
            print(f"⚠️ Failed to publish publishing status: {e}")
            traceback.print_exc()

        live_file = live_file_path()
        live_file.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(geojson_path, live_file)

        print(f"✅ Live file prepared: {live_file}")

        update_status(
            state="fresh",
            message="Latest sounding published and ready for display.",
            request_id=request_id,
            request_time_utc=request_version,
            source_lat=lat,
            source_lon=lon,
            model_name=model_name,
            model_run_utc=model_run_utc,
            forecast_hour=forecast_hour,
            displayed_version=request_version,
            pending_version=None,
            published_version=request_version,
            data_time_utc=data_time_utc,
        )

        git_commit_and_push(
            [LIVE_FILENAME, LIVE_STATUS_FILENAME],
            f"Update sounding {request_version}"
        )

        print("🎉 Full cycle completed successfully!")

    except subprocess.CalledProcessError as e:
        stderr = e.stderr.strip() if isinstance(e.stderr, str) else str(e)
        print(f"⚠️ Git operation failed: {stderr}")

        try:
            update_status(
                state="failed",
                message="New sounding could not be published. Previous sounding remains active.",
                request_id=request_id,
                request_time_utc=request_version,
                source_lat=lat,
                source_lon=lon,
                model_name=previous_status.get("model_name"),
                model_run_utc=previous_status.get("model_run_utc"),
                forecast_hour=previous_status.get("forecast_hour"),
                displayed_version=previous_displayed_version,
                pending_version=None,
                published_version=previous_published_version,
                data_time_utc=previous_status.get("data_time_utc"),
            )

            git_commit_and_push(
                [LIVE_STATUS_FILENAME],
                f"Update sounding status: failed {request_version}"
            )
        except Exception as status_err:
            print(f"⚠️ Failed to publish FAILED status after git error: {status_err}")
            traceback.print_exc()

        print("✅ Local sounding update may exist, but GitHub publish failed")
        print("   Tip: run 'git pull --rebase origin main' in ~/soundingFD/hltemp, then retry")

    except Exception as e:
        print(f"❌ Error in sounding fetch: {e}")
        traceback.print_exc()

        try:
            update_status(
                state="failed",
                message=f"New sounding request failed: {str(e)}. Previous sounding remains active.",
                request_id=request_id,
                request_time_utc=request_version,
                source_lat=lat,
                source_lon=lon,
                model_name=previous_status.get("model_name"),
                model_run_utc=previous_status.get("model_run_utc"),
                forecast_hour=previous_status.get("forecast_hour"),
                displayed_version=previous_displayed_version,
                pending_version=None,
                published_version=previous_published_version,
                data_time_utc=previous_status.get("data_time_utc"),
            )

            git_commit_and_push(
                [LIVE_STATUS_FILENAME],
                f"Update sounding status: failed {request_version}"
            )
            print("✅ Published FAILED status")
        except Exception as status_err:
            print(f"⚠️ Failed to publish FAILED status: {status_err}")
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
        traceback.print_exc()


def on_subscribe(client, userdata, mid, granted_qos, properties=None):
    print(f"✅ Subscription acknowledged (mid={mid}, qos={granted_qos})")


def on_disconnect(client, userdata, rc, properties=None):
    if rc == 0:
        print("MQTT disconnected cleanly")
    else:
        print(f"⚠️ MQTT disconnected unexpectedly (rc={rc})")


if __name__ == "__main__":
    print("Starting live sounding service (on-demand via balloon/request_sounding)...")

    if not status_file_path().exists():
        save_status(default_status())

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
        traceback.print_exc()