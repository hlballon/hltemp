# hlballon Flight Display – Sounding Automation Setup

## Overview

The system automatically fetches high-quality ICON sounding data based on the balloon's current GPS position and overlays it on the flight display.

**Components:**

- **Balloon sensor** → sends telemetry every 10 seconds via MQTT (balloon/readings)
- **App.js** (Expo Go on iPad) → displays flight data + "Fetch Live Sounding" button
- **live_sounding_service.py** (on Debian VM) → listens for on-demand requests, fetches ICON model, creates GeoJSON, pushes to GitHub
- **GitHub repo** (hlballon/hltemp) → delivers latest_icon_sounding.geojson to the app

## Current Architecture (On-Demand)

- Pilot presses **"Fetch Live Sounding"** button → App publishes current GPS to MQTT topic balloon/request_sounding
- Service receives the request → fetches latest ICON-D2 (or selected model) for that location
- Service creates GeoJSON and overwrites latest_icon_sounding.geojson on GitHub
- App displays the sounding as cyan dots ("ICON h-Levels")

## Folder Structure on dHD (Debian VM)

text

```
~/soundingFD/
├── dev/test_scripts/
│   ├── live_sounding_service.py          # Main service (on-demand)
│   ├── fetch_sounding.py
│   └── sounding_to_geojson.py
├── data/
│   ├── raw/          # raw JSON from DWD
│   └── geojson/      # timestamped GeoJSON files for debrief
├── hltemp/           # Git repo – contains latest_icon_sounding.geojson
└── venv/             # Python environment
```

## How to Start the System

### 1. On the Debian VM (dHD)

Bash

```
cd ~/soundingFD/dev/test_scripts
source venv/bin/activate
python live_sounding_service.py
```

You should see:

text

```
Starting live sounding service (on-demand via balloon/request_sounding)...
✅ Connected to MQTT broker successfully
Subscribed to balloon/request_sounding
```

Leave this terminal running.

### 2. On the iPad (Expo Go)

- Open the app
- Make sure MQTT is connected (you should see "Connected" status)
- Press the **orange "Fetch Live Sounding"** button when you want a new sounding

### Expected Pilot Workflow

1. During flight, when you want current atmospheric sounding:
   - Press **"Fetch Live Sounding"** (orange button)
2. The app sends the current GPS position to the service
3. Service fetches the latest ICON model for your location
4. New cyan dots ("ICON h-Levels") appear on the graphs within a few seconds
5. You can hide/show the layer with the same button

**Note:** The service has a 5-minute debounce. Pressing the button again too soon will be ignored.

## Files & Their Purpose

- **live_sounding_service.py** → Listens for requests, triggers ICON fetch, updates GitHub
- **fetch_sounding.py** → Downloads GRIB data from DWD and extracts profiles
- **sounding_to_geojson.py** → Converts raw data to GeoJSON for the app
- **App.js** → Flight display with "Fetch Live Sounding" button

## Troubleshooting

- **Button does nothing** → Check console in Expo Go (shake iPad → Debug)
- **Service not reacting** → Check that it is subscribed to balloon/request_sounding
- **Git push fails** → Run cd ~/soundingFD/hltemp && git status and fix repository
- **No cyan dots** → Make sure "ICON h-Levels" layer is enabled (showIconH)

## Future Improvements (Optional)

- Add automatic refresh every X minutes
- Show "Fetching..." status in the app
- Support model selection (ICON-D2 / ICON-EU / ICON) from the button

------

**You can copy the entire text above into your README.md.**

Would you like me to also provide:

1. The **exact small patch** for App.js to make the button work with the new topic?
2. Any improvements to the service (e.g. better logging, model selection)?

Just say what you need next and I’ll give it to you.

Your setup is now very close to being fully operational.