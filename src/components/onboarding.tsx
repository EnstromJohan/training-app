"use client";

import { useState } from "react";
import { ACHILLES_PHASES } from "@/lib/engine/rehab/achilles";
import { supabase } from "@/lib/db/supabase";
import { useStore, today } from "@/lib/store";
import { LoginForm } from "./login-form";
import { Button, Card, Scale, Stepper, cn } from "./ui";

export function Onboarding() {
  const { s, updateSettings } = useStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(s.settings.name);
  const [birthYear, setBirthYear] = useState<number>(s.settings.birthYear ?? 1990);
  const [bodyWeight, setBodyWeight] = useState<number>(s.settings.bodyWeightKg ?? 80);
  const [restingHr, setRestingHr] = useState<number>(s.settings.restingHr ?? 60);
  const [heightCm, setHeightCm] = useState<number>(s.settings.heightCm ?? 180);
  const [sex, setSex] = useState<"male" | "female" | null>(s.settings.sex ?? null);
  const [phase, setPhase] = useState(s.settings.rehab.phase);
  const [baseline, setBaseline] = useState(s.settings.rehab.baselineMorningPain);
  const [eq, setEq] = useState(s.settings.equipment);

  const finish = () =>
    updateSettings({
      onboarded: true,
      name: name.trim(),
      birthYear,
      bodyWeightKg: bodyWeight,
      heightCm,
      sex,
      restingHr,
      equipment: eq,
      rehab: {
        ...s.settings.rehab,
        phase,
        phaseStartedAt: today(),
        baselineMorningPain: baseline,
        approvedPhases: Array.from({ length: phase }, (_, i) => i + 1),
      },
    });

  const steps = [
    <div key="0" className="space-y-4">
      <h1 className="text-[40px] font-bold leading-[1.02] tracking-tight">Din personliga tränare</h1>
      <p className="text-ink-2">
        Appen planerar varje pass, fyller i vikter, reps och cardio – och justerar nästa pass efter vad du faktiskt presterade.
      </p>
      <Card className="space-y-3">
        <label className="block">
          <span className="text-xs text-muted">Förnamn</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Johan"
            className="mt-1 h-12 w-full rounded-2xl border border-line bg-card-2 px-4 text-lg outline-none"
          />
        </label>
        <Stepper label="Födelseår" value={birthYear} onChange={setBirthYear} step={1} />
        <Stepper label="Kroppsvikt" value={bodyWeight} onChange={setBodyWeight} step={0.5} unit="kg" />
        <Stepper label="Längd" value={heightCm} onChange={(v) => setHeightCm(Math.min(230, Math.max(120, v)))} step={1} unit="cm" />
        <div className="flex gap-1.5">
          {(
            [
              ["male", "Man"],
              ["female", "Kvinna"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              aria-pressed={sex === v}
              onClick={() => setSex(v)}
              className={cn("h-10 flex-1 rounded-full text-[13px] font-medium", sex === v ? "bg-accent-grad text-on-accent" : "border border-line bg-card-2 text-ink-2")}
            >
              {l}
            </button>
          ))}
        </div>
        <Stepper label="Vilopuls (morgon)" value={restingHr} onChange={setRestingHr} step={1} unit="bpm" />
        <p className="text-xs text-muted">Längd och kön används för att räkna kroppsfett från midjemått, vilopuls och ålder för uppskattade pulszoner. Utan pulsmätare styr ansträngning (RPE) och samtalstest.</p>
      </Card>
      {supabase() && (
        <Card>
          <LoginForm intro="Har du redan använt appen på en annan enhet? Logga in så hämtas din historik och dina inställningar." />
        </Card>
      )}
    </div>,
    <div key="1" className="space-y-4">
      <h1 className="text-[32px] font-bold leading-none tracking-tight">Hälsenan</h1>
      <p className="text-ink-2">Välj fasen din fysio har godkänt. Löpning, hopp och övningar med hög hälsenebelastning spärras tills du har klartecken.</p>
      <div className="space-y-2">
        {ACHILLES_PHASES.map((p) => (
          <button
            key={p.phase}
            onClick={() => setPhase(p.phase)}
            className={cn("w-full rounded-2xl p-4 text-left transition", phase === p.phase ? "glow-soft border border-accent bg-accent-soft" : "surface")}
          >
            <div className="text-sm font-semibold">
              Fas {p.phase} · {p.name}
            </div>
            <div className={cn("text-xs", "text-muted")}>
              {p.goal}
              {p.requiresClearance ? " · kräver klartecken" : ""}
            </div>
          </button>
        ))}
      </div>
      <Card>
        <div className="mb-2 text-sm font-medium">Normal morgonstelhet/smärta just nu (0–10)</div>
        <Scale value={baseline} onChange={setBaseline} labels={["Ingen", "Värsta"]} />
      </Card>
    </div>,
    <div key="2" className="space-y-4">
      <h1 className="text-[32px] font-bold leading-none tracking-tight">Utrustning</h1>
      <p className="text-ink-2">Vikter rundas alltid nedåt till steg som finns på ditt gym.</p>
      <Card className="space-y-2">
        <Stepper label="Skivstång" value={eq.barbellKg} onChange={(v) => setEq({ ...eq, barbellKg: v })} step={2.5} unit="kg" />
        <Stepper label="Minsta steg skivstång (totalt)" value={eq.barbellStepKg} onChange={(v) => setEq({ ...eq, barbellStepKg: v })} step={0.5} unit="kg" />
        <Stepper label="Hantelsteg" value={eq.dumbbellStepKg} onChange={(v) => setEq({ ...eq, dumbbellStepKg: v })} step={0.5} unit="kg" />
        <Stepper label="Kabelsteg" value={eq.cableStepKg} onChange={(v) => setEq({ ...eq, cableStepKg: v })} step={0.25} unit="kg" />
        <Stepper label="Maskinsteg" value={eq.machineStepKg} onChange={(v) => setEq({ ...eq, machineStepKg: v })} step={0.5} unit="kg" />
        <Stepper label="Skivmaskin (benpress m.m.)" value={eq.plateMachineStepKg} onChange={(v) => setEq({ ...eq, plateMachineStepKg: v })} step={2.5} unit="kg" />
      </Card>
    </div>,
    <div key="3" className="space-y-4">
      <h1 className="text-[32px] font-bold leading-none tracking-tight">Så fungerar det</h1>
      <Card className="space-y-3 text-[15px] text-ink-2">
        <p>
          <b className="text-ink">Kalibrering.</b> Första gången du gör en övning anger du en nylig prestation (t.ex. 80 kg × 8 med 2 reps kvar) eller väljer en startvikt. Appen hittar aldrig på vikter.
        </p>
        <p>
          <b className="text-ink">Dubbel progression.</b> Först ökar reps inom intervallet. När alla set når toppen med rätt RIR höjs vikten med minsta rimliga steg.
        </p>
        <p>
          <b className="text-ink">RIR</b> = reps kvar i tanken. RIR 2 betyder att du hade klarat två till.
        </p>
        <p>
          <b className="text-ink">Allt går att ändra.</b> Rekommendationerna är förifyllda, men du kan justera varje vikt och rep.
        </p>
      </Card>
    </div>,
  ];

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="mb-6 flex gap-1.5">
        {steps.map((_, i) => (
          <div key={i} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-accent" : "bg-line")} />
        ))}
      </div>
      <div className="flex-1">{steps[step]}</div>
      <div className="mt-6 flex gap-2">
        {step > 0 && (
          <Button variant="soft" onClick={() => setStep(step - 1)}>
            Tillbaka
          </Button>
        )}
        <Button variant="accent" className="flex-1" onClick={() => (step === steps.length - 1 ? finish() : setStep(step + 1))}>
          {step === steps.length - 1 ? "Kom igång" : "Fortsätt"}
        </Button>
      </div>
    </div>
  );
}
