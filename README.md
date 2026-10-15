# Träning – personlig tränare med automatisk progression

Mobilanpassad webbapp (Next.js 15, TypeScript, Tailwind) som planerar, autofyller, loggar och progresserar ett 6-dagars program: styrka, tre cardiopass per vecka och hälsene-rehab.

## Kom igång

```bash
npm install
npm run dev        # http://localhost:3000 – öppna i mobilvy eller på telefonen
npm test           # progressionsmotorernas tester (Vitest)
npm run typecheck
```

Övriga kommandon:

```bash
npm run images     # optimera bilder från assets/images (se assets/images/README.md)
npm run icons      # generera appikoner (iOS/Android/flik)
npm run build      # produktionsbygge; genererar även public/sw.js (offline)
```

## Bilder

Lägg egna foton i `assets/images/` och kör `npm run images`. Skriptet gör följande:
- Beskär, optimerar och versionerar bilderna, och skriver `src/lib/images/manifest.json`.
- Visar genererad grafik där en bild saknas. Inga trasiga bilder och inga onödiga anrop.

Filnamn, format och motivguide finns i [assets/images/README.md](assets/images/README.md).

## Offline

Produktionsbygget registrerar en service worker som förcachar alla sidor. Ett pass kan startas, loggas, laddas om och avslutas helt utan nät. Allt synkas när nätet är tillbaka.

Uppdateringar aktiveras först när appen har stängts helt, så att ett pågående pass aldrig avbryts av en ny version.

Appen fungerar direkt utan databas. All historik sparas i webbläsarens IndexedDB på enheten, och varje set skrivs lokalt innan något annat händer.

### Supabase (permanent lagring och synk)

1. Starta Docker Desktop och kör `npx supabase start`.
2. Kopiera `API URL` och `anon key` till `.env.local` (se `.env.example`).
3. Kör `npx supabase db reset` för att applicera `supabase/migrations/`.
4. Kör även `supabase/migrations/20261015000000_body_photos_mobility.sql`. Den behövs för kroppsmått, progressionsfoton (ett privat lagringsutrymme) och rörlighetsloggar. Tills den är körd sparas den datan bara på enheten, och appen visar en varning.
5. Kör `supabase/migrations/20261016000000_body_estimates.sql` (längd, kön och AI-uppskattningar).
6. Logga in under **Inställningar → Övrigt** med magic link.

### AI-uppskattning av kroppsfett (valfritt)

Lägg `ANTHROPIC_API_KEY` i `.env.local`, eller som miljövariabel på servern vid deploy. Nyckeln används bara i server-routen `/api/body-estimate` och når aldrig webbläsaren.

Routen kräver att du är inloggad, begränsar till 20 analyser per dag och sparar inte bilden. Fotot skalas ner till 1024 px utan metadata innan det skickas, och bara efter att du gett samtycke i appen. Modellen är Claude Opus 5.5 med strukturerat svar. Resultatet är ett intervall som sparas på fotot. Lokala data pushas automatiskt, och synken körs i bakgrunden efter varje ändring och när nätet kommer tillbaka.

Tabellerna har RLS per användare och ingen delete-policy. Historik kan alltså inte hårdraderas från klienten. Under Inställningar → Data finns också JSON-export och JSON-import.

## Deploy (Cloudflare Workers)

