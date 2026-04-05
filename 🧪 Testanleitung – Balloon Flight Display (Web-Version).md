# 🧪 Testanleitung – Balloon Flight Display (Web-Version)

Diese Anleitung erklärt Schritt für Schritt, wie du das **Balloon Flight Display** im Browser öffnest und testest.

Die Anwendung zeigt **Live-Daten vom Ballonsensor** und kann zusätzlich **Wetter-Soundings laden**.

Du brauchst:

- Einen Computer
- Internetverbindung
- Einen Browser (empfohlen: **Chrome**)
- Den Snack-Link

------

# 🌐 Systemüberblick (vereinfacht)

Die Daten kommen aus zwei möglichen Quellen:

## Möglichkeit 1 – Lokal im Ballonkorb (HTTP)

Sensor → WLAN → App

Beispiel:

http://172.20.10.7/readings

Dies ist die typische **lokale Verbindung im Korb**.

------

## Möglichkeit 2 – Über Starlink (MQTT)

Sensor → MQTT → Internet → App

Diese Variante wird genutzt, wenn Internet über Starlink verfügbar ist.

------

# 🔗 Schritt 1 – Anwendung öffnen

1. Öffne den Browser
2. Öffne diesen Link:

👉 **https://snack.expo.dev/XXXXXXX**

1. Klicke:

➡ **Run**

Dann:

➡ **Run in Web Browser**

⏳ Warte ca. **30–60 Sekunden**

------

# ⚙️ Schritt 2 – Datenquelle auswählen (WICHTIG)

Nach dem Start siehst du oben:

**Data Source: HTTP**
oder
**Data Source: MQTT**

Du kannst die Quelle wechseln mit:

- **Switch to HTTP**
- **Switch to MQTT**
- **Switch to Replay**

Diese Buttons sind zentral für den Betrieb.

------

# 🛰 Schritt 3 – Sensor-Daten prüfen

Jetzt prüfen wir, ob Sensordaten ankommen.

Du solltest sehen:

- Altitude (Höhe)
- v_Speed
- Direction
- Temperature
- Humidity

Diese Werte müssen sich ändern.

------

## Wenn du im Ballonkorb bist:

➡ Verwende:

**Switch to HTTP**

Dann prüfen:

Ändert sich:

- Höhe
- Richtung
- Temperatur

Wenn ja:

✅ Verbindung funktioniert

------

## Wenn du über Starlink arbeitest:

➡ Verwende:

**Switch to MQTT**

Dann prüfen:

Status:

**MQTT Status: Connected**

Wenn dort steht:

✅ **Connected**

Dann funktioniert die Verbindung.

------

# 🧪 Schritt 4 – Live Sounding abrufen

Jetzt wird das wichtigste Feature getestet.

Suche den Button:

🟦 **Fetch Live Sounding**

Dann:

👉 **Einmal klicken**

------

Was jetzt passiert:

1. GPS-Position wird gesendet
2. Server lädt Wettermodell
3. Daten werden erzeugt
4. Neue Punkte erscheinen

Dieser Ablauf erfolgt automatisch im Hintergrund.

⏳ Warte **10–30 Sekunden**

------

# 📊 Schritt 5 – Neue Punkte prüfen

Du solltest sehen:

🔵 **cyanfarbene Punkte**

Diese heißen:

**ICON h-Levels**

Sie zeigen:

- Temperatur
- Wind
- Luftfeuchtigkeit

Wenn neue Punkte erscheinen:

✅ Test erfolgreich

------

# 🧭 Schritt 6 – Diagramme prüfen

Bitte prüfen:

Sind sichtbar:

- Temperatur-Diagramm
- Wind-Diagramm
- Drift-Diagramm
- Feuchtigkeits-Diagramm

Wenn alles sichtbar:

✅ Anzeige korrekt

------

# 🧪 Optionaler Test – Replay-Modus

Wenn keine echten Daten verfügbar sind:

1. Klicke:

➡ **Switch to Replay**

Dann:

- Die App spielt gespeicherte Daten ab
- Werte ändern sich automatisch

Das ist ideal für Tests ohne Sensor.

------

# ❗ Häufige Probleme

## Keine Daten sichtbar

Mögliche Ursachen:

- Falsche Datenquelle gewählt
- Sensor nicht aktiv
- WLAN nicht verbunden

Lösung:

➡ **Switch to HTTP**
oder
➡ **Switch to MQTT**

------

## MQTT bleibt auf "Connecting"

Mögliche Ursache:

- Keine Internetverbindung
- Starlink nicht aktiv

------

## Fetch Live Sounding funktioniert nicht

Mögliche Ursache:

- Keine gültige GPS-Position

Die App benötigt:

Latitude ≠ 0
Longitude ≠ 0

------

# 📝 Feedback

Bitte mitteilen:

1. Hat alles funktioniert?
2. Welche Datenquelle wurde verwendet?
   - HTTP
   - MQTT
   - Replay
3. Gab es Fehlermeldungen?

Wenn möglich:

📸 Screenshot senden.

------

# 💡 Wichtig für reale Tests

Typischer Ablauf im Feld:

1. Sensor einschalten
2. WLAN verbinden
3. HTTP-Daten prüfen
4. MQTT testen (optional)
5. Live Sounding abrufen

Dieser Ablauf entspricht dem echten Systembetrieb.