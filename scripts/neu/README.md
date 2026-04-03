# SoundingFD System – Installation & Workflow Dokumentation

## Systemübersicht

Host: **dHD**
OS: **Debian 13 (VM unter Proxmox)**
Python-Version: **3.13**
Arbeitsverzeichnis:

```
~/soundingFD
```

Ziel des Systems:

* ICON-Soundings laden
* JSON erzeugen
* GeoJSON erzeugen
* Skew-T Plot erzeugen
* strukturierte Ablage aller Daten

---

# Verzeichnisstruktur

```
~/soundingFD/
│
├── venv/                 # Python Umgebung
│
├── scripts/              # (zukünftig Produktion)
│
├── orig/
│   ├── orig_scripts/     # stabile Basis-Skripte
│   │   ├── fetch_sounding.py
│   │   ├── sounding_to_geojson.py
│   │   ├── plot_sounding.py
│   │   ├── run_workflow.py
│   │
│   ├── notebooks/
│
├── dev/
│   ├── test_scripts/     # Entwicklung neuer Versionen
│   ├── notebooks/
│
├── data/
│   ├── raw/              # ursprüngliche JSON
│   ├── geojson/          # GeoJSON Ausgabe
│   ├── logs/
│
├── config/
│
├── output/
│   ├── plots/            # PNG Grafiken
│   ├── exports/
│
└── README.md
```

---

# Python Setup

## Virtuelle Umgebung erstellen

```bash
cd ~/soundingFD

python3 -m venv --system-site-packages venv
source venv/bin/activate
```

Prüfen:

```bash
which python
python --version
```

Erwartet:

```
~/soundingFD/venv/bin/python
Python 3.13.x
```

---

## Python Pakete installieren

```bash
pip install -U pip

pip install \
numpy \
requests \
matplotlib \
metpy \
pandas
```

Test:

```bash
python -c "import eccodes, numpy, requests, matplotlib, metpy; print('alles OK')"
```

---

# Workflow – Gesamtsystem

Das System besteht aus drei Hauptschritten:

1. Sounding laden
2. GeoJSON erzeugen
3. Plot erzeugen

Alles wird über ein einziges Script gesteuert:

```
run_workflow.py
```

---

# Workflow starten

```bash
cd ~/soundingFD/orig/orig_scripts

python run_workflow.py \
  --lat 52.5 \
  --lon 13.4 \
  --model icon-eu \
  --step 0 \
  --jobs 8
```

---

# Ergebnisdateien

Nach erfolgreichem Lauf entstehen:

## JSON

```
data/raw/

sounding_ICON-EU_YYYYMMDD_HHZ_+000h_LAT_LON.json
```

---

## GeoJSON

```
data/geojson/

52p50_13p40_YYYYMMDD_HHMMSS.geojson
```

---

## Plot

```
output/plots/

sounding_ICON-EU_YYYYMMDD_HHZ_+000h_LAT_LON.png
```

---

# Einzelkomponenten

## fetch_sounding.py

Funktion:

* Download ICON Modell-Daten
* Extraktion atmosphärischer Profile
* Speicherung als JSON

Ausgabe:

```
data/raw/
```

---

## sounding_to_geojson.py

Funktion:

* JSON → GeoJSON konvertieren
* pro Level ein GeoJSON Feature

Parameter:

* Druck
* Temperatur
* Taupunkt
* Wind
* geopotentiale Höhe
* Zeit

Ausgabe:

```
data/geojson/
```

---

## plot_sounding.py

Funktion:

* erzeugt Skew-T Diagramm
* nutzt MetPy

Ausgabe:

```
output/plots/
```

---

## run_workflow.py

Funktion:

Startet automatisch:

```
fetch → geojson → plot
```

Dies ist das zentrale Workflow-Script.

---

# Typischer Arbeitsablauf

Virtuelle Umgebung aktivieren:

```bash
cd ~/soundingFD
source venv/bin/activate
```

Workflow starten:

```bash
cd orig/orig_scripts

python run_workflow.py \
  --lat 52.5 \
  --lon 13.4 \
  --model icon-eu \
  --step 0
```

---

# Wichtige Hinweise

## Immer venv aktivieren

Vor jedem Lauf:

```bash
source ~/soundingFD/venv/bin/activate
```

---

## Keine Dateien direkt im Home speichern

Immer:

```
data/raw/
data/geojson/
output/plots/
```

verwenden.

---

# Entwicklung neuer Funktionen

Neue Experimente:

```
dev/test_scripts/
```

Neue stabile Versionen später nach:

```
scripts/
```

verschieben.

---

# Zukünftige Erweiterungen

Geplant:

* mehrere Koordinaten gleichzeitig
* automatische Zeitsteuerung (cron)
* GitHub Upload
* Logging
* Stations-Konfiguration
* Web-Visualisierung

---

# Beispiel erfolgreicher Lauf

```
ICON-EU 20260329/18Z +000h (52.5, 13.4)
✓ sounding_ICON-EU_20260329_18Z...
✓ GeoJSON erzeugt
✓ Plot erzeugt
```

---

# Status

System läuft stabil auf:

```
dHD
Debian 13
Python 3.13
```

Workflow vollständig funktional.
---

# Multi-Station Workflow

Neben dem Einzel-Workflow existiert ein Multi-Station Betrieb.

Dieser nutzt:

```text
config/stations.json
config/settings.yaml
```

---

## Konfiguration prüfen

Vor jedem Lauf sollte die Konfiguration geprüft werden:

```bash
cd ~/soundingFD
source venv/bin/activate

cd orig/orig_scripts
python check_config.py
```

Dies zeigt:

* aktive Stationen
* Modell
* Forecast-Step
* Jobs
* verwendete Pfade

---

## Mehrere Stationen verarbeiten

```bash
python run_all_stations.py
```

Für jede aktive Station wird automatisch ausgeführt:

```text
fetch → geojson → plot
```

---

## Beispiel-Ausgabe

```text
Station: Berlin
Lat/Lon: 52.5, 13.4

Station: Potsdam
Lat/Lon: 52.39, 13.07

Zusammenfassung:
Erfolgreich: 2
Fehlgeschlagen: 0
```

---

# Empfohlener Arbeitsablauf

```bash
source ~/soundingFD/venv/bin/activate

cd ~/soundingFD/orig/orig_scripts

python check_config.py

python run_all_stations.py
```

---

# Workflow Varianten

## Einzelstation

```bash
python run_workflow.py --lat 52.5 --lon 13.4
```

## Mehrere Stationen

```bash
python run_all_stations.py
```
