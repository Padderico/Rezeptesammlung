# Geschmack aus der Koch-App

Im Tab **Entdecken** der Koch-App (`app/`) werden jeden Tag 20 Gerichte bewertet:
nach rechts gewischt = **like** (lecker), nach links = **nope** (lieber nicht), nach oben = **super** (unbedingt bald kochen).

- `bewertungen.json` – schreibt die App (mit GitHub-Schlüssel des Geräts). Schlüssel `i:<id>` = Idee aus
  `app/daten/ideen.json`, `a:<slug>` = Rezept aus `rezepte/`. Felder: `v` (super/like/nope), `at` (Zeitpunkt),
  `t` (Titel), `tags`, `src` (idee/rezept). Keine Namen, keine Preise.
- `eingeplant.json` – schreiben die Aufgaben, sobald ein mit Stern bewertetes Gericht in einem Wochenplan steht:
  `{"items": {"i:<id>": {"kw": "KW 48/2026", "recipe": "<rezept-slug>", "at": "<Zeitpunkt>"}}}`. Die App zeigt das als „Eingeplant“.
- Neue Gerichte für den nächsten Tag stellt die stündliche Antwort-Aufgabe in `app/daten/ideen.json` zusammen
  (neue Einträge in `ideas`, die Auswahl des Tages unter `days["JJJJ-MM-TT"]`), sobald am Tag geswiped wurde.
