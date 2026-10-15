# Bildprompter

Färdiga prompter för varje bildplats, skrivna för att matcha mockupen. De fungerar i Midjourney, ChatGPT (bildgenerering), Flux med flera. Prompterna är på engelska, eftersom bildmodellerna ger bäst resultat då.

## Så gör du

1. **Bifoga mockupen som stilreferens.** I Midjourney: `--sref <bild-url>`. I ChatGPT: bifoga bilden och skriv "match the photographic style of the attached reference".
2. **Kör en serie i taget**, alla övningar efter varandra, och återanvänd samma stilreferens och seed. Då blir serien enhetlig.
3. **Generera i så hög upplösning som möjligt.** Minsta storlek står i [README.md](README.md).
4. **Spara med exakt filnamn** enligt tabellerna nedan, till exempel `exercises/bench-press.jpg`, och kör `npm run images`.
5. **Kontrollera** i appen. Sitter motivet fel i en beskärning, generera om med justerad placering.

Bildformaten (`--ar`) är valda så att appens automatiska beskärningar har marginal. Ändra dem inte.

Lägg till följande i slutet av **alla** prompter:

```
no text, no letters, no logos, no watermark, no UI elements
```

---

## 1. Startsidans hero – `hero-home.jpg`

Den viktigaste bilden. Den ska bära hela startsidan, precis som i mockupen.

```
Cinematic dark fitness portrait of a muscular athletic man seen from behind in three-quarter view,
shirtless, standing on a mountain ridge at dusk, head slightly turned, dramatic overcast sky,
warm amber rim light outlining the shoulders and back muscles, desaturated cool shadows with
peach-amber highlights, subject placed in the upper right half of the frame, upper left area calm
dark sky with empty space, lower third of the image fades into near-black shadow,
moody high-end editorial photography, 85mm lens, shallow depth of field, ultra detailed skin texture
--ar 7:10
```

> Varför: hälsningen ligger uppe till vänster, veckoremsan och "Starta pass" i nedre tredjedelen. Den delen måste vara mörk för att texten ska synas.

## 2. Cardio – `cardio.jpg`

Bilden används både som hero (1,55:1) och som kvadratisk miniatyr.

```
Trail runner in black athletic wear running on a mountain path toward the camera's right,
golden hour light, majestic alpine peaks and valley in the background, runner positioned on the
right third of the frame, left half open landscape and sky, warm natural colors, crisp detail,
cinematic outdoor sports photography, 35mm
--ar 16:10
```

Vill du hellre ha cykel, som du faktiskt kör under rehaben, byt första raden mot `Cyclist on a road bike climbing a mountain pass`.

> Varför: tidringen ligger över vänstra halvan.

## 3. Rehab – `rehab.jpg`

Bilden används både som bred hero (2,4:1) och som smal kortbild (0,83:1). Motivet måste därför sitta mitt i bilden.

```
Close-up of a person's lower legs and feet in black training sneakers performing a calf raise on the
edge of a black plyometric box, heels slightly raised, light grey concrete gym floor, soft natural
daylight, clean minimal composition, subject centered, shallow depth of field, calm premium
fitness photography
--ar 3:2
```

## 4. Vilodag – `rest-day.jpg`

```
Serene misty mountain landscape at dawn, soft pale pastel light, layered ridges fading into haze,
minimal and calm, high-key, lots of empty soft sky on the left side, gentle warm tones
--ar 21:9
```

## 5. Schemaminiatyrer – `schedule/*.jpg`

Gör alla tre i samma körning med samma seed.

| Fil | Prompt |
|---|---|
| `schedule/chest_back.jpg` | `3D anatomical render of a male human torso, chest and upper back muscles highlighted in glowing warm orange, all other muscles in neutral grey, dark charcoal background, soft studio lighting, medical illustration style, centered, high detail --ar 3:2` |
| `schedule/legs.jpg` | `3D anatomical render of male human legs from hips to knees, quadriceps and hamstrings highlighted in glowing warm orange, other muscles neutral grey, dark charcoal background, soft studio lighting, medical illustration style, centered, high detail --ar 3:2` |
| `schedule/shoulders_arms.jpg` | `3D anatomical render of a male human upper body, deltoids biceps and triceps highlighted in glowing teal blue, other muscles neutral grey, dark charcoal background, soft studio lighting, medical illustration style, centered, high detail --ar 3:2` |

