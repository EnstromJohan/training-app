"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Info } from "lucide-react";
import { Sparkline } from "@/components/charts";
import { IMAGES, Photo } from "@/components/photo";
import { HeroArt } from "@/components/hero-art";
import { Card, ScreenHeader, Segmented, Sheet, cn } from "@/components/ui";
import { insights, reviewWeek, type InsightPeriod } from "@/lib/coach";
import { LOAD_LABEL, RISK_LABEL } from "@/lib/engine/weekly/insights";
import { useStore, today } from "@/lib/store";

const pctText = (p: number | null) => (p == null ? "–" : `${p >= 0 ? "+" : ""}${Math.round(p * 100)}%`);

export default function InsightsPage() {
  const { s } = useStore();
  const t = today();
  const [period, setPeriod] = useState<InsightPeriod>("week");
  const [explain, setExplain] = useState<null | "load" | "risk" | "recovery">(null);
  const i = insights(s, t, period);
  const review = reviewWeek(s, t);

  const loadTone = i.load.status === "optimal" ? "text-good" : i.load.status === "unknown" ? "text-muted" : i.load.status === "low" ? "text-warn" : "text-bad";
  const riskTone = i.risk.level === "low" ? "text-good" : i.risk.level === "moderate" ? "text-warn" : "text-bad";

  const quote =
    review.sessionsDone === 0
      ? `Ny vecka – ${review.focus[0] ?? "kör veckans första pass när du är redo."}`
      : review.tonnageDeltaPct == null
      ? `Du har genomfört ${review.sessionsDone} av ${review.sessionsPlanned} pass den här veckan. ${review.focus[0] ?? ""}`
      : `Din totala träningsvolym ${review.tonnageDeltaPct >= 0 ? "ökade" : "minskade"} med ${Math.abs(Math.round(review.tonnageDeltaPct * 100))} % mot förra veckan. ${review.focus[0] ?? ""}`;

  return (
    <div>
      <ScreenHeader title="Insikter" back />
      <Segmented
        className="flex w-full"
        value={period}
        onChange={setPeriod}
        options={[
          { value: "week", label: "Vecka" },
          { value: "month", label: "Månad" },
          { value: "year", label: "År" },
        ]}
      />

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Card className="p-3.5">
          <div className="text-[12px] text-ink-2">Styrkeutveckling</div>
          <div className={cn("tabular mt-0.5 text-[24px] font-bold", i.strength.pct != null && i.strength.pct < 0 && "text-bad")}>{pctText(i.strength.pct)}</div>
          <div className="mt-1">
            <Sparkline values={i.strength.series} color="#ff8a3d" />
          </div>
        </Card>
        <Card className="p-3.5">
          <div className="text-[12px] text-ink-2">Cardioförmåga</div>
          <div className={cn("tabular mt-0.5 text-[24px] font-bold", i.cardio.pct != null && i.cardio.pct < 0 && "text-bad")}>{pctText(i.cardio.pct)}</div>
          <div className="mt-1">
            <Sparkline values={i.cardio.series} color="#4ade80" />
          </div>
        </Card>
        <button onClick={() => setExplain("recovery")} className="text-left">
          <Card className="h-full p-3.5">
            <div className="text-[12px] text-ink-2">Återhämtning</div>
            <div className="tabular mt-0.5 text-[24px] font-bold">
              {i.recovery == null ? "–" : i.recovery.toLocaleString("sv-SE", { maximumFractionDigits: 1 })}
              <span className="text-[14px] font-medium text-muted">/10</span>
            </div>
          </Card>
        </button>
        <Card className="p-3.5">
          <div className="text-[12px] text-ink-2">Sömn</div>
          <div className="tabular mt-0.5 text-[24px] font-bold">
            {i.sleepHours == null ? "–" : i.sleepHours.toLocaleString("sv-SE", { maximumFractionDigits: 1 })}
            <span className="text-[14px] font-medium text-muted"> h</span>
          </div>
        </Card>
        <button onClick={() => setExplain("load")} className="text-left">
          <Card className="h-full p-3.5">
            <div className="flex items-center justify-between text-[12px] text-ink-2">
              Belastning <Info size={13} className="text-muted" />
            </div>
            <div className={cn("mt-0.5 text-[22px] font-bold", loadTone)}>{LOAD_LABEL[i.load.status]}</div>
          </Card>
        </button>
        <button onClick={() => setExplain("risk")} className="text-left">
          <Card className="h-full p-3.5">
            <div className="flex items-center justify-between text-[12px] text-ink-2">
              Skaderisk <Info size={13} className="text-muted" />
            </div>
            <div className={cn("mt-0.5 text-[22px] font-bold", riskTone)}>{RISK_LABEL[i.risk.level]}</div>
          </Card>
        </button>
      </div>

      <Card className="mt-3 p-3">
        <div className="mb-2 text-[12px] text-ink-2">Coach</div>
        <div className="flex gap-3">
          <Photo
            slot={IMAGES.schedule("shoulders_arms")}
            sizes="88px"
            alt=""
            className="h-[104px] w-[88px] shrink-0 rounded-[14px] border border-line"
            fallback={<HeroArt />}
          />
          <div className="min-w-0">
            <p className="text-[14px] leading-snug text-ink">&ldquo;{quote.trim()}&rdquo;</p>
            <Link href="/coach" className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-accent">
              Se rekommendationer <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </Card>
      <p className="mt-2 px-1 text-[11px] text-muted">Coachen är regelbaserad: varje råd kommer från din loggade träning, inte från gissningar.</p>

      <Sheet open={explain === "load"} onClose={() => setExplain(null)} title="Belastning">
        <div className="space-y-2 text-[14px] text-ink-2">
          <p>
            Jämför senaste 7 dagarnas belastning med snittet för de senaste 4 veckorna (minuter × ansträngning för styrka och cardio).
          </p>
          <p>
            Kvot: <b className="text-ink">{i.load.ratio == null ? "–" : i.load.ratio.toLocaleString("sv-SE", { maximumFractionDigits: 2 })}</b>. 0,8–1,3 är optimalt. Över 1,5 innebär en snabb ökning som ofta ger överbelastning.
          </p>
          {i.load.status === "unknown" && <p>Behöver minst 3 veckors data.</p>}
        </div>
      </Sheet>
      <Sheet open={explain === "risk"} onClose={() => setExplain(null)} title="Skaderisk (uppskattad)">
        <div className="space-y-2 text-[14px] text-ink-2">
          {i.risk.reasons.length ? (
            <ul className="list-disc space-y-1 pl-5">
              {i.risk.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : (
            <p>Inga varningssignaler senaste veckan.</p>
          )}
          <p className="text-[12px] text-muted">
            Vägs samman av belastningsökning, hälsenans smärta och stelhet samt återhämtning. Det är en signal att ta det lugnare – inte en diagnos. Vid smärta: kontakta din fysioterapeut.
          </p>
        </div>
      </Sheet>
      <Sheet open={explain === "recovery"} onClose={() => setExplain(null)} title="Återhämtning">
        <p className="text-[14px] text-ink-2">Snittet av din dagsform (sömn, energi och träningsvärk) före passen i perioden, omräknat till 0–10.</p>
      </Sheet>
    </div>
  );
}
