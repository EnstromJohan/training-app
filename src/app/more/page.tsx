"use client";

import Link from "next/link";
import { Activity, BookOpen, ChevronRight, Footprints, Ruler, Settings, Sparkles, Target } from "lucide-react";
import { IconCircle, ScreenHeader } from "@/components/ui";

const LINKS = [
  { href: "/insights", label: "Insikter", sub: "Belastning, skaderisk, sömn och coach", icon: Sparkles },
  { href: "/muscles", label: "Muskelgrupper", sub: "Volym, utveckling och symmetri", icon: Target },
  { href: "/body", label: "Kropp & mätningar", sub: "Vikt, kroppsfett, mått och foton", icon: Ruler },
  { href: "/cardio", label: "Cardio", sub: "Veckans konditionspass", icon: Activity },
  { href: "/rehab", label: "Rehab & Prehab", sub: "Hälsena, förebyggande och rörlighet", icon: Footprints },
  { href: "/library", label: "Övningar", sub: "Bibliotek, muskler och alternativ", icon: BookOpen },
  { href: "/settings", label: "Mål & Inställningar", sub: "Mål, utrustning, skador och data", icon: Settings },
];

export default function More() {
  return (
    <div>
      <ScreenHeader title="Mer" />
      <div className="space-y-2">
        {LINKS.map(({ href, label, sub, icon: Icon }) => (
          <Link key={href} href={href} className="surface flex items-center gap-3 rounded-[18px] p-3">
            <IconCircle className="text-accent">
              <Icon size={19} strokeWidth={1.7} />
            </IconCircle>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold">{label}</div>
              <div className="truncate text-[12px] text-muted">{sub}</div>
            </div>
            <ChevronRight size={18} className="text-muted" />
          </Link>
        ))}
      </div>
    </div>
  );
}
