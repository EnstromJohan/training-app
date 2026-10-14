import { notFound } from "next/navigation";
import { EXERCISE_LIST, EXERCISES } from "@/lib/program/exercises";
import { ExerciseDetail } from "./exercise-detail";

// Every exercise page is pre-rendered at build time (works offline, no server work per visit).
export const dynamicParams = false;

export function generateStaticParams() {
  return EXERCISE_LIST.map((e) => ({ id: e.id }));
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!EXERCISES[id]) notFound();
  return <ExerciseDetail id={id} />;
}