Appen körs på Cloudflare Workers via [OpenNext](https://opennext.js.org/cloudflare). Konfigurationen finns i `wrangler.jsonc` och `open-next.config.ts`.

- `npm run preview` bygger appen och kör den lokalt i Workers-miljön på http://localhost:8787.
- `npm run deploy` bygger och deployar. Kör `npx wrangler login` första gången.

Vid Git-kopplad deploy (Workers & Pages → Create → Import a repository):

| Fält | Värde |
|---|---|
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx opennextjs-cloudflare deploy` |
| Non-production branch deploy command | `npx opennextjs-cloudflare upload` |

Projektnamnet måste vara `training-app`, samma som `name` i `wrangler.jsonc`.

**Variabler:**
- `NEXT_PUBLIC_SUPABASE_URL` och `NEXT_PUBLIC_SUPABASE_ANON_KEY` läggs som *build variables*, eftersom de bakas in i klienten vid bygget.
- `ANTHROPIC_API_KEY` läggs som *secret* under Variables and Secrets, eller med `npx wrangler secret put ANTHROPIC_API_KEY`.

Lägg också in den nya adressen i Supabase under Authentication → URL Configuration, både som Site URL och som Redirect URL, annars fungerar inte magic link.

## Arkitektur

| Del | Plats |
|---|---|
| Progressionsmotor styrka (dubbel progression, kalibrering, platå, deload, volym, uppvärmning, viktsteg) | `src/lib/engine/strength/` |
| Cardiomotor (Zone 2-progression, intervaller, 10 % lastspärr, pulszoner, hälsenespärr) | `src/lib/engine/cardio/` |
| Hälsene-rehab (5 faser, smärtmonitorering) | `src/lib/engine/rehab/achilles.ts` |
| Veckokö och veckoanalys | `src/lib/engine/weekly/` |
| Program och övningsbibliotek | `src/lib/program/` |
| Kopplingen mellan motorer och lagrad data | `src/lib/coach.ts` |
| Lokal lagring, synk och store | `src/lib/db/`, `src/lib/store.tsx` |

Motorerna är rena funktioner med tydliga regler. Varje rekommendation har en reason code med en förklaring på svenska som visas i appen. Historiken är källan till sanningen, och nästa pass räknas alltid fram från den.

## Funktioner

- **Hem:** veckans pass med ring, räknare för styrka, cardio och rörlighet, nästa pass med uppskattad längd och volym per dag.
- **Aktivt pass:** settabell med förifyllda värden, editor för reps, vikt och RIR, vilotimer, rehab under vilan, historik, video (YouTube-sökning) och byte av övning.
- **Cardio:** Zone 2, intervaller, backe och långpass, med timer, ljudsignaler och skärmlås.
- **Analys:**
  - Min utveckling.
  - Muskelgrupper: volym mot veckomål, utveckling och symmetri.
  - Insikter: styrka, kondition, återhämtning, sömn, belastning (ACWR) och uppskattad skaderisk.
  - Kropp: vikt, kroppsfett, muskelmassa, mått, progressionsfoton och komposition.
- **Kroppsfett från tre källor:** smart våg, midjemått (RFM: 64/76 − 20 × längd/midja) och AI-uppskattning från foto (intervall). De visas var för sig så att trenden kan följas inom samma metod.
- **Rehab & Prehab:** hälsenans belastningstrappa samt förebyggande övningar och rörlighet. Rörlighet räknas mot veckomålet.

Bilderna graderas automatiskt till mörkt tema i `npm run images` (se `grades` i `src/lib/images/slots.json`).

## Regler i korthet

- **Styrka:**
  - Reps ökar inom intervallet. När alla set når toppen med RIR ≥ målet och godkänd teknik ökar vikten med minsta tillgängliga steg.
  - 5 kg-steg används bara för tunga ben- och höftlyft, och bara när steget är ≤ 5 % av arbetsvikten. Dubbelt steg tas om det var mycket lätt, men aldrig över +10 %.
  - Missade reps: första gången behålls vikten. Två pass i rad ger −7,5 %.
  - Tre pass utan högre e1RM räknas som platå. Åtgärderna trappas upp: byt repintervall, sedan variant, sedan minskad volym.
  - Låg dagsform skjuter upp viktökningen och tar bort ett set.
  - Deload utlöses när ≥ 30 % av övningarna stagnerat, vid låg återhämtning två veckor i rad, eller efter 6 veckor.
  - Utan historik räknas startvikten fram från en nylig prestation. Appen hittar aldrig på vikter.
- **Cardio:**
  - Zone 2 innebär RPE 3–4 och att du klarar samtalstestet. Tiden ökar +2–3 min per pass upp till 45 min (A/B) eller 60 min (C), därefter ökar intensiteten.
  - Två för tunga pass i rad ger −10 % tid.
  - Veckobelastningen får öka högst 10 % jämfört med snittet för de senaste fyra veckorna.
  - Intervaller låses upp efter fyra genomförda Zone 2-pass på minst 30 min, och läggs aldrig dagen före ett benpass.
- **Hälsena:**
  - Löpning, hopp och övningar med hög hälsenebelastning är spärrade tills rätt rehabfas och klartecken finns.
  - Nivån styrs av smärta under passet (≤ 5/10) och morgonen efter.
  - Fasbyten kräver att du bekräftar att fysio har godkänt.
