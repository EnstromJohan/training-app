import { Suspense } from "react";
import { WorkoutView } from "./workout-view";

// Static route (id in the query string) so the active workout works fully offline.
export default function WorkoutSessionPage() {
  return (
    <Suspense>
      <WorkoutView />
    </Suspense>
  );
}
