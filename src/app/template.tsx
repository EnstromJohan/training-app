"use client";

import * as m from "motion/react-m";
import type { ReactNode } from "react";
import { pageIn } from "@/lib/motion";

/**
 * Re-mounts on every navigation, so each screen gets a short entrance. The transform is cleared
 * when the animation ends: a lingering `transform` would make this the containing block for
 * `position: fixed` sheets and trap them under the bottom nav.
 */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <m.div {...pageIn} transformTemplate={(_, generated) => (generated === "none" || generated === "translateY(0px)" ? "none" : generated)}>
      {children}
    </m.div>
  );
}