---

## 6. Övningsbilder – `exercises/<id>.jpg`

Stilen är den svartvita studiobilden av bänkpress i mockupen. Den blir enklast att hålla enhetlig över alla 45 bilder.

**Mall.** Byt `{EXERCISE}` mot texten i tabellen:

```
Monochrome black-and-white studio fitness photograph of an athletic muscular man performing
{EXERCISE}, side view, the person and all equipment fully in frame, subject occupying the central
60 % of the image with generous margin on all sides, light warm-grey seamless studio background,
soft diffused key light, crisp detail, high-end editorial fitness photography
--ar 16:9
```

> Varför: bilden används både som bred bild (2,1:1) och som kvadratisk miniatyr. Med motivet i mitten fungerar båda beskärningarna.

| Fil | `{EXERCISE}` |
|---|---|
| `exercises/bench-press.jpg` | a barbell bench press on a flat bench, bar above the chest |
| `exercises/db-bench-press.jpg` | a dumbbell bench press on a flat bench |
| `exercises/smith-bench-press.jpg` | a flat bench press in a Smith machine |
| `exercises/incline-db-press.jpg` | an incline dumbbell press on a 30-degree bench |
| `exercises/incline-bb-press.jpg` | an incline barbell bench press on a 30-degree bench |
| `exercises/smith-incline-press.jpg` | an incline press in a Smith machine |
| `exercises/machine-chest-press.jpg` | a seated machine chest press |
| `exercises/dips.jpg` | chest dips on parallel bars, torso leaning slightly forward |
| `exercises/cable-fly.jpg` | a standing cable chest fly between two cable towers |
| `exercises/pec-deck.jpg` | a pec deck machine fly, seated |
| `exercises/chest-supported-row.jpg` | a chest-supported T-bar row, chest on the pad |
| `exercises/barbell-row.jpg` | a bent-over barbell row, torso at 45 degrees |
| `exercises/machine-row.jpg` | a seated machine row with chest pad |
| `exercises/lat-pulldown.jpg` | a lat pulldown, seen from behind, bar pulled to the upper chest |
| `exercises/chin-up.jpg` | a chin-up with underhand grip, chin above the bar |
| `exercises/seated-cable-row.jpg` | a seated cable row with V-handle |
| `exercises/one-arm-db-row.jpg` | a one-arm dumbbell row with knee and hand on a bench |
| `exercises/straight-arm-pulldown.jpg` | a straight-arm cable pulldown, standing |
| `exercises/hack-squat.jpg` | a hack squat in a hack squat machine, feet high on the platform |
| `exercises/leg-press.jpg` | a 45-degree leg press machine |
| `exercises/back-squat.jpg` | a barbell back squat at parallel depth |
| `exercises/bulgarian-split-squat.jpg` | a Bulgarian split squat with dumbbells, rear foot on a bench |
| `exercises/walking-lunge.jpg` | walking lunges holding dumbbells |
| `exercises/romanian-deadlift.jpg` | a Romanian deadlift with barbell, hips hinged back |
| `exercises/hip-thrust.jpg` | a barbell hip thrust, upper back on a bench |
| `exercises/leg-extension.jpg` | a seated leg extension machine, legs extended |
| `exercises/single-leg-extension.jpg` | a single-leg extension on a leg extension machine |
| `exercises/lying-leg-curl.jpg` | a lying leg curl machine |
| `exercises/seated-leg-curl.jpg` | a seated leg curl machine |
| `exercises/adductor-machine.jpg` | a seated hip adductor machine |
| `exercises/back-extension.jpg` | a 45-degree back extension on a hyperextension bench |
| `exercises/seated-bb-press.jpg` | a seated barbell overhead press on an upright bench |
| `exercises/seated-db-press.jpg` | a seated dumbbell shoulder press |
| `exercises/machine-shoulder-press.jpg` | a seated machine shoulder press |
| `exercises/db-lateral-raise.jpg` | a standing dumbbell lateral raise, arms at shoulder height |
| `exercises/cable-lateral-raise.jpg` | a single-arm cable lateral raise |
| `exercises/reverse-pec-deck.jpg` | a reverse pec deck rear-delt fly |
| `exercises/face-pull.jpg` | a cable face pull with rope at face height |
| `exercises/barbell-curl.jpg` | a standing barbell biceps curl |
| `exercises/hammer-curl.jpg` | a standing dumbbell hammer curl |
| `exercises/incline-db-curl.jpg` | an incline dumbbell curl on a 45-degree bench |
| `exercises/preacher-curl.jpg` | a preacher curl on a preacher bench |
| `exercises/cable-curl.jpg` | a standing cable biceps curl |
| `exercises/close-grip-bench.jpg` | a close-grip barbell bench press |
| `exercises/triceps-pushdown.jpg` | a standing cable triceps pushdown |
| `exercises/overhead-cable-triceps.jpg` | an overhead cable triceps extension facing away from the cable |

