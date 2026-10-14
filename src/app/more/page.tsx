"use client";

import Link from "next/link";
import { Activity, BookOpen, ChevronRight, Footprints, Settings, Sparkles } from "lucide-react";
import { Card, ScreenHeader } from "@/components/ui";

const LINKS = [
  { href: "/cardio", label: "Cardio", sub: "Dagens konditionspass och utveckling", icon: Activity },
  { href: "/coach", label: "Coach", sub: "Veckorapport och rekommendationer", icon: Sparkles },
  { href: "/rehab", label: "Rehab & Prehab", sub: "Hälsenans belastningstrappa", icon: Footprints },
  { href: "/library", label: "Övningsbibliotek", sub: "Övningar, muskler och alternativ", icon: BookOpen },
  { href: "/settings", label: "Inställningar", sub: "Profil, utrustning, skador, data", icon: Settings },
];

export default function More() {
  return (
    <div>
      <ScreenHeader title="Mer" />
      <div className="space-y-2">
        {LINKS.map(({ href, label, sub, icon: Icon }) => (
          <Link key={href} href={href} className="block">
            <Card className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-card-2"><Icon size={20} /></span>
              <div className="flex-1">
                <div className="font-medium">{label}</div>
                <div className="text-xs text-muted">{sub}</div>
              </div>
              <ChevronRight size={18} className="text-muted" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
