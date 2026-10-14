"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChartNoAxesColumn, Grip, HeartPulse, House } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { Onboarding } from "./onboarding";
import { cn } from "./ui";

const NAV = [
  { href: "/", label: "Hem", icon: House },
  { href: "/schedule", label: "Schema", icon: CalendarDays },
  { href: "/workout", label: "Träna", icon: HeartPulse },
  { href: "/progress", label: "Analys", icon: ChartNoAxesColumn },
  { href: "/more", label: "Mer", icon: Grip },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { s } = useStore();
  const path = usePathname();
  const darkPage = path === "/" && s.settings.onboarded;

  // Browser/status-bar colour follows the page: dark hero on home, cream elsewhere.
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = darkPage ? "#141312" : "#f2efea";
  }, [darkPage]);

  if (!s.settings.onboarded) return <Onboarding />;

  // Active workout and cardio session are full-screen, like the design.
  const immersive = path.startsWith("/workout/session");
  const dark = path === "/";
  const active = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href) || (href === "/more" && ["/cardio", "/library", "/settings", "/coach", "/rehab"].some((p) => path.startsWith(p)));

  return (
    <div className={cn("min-h-dvh", dark && "bg-hero")}>
      <div className="mx-auto min-h-dvh max-w-md">
        <main key={path} className={cn("animate-page px-4 pt-[env(safe-area-inset-top)]", immersive ? "pb-8" : "pb-28")}>
          {children}
        </main>
        {!immersive && (
          <nav
            className={cn(
              "fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md pb-[env(safe-area-inset-bottom)] backdrop-blur",
              dark ? "bg-hero/90" : "border-t border-line/70 bg-bg/95",
            )}
          >
            <ul className="flex px-2">
              {NAV.map(({ href, label, icon: Icon }) => {
                const on = active(href);
                return (
                  <li key={href} className="flex-1">
                    <Link
                      href={href}
                      className={cn(
                        "flex flex-col items-center gap-1 pb-2 pt-2.5 text-[10px]",
                        dark ? (on ? "font-semibold text-white" : "text-white/45") : on ? "font-semibold text-ink" : "text-muted",
                      )}
                    >
                      <Icon size={20} strokeWidth={on ? 2.2 : 1.6} fill={on && href === "/schedule" ? "currentColor" : "none"} className={cn(on && href === "/schedule" && (dark ? "text-white" : "[&>path]:stroke-bg"))} />
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
