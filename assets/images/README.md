# Bilder

Lägg originalbilder här och kör:

```bash
npm run images            # optimerar allt → public/images/opt + src/lib/images/manifest.json
npm run images -- --check # visar vilka bilder som finns och vilka som saknas (med exakta filnamn)
```

Skriptet beskär, skalar och komprimerar varje bild till AVIF och WebP i flera storlekar. Det skapar också en suddig förhandsvisning och tar bort all metadata, inklusive GPS-position. Bilder skalas aldrig upp. Är en källa för liten varnar skriptet.

Saknas en bild visar appen automatiskt den genererade grafiken. Ett felstavat filnamn stoppar bygget, så att ingen bild tyst hamnar fel.

## Format

- JPG, PNG, WebP, AVIF, HEIC eller TIFF. Filnamnet styr platsen, filändelsen spelar ingen roll.
- Ladda upp så stort original du har. Rekommenderad minsta storlek står nedan.

## Bildplatser

| Fil | Var | Beskärning | Minst | Motiv |
|---|---|---|---|---|
| `hero-home.jpg` | Startsidans hero | stående 7:10 | 1290 × 1843 | Mörk, dramatisk bild (t.ex. vältränad person mot berg i skymning). Motivet i övre högra halvan. Nedre tredjedelen ska vara mörk, eftersom veckoremsan och knappen ligger där. |
| `avatar.jpg` | Profilbild | 1:1 | 192 × 192 | Ansikte, centrerat. |
| `cardio.jpg` | Cardio-hero + miniatyr | 1,55:1 och 1:1 | 1200 × 774 | Löpare eller cyklist i berg. Motivet till höger, eftersom tidringen ligger till vänster. |
| `rehab.jpg` | Rehab-hero + rehabkortet | 2,4:1 och 0,83:1 | 1200 × 500 | Fötter eller vader på ett steg (tåhävning). Motivet centrerat, så att båda beskärningarna fungerar. |
| `rest-day.jpg` | Vilodag i schemat | 4,6:1 | 800 × 174 | Lugnt, ljust berglandskap. Vänstra delen lugn. |
| `schedule/chest_back.jpg` | Schemarad Bröst + Rygg | 1,47:1 | 264 × 180 | Anatomirender av överkroppen. |
| `schedule/legs.jpg` | Schemarad Ben | 1,47:1 | 264 × 180 | Anatomirender av benen. |
| `schedule/shoulders_arms.jpg` | Schemarad Axlar + Armar | 1,47:1 | 264 × 180 | Anatomirender av axlar och armar. |
| `exercises/<id>.jpg` | Aktivt pass, bibliotek, miniatyrer | 2,1:1 och 1:1 | 1290 × 615 | Övningen i utförande, motivet centrerat. |
| `rehab/<id>.jpg` | Rehab-, prehab- och rörlighetslistor | 1:1 | 192 × 192 | Övningen i utförande. |

`<id>` är övningens id. `npm run images -- --check` listar alla, till exempel `exercises/bench-press.jpg`, `exercises/lat-pulldown.jpg` och `rehab/iso-seated.jpg`.

Beskärningen centrerar automatiskt på det mest framträdande i bilden. Hero-bilden beskärs uppifrån.

Muskelkartorna i statistiken (Muskelgrupper) och i biblioteket är datadrivna SVG:er som färgas efter din träning. De ersätts inte av foton.
