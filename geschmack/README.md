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

## Sterne und Anton-Stempel

Jedes Rezept lässt sich in der Koch-App mit **1–5 Sternen** bewerten (auf der Rezeptseite, am Ende des Kochmodus und
direkt in der Woche, sobald ein Gericht gegessen ist) und mit dem Stempel **„Für Anton geeignet“** markieren.
Beides ist jederzeit änderbar. Ab dem Samstag nach einer Planwoche fragt die App alle Gerichte dieser Woche ohne
Sterne ab, bevor es weitergeht (oder man tippt „Gab's nicht“).

- `sterne.json` – schreibt die App (mit GitHub-Schlüssel des Geräts):
  `{"items": {"<rezept-slug>": {"s": 1–5, "anton": true, "at": "<Zeitpunkt>", "t": "<Titel>", "tags": [...]}}}`.
  Schlüssel = Slug aus `rezepte/rezepte.json`. `anton` fehlt, wenn nicht gestempelt. Keine Namen, keine Preise.
  Die Datei gehört der App: nie selbst ändern, bei Konflikten immer die Fassung aus origin nehmen.
- Für Pläne: 5 = Lieblingsgericht (gern wieder einplanen), 4 = sehr gut, 3 = gut, 2 = geht so, 1 = nicht so
  (nicht mehr einplanen). Gestempelte Gerichte haben auch dem Kind gepasst.
