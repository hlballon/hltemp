# 🪂 Balloon Flight Display – Benutzeranleitung

## Nutzung im Korb und Remote mit Diagrammen

Diese Anleitung erklärt:

1. Nutzung **im Ballonkorb (HTTP lokal)**
2. Nutzung **Remote über Starlink (MQTT)**
3. Bedeutung der **Diagramme und Anzeigen**

------

# 🧭 Systemüberblick

Das folgende Diagramm zeigt, wie das System im Hintergrund arbeitet:

📌 **So entstehen die angezeigten Wetterdaten**

![image-20260404102141232](C:\Users\hl\AppData\Roaming\Typora\typora-user-images\image-20260404102141232.png)



------

## Funktionen

1. Der Ballonsensor sendet Messdaten
2. Die App fordert Wetterdaten an
3. Der Server lädt das ICON-Wettermodell
4. Daten werden in GeoJSON umgewandelt
5. Die App lädt diese Daten
6. Diagramme werden aktualisiert

------

# 🖥 Benutzeroberfläche – Überblick

Das folgende Bild zeigt die echte Oberfläche der Anwendung:

📌 **So sieht die App nach dem Start aus**

![image-20260404102241331](C:\Users\hl\AppData\Roaming\Typora\typora-user-images\image-20260404102241331.png)

![Flight Display Oberfläche](https://chatgpt.com/c/Flight_Display_Interface.png)

------

# 🧭 Erklärung der Bereiche

Die Oberfläche besteht aus vier Hauptbereichen.

------

# 📊 Bereich A – Sensordaten (links)

Hier stehen die Live-Daten:

- Altitude → Höhe des Ballons
- v_Speed → Steiggeschwindigkeit
- Direction → Windrichtung
- Speed → Geschwindigkeit
- Temperature → Temperatur
- Humidity → Luftfeuchtigkeit

Ganz oben:

**Data Source: HTTP oder MQTT**

Das ist die aktuelle Datenquelle.

------

# 🎛 Bereich B – Steuerbuttons

Diese Buttons steuern das System:

- SHOW WYOMING SOUNDING
- SHOW GEOJSON SOUNDING
- SHOW COMPOSED SOUNDING
- HIDE ICON H-LEVELS
- FETCH WEATHER DATA

Diese laden oder zeigen Wetterdaten.

------

# 🧭 Bereich C – Drift-Radar (oben Mitte)

Dieses Diagramm zeigt:

**Windrichtung und Drift in verschiedenen Höhen**

Interpretation:

- Zentrum = Startpunkt
- Kreislinien = Höhen
- Punkte = Windrichtung
- Je weiter außen → desto höher



------

# 📈 Bereich D – Atmosphären-Diagramme

Diese Diagramme zeigen die Struktur der Atmosphäre.

------

# 🌡 Temperatur vs Höhe

Zeigt:

- X-Achse → Temperatur
- Y-Achse → Höhe



------

# 💧 Feuchtigkeit vs Höhe

Zeigt:

- Luftfeuchtigkeit in verschiedenen Höhen

o

------

# 🌬 Geschwindigkeit vs Höhe

Zeigt:

- Windgeschwindigkeit mit Höhe



------

# 🧭 Richtung vs Höhe

Zeigt:

- Windrichtung über Höhe



------

# 🪂 Anleitung 1 – Nutzung im Ballonkorb (HTTP)

Dies ist der Standardbetrieb während der Fahrt.

------

# Voraussetzungen

Vor dem Start:

✅ WLAN angeschaltet & verbunden!!!!!!

✅ Sensor eingeschaltet

✅ Computer im Sensor-WLAN

------

# Schritt-für-Schritt

## 1️⃣ App starten

Snack-Link öffnen
Dann:

Run → Run in Web Browser oder iPad

Warten:

⏳ 30–60 Sekunden

------

## 2️⃣ HTTP aktivieren

Links klicken:

🟦 SWITCH TO HTTP

Dann prüfen:

**Data Source: HTTP**

------

## 3️⃣ Sensordaten prüfen

Diese Werte müssen sich ändern:

- Altitude
- Direction
- Temperature
- Humidity

Wenn sie sich bewegen:

✅ Verbindung OK

------

## 4️⃣ Wetterdaten laden

Klicken:

🟦 FETCH WEATHER DATA (Standard OpenMeteo Daten )

Dann:

Modell wählen:

z.B. ICON-D2

Warten:

⏳ 5 Sekunden



🟦 FETCH LIVE SOUNDING (DWD Daten mit 25hPa Auflösung )

⏳ 30 Sekunden bis 1 Minute  

------

## 5️⃣ Diagramme prüfen

Du solltest sehen:

🔵 neue Punkte

Diese heißen:

**ICON h-Levels**

Sie zeigen:

- Temperatur
- Feuchte
- Wind

Wenn sichtbar:

✅ Funktion korrekt

------

# 🌍 Anleitung 2 – Nutzung Remote (MQTT)

Dieser Modus wird genutzt:

- Bodenstation
- Büro
- Remote Monitoring

------

# Voraussetzungen

Vor dem Start:

✅ Internet aktiv
✅ Starlink aktiv
✅ MQTT erreichbar

------

# Schritt-für-Schritt

## 1️⃣ App starten

Snack-Link öffnen
Run → Run in Web Browser

------

## 2️⃣ MQTT aktivieren

Links klicken:

🟧 SWITCH TO MQTT

Dann prüfen:

**MQTT Status: Connected**

Wenn Connected:

✅ Verbindung OK

------

## 3️⃣ Sensordaten prüfen

Du solltest sehen:

- Latitude
- Longitude
- Altitude

Wenn Werte sich ändern:

✅ MQTT funktioniert

------

## 4️⃣ Sounding laden

Klicken:

🟦 FETCH WEATHER DATA

Warten:

⏳ 5 Sekunden

Dann erscheinen:

🔵 Standard Flächen Modelldaten



🟦 FETCH LIVE SOUNDING (DWD Daten mit 25hPa Auflösung )

⏳ 30 Sekunden bis 1 Minute  (falls auf dem Server bereits Soundings zu diesem Zeitpunkt, bzw. in räumlichen Zelle des Modells abgerufen wurden, so werden diese angezeigt)

------

# 🧪 Replay-Modus (z.Z. für Tests)

Wenn kein Sensor aktiv ist:

Klicken:

SWITCH TO REPLAY

Dann:

- Daten werden simuliert
- Diagramme bewegen sich

Sehr gut für Training.

------

# 🎯 Empfohlene Test-Reihenfolge

Für neue Nutzer:

1️⃣ Replay testen
2️⃣ HTTP im Korb testen
3️⃣ MQTT Remote testen
4️⃣ Sounding laden

------

# Ziel dieser Anwendung

Diese Anzeige dient zur:

- Echtzeit-Flugüberwachung
- Driftanalyse
- Wetterbewertung
- Sicherheitsunterstützung

Während des Ballonflugs.