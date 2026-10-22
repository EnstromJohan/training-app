"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChartNoAxesColumnIncreasing, Dumbbell, Ellipsis, House } from "lucide-react";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { Onboarding } from "./onboarding";
import { cn } from "./ui";

const NAV = [
  { href: "/", label: "Hem", icon: House, match: (p: string) => p === "/" },
  { href: "/schedule", label: "Schema", icon: CalendarDays, match: (p: string) => p.startsWith("/schedule") },
  { href: "/workout", label: "Träna", icon: Dumbbell, match: (p: string) => p.startsWith("/workout") || p.startsWith("/cardio") },
  {
    href: "/progress",
    label: "Analys",
    icon: ChartNoAxesColumnIncreasing,
    match: (p: string) => ["/progress", "/insights", "/muscles", "/body", "/coach"].some((x) => p.startsWith(x)),
  },
  { href: "/more", label: "Mer", icon: Ellipsis, match: (p: string) => ["/more", "/library", "/settings", "/rehab"].some((x) => p.startsWith(x)) },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { s } = useStore();
  const path = usePathname();
  if (!s.settings.onboarded) return <Onboarding />;

  // The active workout is full-screen, like the design.
  const immersive = path.startsWith("/workout/session");

  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto min-h-dvh max-w-md">
        <main className={cn("px-4 pt-[env(safe-area-inset-top)]", immersive ? "pb-8" : "pb-28")}>
          {children}
        </main>
        {!immersive && (
          <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-line bg-[#0c0c0c]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
            <ul className="flex px-2">
              {NAV.map(({ href, label, icon: Icon, match }) => {
                const on = match(path);
                return (
                  <li key={href} className="flex-1">
                    <Link
                      href={href}
                      aria-current={on ? "page" : undefined}
                      className={cn("flex flex-col items-center gap-1 pb-2 pt-2.5 text-[10px]", on ? "font-semibold text-accent" : "text-muted")}
                    >
                      <Icon size={21} strokeWidth={on ? 2.1 : 1.6} style={on ? { filter: "drop-shadow(0 0 6px rgba(255,138,61,0.7))" } : undefined} />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
}
