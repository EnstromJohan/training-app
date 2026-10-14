import type { AchillesLoad, Equipment, Exercise, Muscle } from "../engine/types";

function x(
  id: string,
  name: string,
  primary: Muscle,
  secondary: Muscle[],
  equipment: Equipment,
  opts: {
    compound?: boolean;
    lower?: boolean;
    achilles?: AchillesLoad;
    increment?: number;
    alt?: string[];
    how: string[];
    tips?: string[];
  },
): Exercise {
  return {
    id,
    name,
    primary,
    secondary,
    equipment,
    isCompound: opts.compound ?? false,
    lowerBody: opts.lower ?? false,
    achillesLoad: opts.achilles ?? "none",
    incrementKg: opts.increment,
    alternatives: opts.alt ?? [],
    instructions: opts.how,
    tips: opts.tips ?? [],
  };
}

const LIST: Exercise[] = [
  // ---- Bröst ----
  x("bench-press", "Bänkpress", "chest", ["triceps", "front_delts"], "barbell", {
    compound: true,
    alt: ["db-bench-press", "machine-chest-press", "smith-bench-press"],
    how: ["Skulderbladen ihop och ner, lätt svank.", "Sänk stången kontrollerat mot nedre bröstet.", "Pressa upp och något bakåt mot axlarna.", "Fötterna stabilt i golvet."],
    tips: ["Greppa stången något bredare än axelbrett.", "Håll handlederna raka över armbågarna."],
  }),
  x("db-bench-press", "Hantelpress", "chest", ["triceps", "front_delts"], "dumbbell", {
    compound: true,
    alt: ["bench-press", "machine-chest-press"],
    how: ["Hantlarna i linje med bröstet.", "Sänk djupt med kontroll.", "Pressa upp utan att slå ihop hantlarna."],
  }),
  x("smith-bench-press", "Bänkpress i smithmaskin", "chest", ["triceps", "front_delts"], "plate_machine", {
    compound: true,
    increment: 2.5,
    alt: ["bench-press", "db-bench-press"],
    how: ["Placera bänken så att stången landar på nedre bröstet.", "Kontrollerad sänkning, explosiv press."],
  }),
  x("incline-db-press", "Lutande hantelpress", "chest", ["front_delts", "triceps"], "dumbbell", {
    compound: true,
    alt: ["incline-bb-press", "smith-incline-press"],
    how: ["Bänken på 30°.", "Sänk hantlarna mot övre bröstet.", "Pressa upp i en lätt båge."],
  }),
  x("incline-bb-press", "Lutande skivstångspress", "chest", ["front_delts", "triceps"], "barbell", {
    compound: true,
    alt: ["incline-db-press", "smith-incline-press"],
    how: ["Bänken på 30°.", "Sänk stången mot övre bröstet.", "Pressa rakt upp."],
  }),
  x("smith-incline-press", "Lutande press i smithmaskin", "chest", ["front_delts", "triceps"], "plate_machine", {
    compound: true,
    increment: 2.5,
    alt: ["incline-bb-press", "incline-db-press"],
    how: ["Bänken på 30°.", "Stången mot övre bröstet."],
  }),
  x("machine-chest-press", "Bröstpress maskin", "chest", ["triceps", "front_delts"], "machine", {
    compound: true,
    alt: ["dips", "db-bench-press"],
    how: ["Handtagen i brösthöjd.", "Pressa fram utan att låsa armbågarna hårt.", "Långsam retur."],
  }),
  x("dips", "Dips", "chest", ["triceps", "front_delts"], "bodyweight", {
    compound: true,
    alt: ["machine-chest-press"],
    how: ["Luta överkroppen lätt framåt.", "Sänk tills axlarna är strax under armbågarna.", "Pressa upp. Vikten anges som extravikt."],
  }),
  x("cable-fly", "Kabelflyes", "chest", [], "cable", {
    alt: ["pec-deck"],
    how: ["Kablarna i axelhöjd, lätt böjda armbågar.", "För ihop händerna framför bröstet.", "Långsam sträckning bakåt."],
  }),
  x("pec-deck", "Pec deck", "chest", [], "machine", {
    alt: ["cable-fly"],
    how: ["Armbågarna i axelhöjd.", "Kläm ihop i toppläget en sekund.", "Kontrollerad retur."],
  }),

  // ---- Rygg ----
  x("chest-supported-row", "Bröststödd rodd", "back", ["rear_delts", "biceps"], "plate_machine", {
    compound: true,
    increment: 2.5,
    alt: ["barbell-row", "machine-row", "one-arm-db-row"],
    how: ["Bröstet mot dynan.", "Dra armbågarna bakåt mot höfterna.", "Kläm ihop skulderbladen, sänk kontrollerat."],
    tips: ["Avlastar ländryggen jämfört med fri skivstångsrodd."],
  }),
  x("barbell-row", "Skivstångsrodd", "back", ["rear_delts", "biceps"], "barbell", {
    compound: true,
    alt: ["chest-supported-row", "machine-row"],
    how: ["Fäll fram cirka 45°, rak rygg.", "Dra stången mot naveln.", "Sänk kontrollerat."],
  }),
  x("machine-row", "Roddmaskin (styrka)", "back", ["rear_delts", "biceps"], "machine", {
    compound: true,
    alt: ["chest-supported-row", "seated-cable-row"],
    how: ["Bröstet mot dynan.", "Dra handtagen mot kroppen.", "Långsam retur."],
  }),
  x("lat-pulldown", "Latsdrag", "back", ["biceps", "rear_delts"], "cable", {
    compound: true,
    alt: ["chin-up", "straight-arm-pulldown"],
    how: ["Greppa stången något bredare än axelbrett.", "Dra stången kontrollerat mot övre bröstet.", "Fokusera på att aktivera latsen och hålla bålen stabil.", "Återgå långsamt till startpositionen."],
  }),
  x("chin-up", "Chins", "back", ["biceps"], "bodyweight", {
    compound: true,
    alt: ["lat-pulldown"],
    how: ["Underhandsgrepp, axelbrett.", "Dra hakan över stången.", "Full sträckning nertill. Vikten anges som extravikt (0 = kroppsvikt)."],
  }),
  x("seated-cable-row", "Sittande kabelrodd", "back", ["biceps", "rear_delts"], "cable", {
    compound: true,
    alt: ["machine-row", "one-arm-db-row"],
    how: ["Rak rygg, lätt böjda knän.", "Dra handtaget mot magen.", "Låt skulderbladen glida fram på vägen tillbaka."],
  }),
  x("one-arm-db-row", "Enarms hantelrodd", "back", ["biceps", "rear_delts"], "dumbbell", {
    compound: true,
    alt: ["seated-cable-row", "machine-row"],
    how: ["Stöd mot bänken med hand och knä.", "Dra hanteln mot höften.", "Sträck ut helt nertill."],
  }),
  x("straight-arm-pulldown", "Raka armar, latsdrag", "back", [], "cable", {
    alt: ["lat-pulldown"],
    how: ["Raka armar, lätt framåtlutad.", "För stången i en båge mot låren."],
  }),

  // ---- Ben ----
  x("hack-squat", "Hack squat", "quads", ["glutes", "adductors"], "plate_machine", {
    compound: true,
    lower: true,
    achilles: "low",
    alt: ["leg-press", "back-squat"],
    how: ["Fötterna högt och axelbrett på plattan.", "Gå djupt med kontroll.", "Pressa upp genom hela foten."],
    tips: ["Högt fotläge minskar hälsenans belastning."],
  }),
  x("leg-press", "Benpress", "quads", ["glutes", "adductors"], "plate_machine", {
    compound: true,
    lower: true,
    achilles: "low",
    alt: ["hack-squat"],
    how: ["Fötterna axelbrett mitt på plattan.", "Sänk tills knäna är cirka 90°.", "Pressa upp utan att låsa knäna."],
    tips: ["Undvik att pressa med tårna – tryck genom hälarna."],
  }),
  x("back-squat", "Knäböj", "quads", ["glutes", "adductors"], "barbell", {
    compound: true,
    lower: true,
    achilles: "moderate",
    alt: ["hack-squat", "leg-press"],
    how: ["Stången på övre ryggen.", "Böj i höft och knä samtidigt.", "Gå till minst parallellt."],
  }),
  x("bulgarian-split-squat", "Bulgariska utfall", "quads", ["glutes"], "dumbbell", {
    compound: true,
    lower: true,
    achilles: "high",
    alt: ["leg-press", "hack-squat"],
    how: ["Bakre foten på bänk.", "Sänk rakt ner.", "Pressa upp genom främre foten."],
  }),
  x("walking-lunge", "Gående utfall", "quads", ["glutes"], "dumbbell", {
    compound: true,
    lower: true,
    achilles: "high",
    alt: ["leg-press"],
    how: ["Långa steg, knät mot golvet.", "Upprätt överkropp."],
  }),
  x("romanian-deadlift", "Rumänsk marklyft", "hamstrings", ["glutes", "back"], "barbell", {
    compound: true,
    lower: true,
    achilles: "low",
    alt: ["seated-leg-curl", "back-extension"],
    how: ["Lätt böjda knän.", "Skjut höften bakåt och sänk stången längs benen.", "Stanna när baksida lår är sträckt, res dig."],
  }),
  x("hip-thrust", "Höftlyft", "glutes", ["hamstrings"], "barbell", {
    compound: true,
    lower: true,
    achilles: "low",
    alt: ["back-extension"],
    how: ["Övre ryggen mot bänken, stången över höften.", "Pressa höften upp tills kroppen är rak.", "Håll en sekund i toppen."],
  }),
  x("leg-extension", "Benspark", "quads", [], "machine", {
    lower: true,
    alt: ["single-leg-extension"],
    how: ["Ryggen mot dynan.", "Sträck benen fullt, håll en sekund.", "Långsam sänkning."],
  }),
  x("single-leg-extension", "Enbens benspark", "quads", [], "machine", {
    lower: true,
    increment: 2.5,
    alt: ["leg-extension"],
    how: ["Ett ben i taget.", "Full sträckning, kontrollerad sänkning."],
  }),
  x("lying-leg-curl", "Liggande lårcurl", "hamstrings", [], "machine", {
    lower: true,
    alt: ["seated-leg-curl"],
    how: ["Höften mot dynan.", "Böj benen så långt det går.", "Långsam sänkning."],
  }),
  x("seated-leg-curl", "Sittande lårcurl", "hamstrings", [], "machine", {
    lower: true,
    alt: ["lying-leg-curl"],
    how: ["Lås låren under dynan.", "Böj fullt, kontrollerad retur."],
  }),
  x("adductor-machine", "Adduktormaskin", "adductors", [], "machine", {
    lower: true,
    alt: [],
    how: ["För ihop benen kontrollerat.", "Långsam retur till bra sträckning."],
  }),
  x("back-extension", "Ryggresningar", "glutes", ["hamstrings", "back"], "bodyweight", {
    lower: true,
    alt: ["romanian-deadlift"],
    how: ["Höftbenet i kanten av dynan.", "Rund lätt ner, res dig till rak kropp.", "Vikten anges som extravikt."],
  }),

  // ---- Axlar ----
  x("seated-bb-press", "Sittande skivstångspress", "front_delts", ["triceps", "side_delts"], "barbell", {
    compound: true,
    alt: ["seated-db-press", "machine-shoulder-press"],
    how: ["Ryggstöd nästan lodrätt.", "Sänk stången till hakan.", "Pressa rakt upp."],
  }),
  x("seated-db-press", "Sittande hantelpress", "front_delts", ["triceps", "side_delts"], "dumbbell", {
    compound: true,
    alt: ["seated-bb-press", "machine-shoulder-press"],
    how: ["Hantlarna i öronhöjd.", "Pressa upp och lätt inåt."],
  }),
  x("machine-shoulder-press", "Axelpress maskin", "front_delts", ["triceps", "side_delts"], "machine", {
    compound: true,
    alt: ["seated-db-press"],
    how: ["Handtagen i axelhöjd.", "Pressa upp, långsam retur."],
  }),
  x("db-lateral-raise", "Hantel-sidolyft", "side_delts", [], "dumbbell", {
    alt: ["cable-lateral-raise"],
    how: ["Lätt böjda armbågar.", "Lyft ut åt sidorna till axelhöjd.", "Långsam sänkning."],
  }),
  x("cable-lateral-raise", "Kabel-sidolyft", "side_delts", [], "cable", {
    alt: ["db-lateral-raise"],
    how: ["Kabeln lågt, dra över kroppen.", "Lyft till axelhöjd."],
  }),
  x("reverse-pec-deck", "Omvänd pec deck", "rear_delts", ["back"], "machine", {
    alt: ["face-pull"],
    how: ["Bröstet mot dynan.", "För isär armarna i en båge."],
  }),
  x("face-pull", "Facepulls", "rear_delts", ["back"], "cable", {
    alt: ["reverse-pec-deck"],
    how: ["Repet i ansiktshöjd.", "Dra mot pannan med armbågarna högt.", "Rotera ut i slutet."],
  }),

  // ---- Armar ----
  x("barbell-curl", "Skivstångscurl", "biceps", [], "barbell", {
    alt: ["cable-curl", "hammer-curl"],
    how: ["Armbågarna intill kroppen.", "Curla utan att gunga.", "Långsam sänkning."],
  }),
  x("hammer-curl", "Hammercurl", "biceps", [], "dumbbell", {
    alt: ["cable-curl"],
    how: ["Neutralt grepp.", "Curla växelvis eller samtidigt."],
  }),
  x("incline-db-curl", "Lutande hantelcurl", "biceps", [], "dumbbell", {
    alt: ["cable-curl"],
    how: ["Bänken på 45–60°.", "Armarna hänger rakt ner.", "Curla utan att flytta armbågen framåt."],
  }),
  x("preacher-curl", "Preacher curl", "biceps", [], "machine", {
    increment: 2.5,
    alt: ["cable-curl"],
    how: ["Överarmen mot dynan.", "Full sträckning nertill."],
  }),
  x("cable-curl", "Kabelcurl", "biceps", [], "cable", {
    alt: ["barbell-curl"],
    how: ["Armbågarna fixerade.", "Curla upp, långsam sänkning."],
  }),
  x("close-grip-bench", "Smal bänkpress", "triceps", ["chest"], "barbell", {
    compound: true,
    alt: ["dips", "overhead-cable-triceps"],
    how: ["Grepp axelbrett.", "Armbågarna nära kroppen.", "Sänk mot nedre bröstet."],
  }),
  x("triceps-pushdown", "Triceps pushdown", "triceps", [], "cable", {
    alt: ["overhead-cable-triceps"],
    how: ["Armbågarna intill kroppen.", "Pressa ner till full sträckning."],
  }),
  x("overhead-cable-triceps", "Overhead triceps kabel", "triceps", [], "cable", {
    alt: ["triceps-pushdown"],
    how: ["Vänd ryggen mot kabeln.", "Sträck armarna framåt-uppåt.", "Djup sträckning bakom huvudet."],
  }),
];

export const EXERCISES: Record<string, Exercise> = Object.fromEntries(LIST.map((e) => [e.id, e]));
export const EXERCISE_LIST = LIST;
