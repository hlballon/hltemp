# CONFIG.md

SoundingFD System – Konfigurationsübersicht

Diese Datei beschreibt alle konfigurierbaren Parameter des Systems.

Konfigurationen befinden sich in:

```text
~/soundingFD/config/
```

---

# Ziel der Konfiguration

Die Konfiguration ermöglicht:

* mehrere Standorte
* einfache Modellwahl
* zentrale Parameterverwaltung
* automatisierte Workflows
* reproduzierbare Läufe

---

# 1. stations.json

Speicherort:

```text
config/stations.json
```

Diese Datei enthält alle gewünschten Koordinaten.

---

## Beispiel: stations.json

```json
{
  "stations": [

    {
      "name": "Berlin",
      "lat": 52.50,
      "lon": 13.40,
      "active": true
    },

    {
      "name": "Hamburg",
      "lat": 53.55,
      "lon": 10.00,
      "active": false
    }

  ]
}
```

---

## Bedeutung der Felder

| Feld   | Beschreibung        |
| ------ | ------------------- |
| name   | Anzeigename         |
| lat    | Breite              |
| lon    | Länge               |
| active | aktiv / deaktiviert |

Nur aktive Stationen werden verarbeitet.

---

# 2. settings.yaml

Speicherort:

```text
config/settings.yaml
```

Diese Datei enthält globale Parameter.

---

## Beispiel: settings.yaml

```yaml
model: icon-eu

forecast_step: 0

jobs: 8

output:
  geojson: true
  plot: true

paths:
  raw: data/raw
  geojson: data/geojson
  plots: output/plots
```

---

## Bedeutung der Parameter

### model

Modelltyp:

```text
icon-eu
icon-d2
icon-global
```

Empfohlen:

```text
icon-eu
```

---

### forecast_step

Vorhersagezeit:

```text
0   → Analyse
3   → +3h
6   → +6h
```

---

### jobs

Parallel-Downloads:

```text
jobs: 8
```

Typische Werte:

```text
4–12
```

---

### output Optionen

```yaml
output:
  geojson: true
  plot: true
```

Erlaubt:

* nur GeoJSON
* nur Plot
* beides

---

### paths

Standard-Ausgabeorte:

```yaml
paths:
  raw: data/raw
  geojson: data/geojson
  plots: output/plots
```

Normalerweise nicht ändern.

---

# 3. Mehrere Stationen automatisch verarbeiten

Zukünftiger Workflow:

```bash
python run_all_stations.py
```

Dieser liest:

```text
stations.json
settings.yaml
```

und verarbeitet automatisch alle aktiven Standorte.

---

# Beispiel Ablauf

```text
Berlin  → verarbeitet
Hamburg → übersprungen (active=false)
```

---

# 4. Beispiel zukünftiger Workflow

```bash
python run_all_stations.py
```

Interner Ablauf:

```text
für jede Station:

fetch
→ geojson
→ plot
```

---

# 5. Erweiterbare Parameter

Geplant:

```yaml
time:
  mode: latest
  hour: auto

logging:
  enabled: true
  level: INFO

retention:
  days: 7
```

Diese steuern:

* Zeitwahl
* Logging
* automatische Löschung alter Daten

---

# 6. Stations-Datei erstellen

```bash
nano ~/soundingFD/config/stations.json
```

Minimalbeispiel:

```json
{
  "stations": [
    {
      "name": "Berlin",
      "lat": 52.50,
      "lon": 13.40,
      "active": true
    }
  ]
}
```

---

# 7. Settings-Datei erstellen

```bash
nano ~/soundingFD/config/settings.yaml
```

Minimalbeispiel:

```yaml
model: icon-eu
forecast_step: 0
jobs: 8

output:
  geojson: true
  plot: true

paths:
  raw: data/raw
  geojson: data/geojson
  plots: output/plots
```

---

# 8. Test der Konfiguration (zukünftig)

Geplantes Script:

```bash
python check_config.py
```

Dieses prüft:

* JSON Syntax
* YAML Syntax
* Pfade
* Parameter

---

# 9. Gute Praxis

Empfohlen:

```text
Stationsliste klein beginnen
zuerst eine Station
danach erweitern
```

Beispiel:

```json
Berlin
Potsdam
Hamburg
München
```

---

# 10. Versionskontrolle

Diese Dateien gehören ins Git Repository:

```text
config/stations.json
config/settings.yaml
```

Nicht versionieren:

```text
data/
output/
venv/
```

---

# 11. Zukunft: Multi-Modell Betrieb

Geplant:

```yaml
models:
  - icon-eu
  - icon-d2
```

Damit können mehrere Modelle gleichzeitig erzeugt werden.

---

# 12. Zukunft: Zeitsteuerung

Beispiel Cron:

```bash
0 * * * * run_workflow.py
```

Dann läuft das System automatisch jede Stunde.

---

# Konfigurationsstatus

Aktuell empfohlen:

```text
1 Station
icon-eu
step=0
jobs=8
GeoJSON + Plot
```

Stabil und effizient.


---

# Konfiguration prüfen

Script:

```text
check_config.py
```

Start:

```bash
cd ~/soundingFD/orig/orig_scripts

python check_config.py
```

Dieses Script zeigt:

* aktive Stationen
* aktuelle Modellparameter
* verwendete Pfade
* eventuelle Fehler

Beispiel:

```text
AKTIVE STATIONEN

- Berlin         lat=52.50 lon=13.40
- Potsdam        lat=52.39 lon=13.07

Modell           : icon-eu
Forecast Step    : 0
Parallel Jobs    : 8
```

---

# Multi-Station Workflow

Script:

```text
run_all_stations.py
```

Start:

```bash
python run_all_stations.py
```

Dieses Script:

1. liest `stations.json`
2. liest `settings.yaml`
3. startet Workflow für jede aktive Station

---

# Reihenfolge im Betrieb

Empfohlen:

```bash
python check_config.py
python run_all_stations.py
```
