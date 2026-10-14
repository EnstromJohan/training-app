import type { RehabExercise } from "../engine/rehab/achilles";

const x = (id: string, name: string, dose: string, cue: string): RehabExercise => ({ id, name, dose, sets: 0, cue });

/** General injury prevention, Achilles-friendly (no jumping or running). */
export const PREHAB: RehabExercise[] = [
  x("glute-bridge-single", "Enbens höftlyft", "3 × 12 / sida", "Pressa genom hälen, håll bäckenet rakt."),
  x("side-plank", "Sidoplanka", "3 × 30 s / sida", "Rak linje från huvud till fötter."),
  x("tibialis-raise", "Tåhävning bakåt (tibialis)", "2 × 15", "Ryggen mot väggen, lyft tårna."),
  x("copenhagen-short", "Copenhagen, kort hävstång", "2 × 20 s / sida", "Knät på bänken – skonar fotleden."),
  x("band-pull-apart", "Band pull-apart", "2 × 20", "Skulderbladen bakåt och ner."),
];

export const MOBILITY: RehabExercise[] = [
  x("knee-to-wall", "Knä mot vägg (fotled)", "2 × 10 / sida", "Bara inom smärtfritt omfång."),
  x("hip-flexor", "Höftböjarstretch", "2 × 45 s / sida", "Spänn sätet på bakre benet."),
  x("thoracic-rotation", "Bröstryggsrotation", "2 × 10 / sida", "Följ handen med blicken."),
  x("calf-stretch-bent", "Vadstretch, böjt knä", "2 × 30 s", "Mjukt – ingen smärta i senan."),
  x("hamstring-floss", "Baksida lår, glidning", "2 × 10 / sida", "Lugna rörelser."),
];
