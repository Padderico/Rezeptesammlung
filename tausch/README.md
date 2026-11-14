# Tausche aus der Koch-App

Die Koch-App (`app/`) legt hier pro Planwoche eine Datei `kw<kw>-<jahr>.json` an, sobald jemand ein Ersatzgericht auf einen Tag zieht.
Enthalten sind nur Tag, Mahlzeit und Rezept-IDs bzw. Rezepttitel – keine Namen, Preise oder Angebote.

Neue Tausche haben `status: "offen"`. Abends gegen 21 Uhr übernimmt der Koch- und Einkaufsbuddy sie in Plan, Bring-Liste, PDF und App-Daten
und setzt den Status auf `übernommen` (bzw. `nur-app`, `verfallen`, `verworfen`). Einträge werden nie gelöscht.
