# 🧪 Testanleitung – Balloon Flight Display im Browser nutzen

Vielen Dank fürs Testen des **Balloon Flight Display — Live Sounding Systems**.

Diese Anleitung zeigt Schritt für Schritt, wie du die Anwendung **im Browser auf deinem Computer** öffnen und testen kannst.

Du brauchst:

- keine Installation
- keine Programmierkenntnisse
- nur einen Browser

------

# 🔗 Schritt 1 – Anwendung öffnen

1. Öffne deinen Browser
   (empfohlen: **Google Chrome**)
2. Öffne diesen Link:

👉 https://snack.expo.dev/@hex_472504/hlb_flight-display_260403

1. Warte, bis die Seite vollständig geladen ist.

------

# ▶️ Schritt 2 – Web-Version starten

Du siehst:

- links: Programmcode
- rechts: eine Vorschau
- oben: einen Button **Run**

Jetzt:

1. Klicke auf:

➡ **Run**

1. Wähle:

➡ **Run in Web Browser**

⏳ Die App startet jetzt.
Das kann **30–60 Sekunden** dauern.

------

# 🧭 Was du danach sehen solltest

Nach dem Start erscheint die Anwendung.

Du solltest sehen:

- Diagramme oder Kurven
- Messwerte
- Buttons zur Steuerung
- ggf. eine Karte oder Drift-Anzeige

Die App zeigt:

- 🌬 Windrichtung
- 🧭 Driftpfad
- 🌡 Temperatur
- 💧 Luftfeuchtigkeit

Diese Daten stammen aus einem Wettermodell und werden automatisch geladen.
Das System lädt Daten über MQTT, erzeugt GeoJSON und zeigt sie in der App an.

------

# 🧪 Testschritte (bitte genau durchführen)

Bitte führe diese Schritte **in der Reihenfolge** aus.

------

# 1️⃣ Erste Anzeige prüfen

Nach dem Start:

Bitte prüfen:

- Wird ein Diagramm angezeigt?
- Siehst du Linien oder Punkte?
- Reagiert die Oberfläche auf Klicks?

Wenn ja:

✅ Weiter zu Schritt 2

------

# 2️⃣ Button „Fetch Live Sounding“ testen

Suche diesen Button:

🟧 **Fetch Live Sounding**
(cyan Button)

Jetzt:

👉 **Einmal anklicken**

------

Was jetzt passiert:

Das System:

1. sendet eine Anfrage
2. lädt neue Wetterdaten
3. erstellt neue Punkte
4. zeigt diese im Diagramm an

Dieser Ablauf ist Teil der automatischen Datenpipeline.

⏳ Warte jetzt **10–30 Sekunden**.

------

# 3️⃣ Neue Daten prüfen

Nach einigen Sekunden:

Bitte prüfen:

- Erscheinen **neue Punkte**?
- Werden **cyanfarbene Punkte** sichtbar?
- Aktualisieren sich die Diagramme?

Diese Punkte heißen:

➡ **ICON h-Levels**

Wenn du neue Punkte siehst:

✅ Schritt erfolgreich

------

# 4️⃣ Layer ein- und ausschalten

Klicke erneut auf:

👉 **Fetch Live Sounding**

Erwartung:

- Daten werden **ein- oder ausgeblendet**

Hinweis:

Wenn du zu schnell klickst, passiert evtl. nichts.
Das System blockiert doppelte Anfragen für **5 Minuten** (Schutzfunktion).

------

# 5️⃣ Diagramme prüfen

Bitte prüfen:

- Wird Temperatur angezeigt?
- Wird Windrichtung angezeigt?
- Wird Drift dargestellt?
- Wird Luftfeuchtigkeit angezeigt?

Falls sichtbar:

✅ Alles funktioniert

------

# 🧠 Was im Hintergrund passiert (vereinfacht)

Die Anwendung arbeitet so:

1. Du klickst **Fetch Live Sounding**
2. Eine Anfrage wird gesendet
3. Ein Server lädt Wetterdaten
4. Die Daten werden in GeoJSON gespeichert
5. Die App lädt diese Datei
6. Neue Werte erscheinen im Diagramm

Dieser Ablauf entspricht dem Datenfluss im System.



# ❗ Häufige Probleme

## Die App startet nicht

Bitte:

- Seite neu laden (**F5**)
- Noch einmal **Run** klicken

------

## Keine neuen Daten erscheinen

Bitte:

- 30 Sekunden warten
- Noch einmal klicken
- Nicht mehrfach schnell klicken

------

## Anzeige bleibt leer

Bitte:

- Browser neu starten
- Chrome verwenden
- Screenshot senden

------

# 💡 Tipps für beste Ergebnisse

Empfohlen:

- Computer verwenden
- Chrome verwenden
- Internetverbindung stabil halten

Nicht empfohlen:

- Sehr alte Browser
- Firmen-Netzwerke mit starken Firewalls

------

# 📞 Unterstützung

Falls etwas nicht funktioniert:  Hilmar anrufen!