Prioritera övningarna i ditt program. De andra är alternativ och syns bara om du byter övning:
`bench-press`, `chest-supported-row`, `incline-db-press`, `lat-pulldown`, `cable-fly`, `hack-squat`, `romanian-deadlift`, `leg-extension`, `lying-leg-curl`, `adductor-machine`, `seated-bb-press`, `db-lateral-raise`, `barbell-curl`, `close-grip-bench`, `reverse-pec-deck`, `hammer-curl`, `triceps-pushdown`, `incline-bb-press`, `chin-up`, `machine-chest-press`, `seated-cable-row`, `pec-deck`, `one-arm-db-row`, `leg-press`, `hip-thrust`, `seated-leg-curl`, `single-leg-extension`, `back-extension`, `seated-db-press`, `cable-lateral-raise`, `incline-db-curl`, `overhead-cable-triceps`, `face-pull`, `preacher-curl`.

---

## 7. Rehab-, prehab- och rörlighetsövningar – `rehab/<id>.jpg`

Samma stil som rehab-heron: färgfoto, ljus bakgrund, svarta skor.

**Mall:**

```
Clean color fitness photograph of a person performing {EXERCISE}, black training sneakers and
dark athletic wear, light grey concrete gym floor and soft white wall, soft natural daylight,
subject centered with margin on all sides, calm premium physiotherapy style
--ar 1:1
```

| Fil | `{EXERCISE}` |
|---|---|
| `rehab/iso-seated.jpg` | an isometric seated calf press on a seated calf raise machine, close-up on lower legs |
| `rehab/ankle-rom.jpg` | active ankle circles while seated, close-up on foot |
| `rehab/seated-raise.jpg` | seated calf raises without weight, close-up on lower legs |
| `rehab/bilateral-raise.jpg` | double-leg calf raises on flat floor, close-up on lower legs |
| `rehab/iso-standing.jpg` | an isometric standing calf raise hold, heels half raised, close-up on lower legs |
| `rehab/bilateral-step.jpg` | double-leg calf raises on the edge of a step, close-up on lower legs |
| `rehab/single-raise.jpg` | a single-leg calf raise on flat floor, hand on wall for balance |
| `rehab/seated-calf.jpg` | a weighted seated calf raise machine |
| `rehab/single-step.jpg` | a single-leg calf raise on the edge of a step |
| `rehab/standing-calf.jpg` | a standing calf raise machine, slow controlled movement |
| `rehab/eccentric-step.jpg` | an eccentric heel drop on the edge of a step, one heel lowering below the step |
| `rehab/pogo.jpg` | low double-leg pogo hops, both feet just off the floor |
| `rehab/rope.jpg` | light jump rope skipping |
| `rehab/pogo-single.jpg` | low single-leg pogo hops |
| `rehab/glute-bridge-single.jpg` | a single-leg glute bridge on a mat |
| `rehab/side-plank.jpg` | a side plank on a mat |
| `rehab/tibialis-raise.jpg` | tibialis raises with back against a wall, toes lifted |
| `rehab/copenhagen-short.jpg` | a short-lever Copenhagen plank with the knee on a bench |
| `rehab/band-pull-apart.jpg` | a resistance band pull-apart at chest height |
| `rehab/knee-to-wall.jpg` | a knee-to-wall ankle mobility drill, close-up on foot and knee |
| `rehab/hip-flexor.jpg` | a half-kneeling hip flexor stretch |
| `rehab/thoracic-rotation.jpg` | an open-book thoracic rotation lying on the side |
| `rehab/calf-stretch-bent.jpg` | a bent-knee calf stretch against a wall |
| `rehab/hamstring-floss.jpg` | a seated hamstring nerve glide |

---

## Profilbild – `avatar.jpg`

Ta ett eget foto, ansiktet centrerat. Det behövs ingen genererad bild här.
