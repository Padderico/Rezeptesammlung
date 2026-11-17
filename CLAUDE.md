# Hinweise für Claude – Rezeptesammlung und Kochbuddy (app/)

- **Was ist neu?** Bei jeder Änderung an der Koch-App (app/) in `app/daten/neu.json` einen Eintrag für die Tour
  „Was ist neu?“ ergänzen – neueste zuerst, `id` = Datum (JJJJ-MM-TT), mehrere Änderungen am selben Tag in einen
  Eintrag. Kurze Schritte in Du-Form für die Familie, mit `ziel` (Ansicht, `@rezept` = Hauptgericht von heute) und
  `zeige` (CSS-Selektor der Stelle), `{kind}` statt eines Namens. Die App zeigt den neuesten Eintrag einmal pro Gerät.
  Ältere Einträge nicht ändern.
- **Prüfung:** Vor jedem Push `python3 tools/smoke_test.py .` (muss „ALLES GRÜN“ melden). Nach dem Push den Lauf
  „Prüfen und veröffentlichen“ abwarten – nur grün geht live.
- **Öffentlich:** Dieses Repo ist über GitHub Pages öffentlich. Keine Vornamen, keine Orte oder Ladennamen mit Ort,
  keine Preise. Persönliche Daten (Sterne, Notizen, Wischer, Tausche, Verlauf, Prospekte, Fehlerprotokoll) liegen im
  privaten Repo Einkaufsbuddy-Daten; die App greift mit dem Schlüssel des Geräts darauf zu.
- **Updates:** Ändern sich App-Dateien, in `app/sw.js` die `VERSION` hochzählen.
