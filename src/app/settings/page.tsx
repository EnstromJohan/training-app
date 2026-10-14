"use client";

import { useRef, useState } from "react";
import { Bandage, BicepsFlexed, ChartNoAxesCombined, Dumbbell, Flower2, Heart, ShieldPlus } from "lucide-react";
import { MUSCLE_LABEL } from "@/components/muscle-labels";
import { Button, Card, PillTabs, Scale, ScreenHeader, SectionTitle, Stepper, cn } from "@/components/ui";
import { ACHILLES_PHASES } from "@/lib/engine/rehab/achilles";
import { allowedModalities, MODALITY_LABEL } from "@/lib/engine/cardio/zones";
import { weekStart } from "@/lib/engine/weekly/dates";
import type { CardioSlot, EquipmentProfile } from "@/lib/engine/types";
import type { SettingsRec } from "@/lib/db/records";
import { supabase } from "@/lib/db/supabase";
import { LoginForm } from "@/components/login-form";
import { EXERCISES } from "@/lib/program/exercises";
import { useStore, today } from "@/lib/store";

type Tab = "profile" | "goals" | "equipment" | "injuries" | "other";

type Goal = SettingsRec["goal"];
const GOALS: Array<{ value: Goal; label: string; icon: typeof Dumbbell }> = [
  { value: "hypertrophy", label: "Muskeltillväxt", icon: BicepsFlexed },
  { value: "strength", label: "Styrka", icon: Dumbbell },
  { value: "conditioning", label: "Kondition", icon: Heart },
  { value: "recovery", label: "Återhämtning", icon: Flower2 },
  { value: "performance", label: "Prestation", icon: ChartNoAxesCombined },
  { value: "health", label: "Hälsa", icon: ShieldPlus },
];
const LEVELS: Array<SettingsRec["experience"]> = ["beginner", "intermediate", "advanced"];

export default function SettingsPage() {
  const store = useStore();
  const st = store.s.settings;
  const [tab, setTab] = useState<Tab>("profile");
  const set = (patch: Partial<SettingsRec>) => store.updateSettings(patch);
  const setEq = (patch: Partial<EquipmentProfile>) => set({ equipment: { ...st.equipment, ...patch } });
  const env = st.equipment.environment ?? "gym";
  const phase = ACHILLES_PHASES.find((p) => p.phase === st.rehab.phase);

  return (
    <div>
      <ScreenHeader title="Inställningar" />
      <PillTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "profile", label: "Profil" },
          { value: "goals", label: "Mål" },
          { value: "equipment", label: "Utrustning" },
          { value: "injuries", label: "Skador" },
          { value: "other", label: "Övrigt" },
        ]}
      />

      {tab === "profile" && (
        <>
          <SectionTitle>Dina mål</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            {GOALS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => set({ goal: value })}
                className={cn(
                  "flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-[16px] text-[11px] font-medium",
                  st.goal === value ? "bg-accent-soft text-accent-ink" : "bg-card text-ink-2",
                )}
              >
                <Icon size={22} strokeWidth={1.5} />
                {label}
              </button>
            ))}
          </div>

          <SectionTitle>Nuvarande nivå</SectionTitle>
          <div className="px-1">
            <input
              type="range"
              min={0}
              max={2}
              step={1}
              value={LEVELS.indexOf(st.experience)}
              onChange={(e) => set({ experience: LEVELS[Number(e.target.value)] })}
              className="level-slider w-full"
              aria-label="Nuvarande nivå"
            />
            <div className="mt-1 flex justify-between text-[12px]">
              {["Nybörjare", "Medel", "Avancerad"].map((l, i) => (
                <span key={l} className={LEVELS.indexOf(st.experience) === i ? "font-semibold" : "text-muted"}>{l}</span>
              ))}
            </div>
          </div>

          <SectionTitle>Träningsmiljö</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["gym", "Gym"],
                ["home", "Hemma"],
                ["outdoor", "Utomhus"],
              ] as const
            ).map(([v, l]) => (
              <button key={v} onClick={() => setEq({ environment: v })} className={cn("h-9 rounded-full text-[13px] font-medium", env === v ? "bg-ink text-white" : "bg-card-2 text-ink-2")}>
                {l}
              </button>
            ))}
          </div>
          {env !== "gym" && <p className="mt-2 text-[11px] text-muted">Programmet är byggt för gym. Byt övningar under passet (Alternativ) om utrustning saknas.</p>}

          <SectionTitle>Skadehistorik</SectionTitle>
          <button onClick={() => setTab("injuries")} className="flex w-full items-center gap-3 rounded-[16px] bg-card p-3 text-left">
            <span className="flex size-7 items-center justify-center rounded-full bg-bad-soft text-bad">
              <Bandage size={14} />
            </span>
            <span className="flex-1 text-[13px]">Hälsena (operation 2026)</span>
            <span className="text-[12px] font-medium text-good">{st.rehab.runningCleared ? "Klartecken" : `Aktiv rehab · fas ${phase?.phase}`}</span>
          </button>

          <SectionTitle>Profil</SectionTitle>
          <Card className="space-y-2 bg-card-2/50 p-2">
            <label className="block rounded-[14px] bg-card px-3 py-2">
              <span className="text-[9px] text-muted">Namn</span>
              <input defaultValue={st.name} onBlur={(e) => set({ name: e.target.value.trim() })} className="block w-full bg-transparent text-[16px] font-medium outline-none" />
            </label>
            <Stepper label="Födelseår" value={st.birthYear ?? 1990} onChange={(v) => set({ birthYear: v })} step={1} />
            <Stepper label="Kroppsvikt" value={st.bodyWeightKg ?? 80} onChange={(v) => set({ bodyWeightKg: v })} step={0.5} unit="kg" />
            <Stepper label="Vilopuls" value={st.restingHr ?? 60} onChange={(v) => set({ restingHr: v })} step={1} unit="bpm" />
            <Stepper label="Maxpuls (0 = okänd)" value={st.maxHr ?? 0} onChange={(v) => set({ maxHr: v || null })} step={1} unit="bpm" />
          </Card>
        </>
      )}

      {tab === "goals" && (
        <>
          <SectionTitle>Huvudmål</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            {GOALS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => set({ goal: value })}
                className={cn("flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-[16px] text-[11px] font-medium", st.goal === value ? "bg-accent-soft text-accent-ink" : "bg-card text-ink-2")}
              >
                <Icon size={22} strokeWidth={1.5} />
                {label}
              </button>
            ))}
          </div>
          <Card className="mt-3 space-y-2 text-[13px] text-ink-2">
            <p><b className="text-ink">Styrka:</b> dubbel progression – reps först, sedan vikt med minsta steg.</p>
            <p><b className="text-ink">Kondition:</b> tre pass i veckan som ökar tid, sedan intensitet, max +10 % belastning per vecka.</p>
            <p><b className="text-ink">Återhämtning:</b> dagsform före varje pass, deload vid stagnation eller låg återhämtning.</p>
          </Card>
        </>
      )}

      {tab === "equipment" && (
        <Card className="mt-4 space-y-2 bg-card-2/50 p-2">
          <Stepper label="Skivstång" value={st.equipment.barbellKg} onChange={(v) => setEq({ barbellKg: v })} step={2.5} unit="kg" />
          <Stepper label="Minsta steg skivstång (totalt)" value={st.equipment.barbellStepKg} onChange={(v) => setEq({ barbellStepKg: v })} step={0.5} min={0.5} unit="kg" />
          <Stepper label="Hantelsteg" value={st.equipment.dumbbellStepKg} onChange={(v) => setEq({ dumbbellStepKg: v })} step={0.5} min={0.5} unit="kg" />
          <Stepper label="Kabelsteg" value={st.equipment.cableStepKg} onChange={(v) => setEq({ cableStepKg: v })} step={0.25} min={0.25} unit="kg" />
          <Stepper label="Maskinsteg" value={st.equipment.machineStepKg} onChange={(v) => setEq({ machineStepKg: v })} step={0.5} min={0.5} unit="kg" />
          <Stepper label="Skivmaskin (benpress m.m.)" value={st.equipment.plateMachineStepKg} onChange={(v) => setEq({ plateMachineStepKg: v })} step={2.5} min={1.25} unit="kg" />
          <p className="px-2 pb-1 text-[11px] text-muted">Vikter rundas alltid nedåt till steg som finns på ditt gym.</p>
        </Card>
      )}

      {tab === "injuries" && (
        <>
          <SectionTitle>Hälsena – rehabfas</SectionTitle>
          <div className="space-y-2">
            {ACHILLES_PHASES.map((p) => (
              <button
                key={p.phase}
                onClick={() => {
                  if (p.phase === st.rehab.phase) return;
                  if (p.phase > st.rehab.phase && !confirm(`Har fysio godkänt fas ${p.phase} (${p.name})?`)) return;
                  set({
                    rehab: {
                      ...st.rehab,
                      phase: p.phase,
                      phaseStartedAt: today(),
                      approvedPhases: Array.from(new Set([...st.rehab.approvedPhases, p.phase])),
                    },
                  });
                }}
                className={cn("w-full rounded-[16px] p-3 text-left", st.rehab.phase === p.phase ? "bg-ink text-white" : "bg-card")}
              >
                <div className="text-[13px] font-semibold">Fas {p.phase} · {p.name}</div>
                <div className={cn("text-[11px]", st.rehab.phase === p.phase ? "text-white/60" : "text-muted")}>{p.goal}</div>
              </button>
            ))}
          </div>
          <Card className="mt-3">
            <div className="mb-2 text-[13px] font-medium">Baslinje morgonstelhet (0–10)</div>
            <Scale value={st.rehab.baselineMorningPain} onChange={(v) => set({ rehab: { ...st.rehab, baselineMorningPain: v } })} />
          </Card>
          <Card className="mt-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-medium">Klartecken för löpning och hopp</div>
              <div className="text-[11px] text-muted">Låser upp löpning och övningar med hög hälsenebelastning (kräver även fas 5).</div>
            </div>
            <input
              type="checkbox"
              checked={st.rehab.runningCleared}
              onChange={(e) => {
                if (e.target.checked && !confirm("Har du medicinskt klartecken för löpning och hopp?")) return;
                set({ rehab: { ...st.rehab, runningCleared: e.target.checked } });
              }}
              className="size-5 accent-black"
            />
          </Card>
        </>
      )}

      {tab === "other" && (
        <>
          <ProgressionSettings />
          <DataSettings />
        </>
      )}
    </div>
  );
}

function ProgressionSettings() {
  const store = useStore();
  const st = store.s.settings;
  const set = (patch: Partial<SettingsRec>) => store.updateSettings(patch);
  const thisWeek = weekStart(today());
  const subs = Object.entries(st.substitutions);
  const mods = Object.entries(st.volumeModifiers).filter(([, v]) => v !== 0);
  const allowed = allowedModalities(st.rehab);

  return (
    <>
      <SectionTitle>Deload</SectionTitle>
      <Card className="flex items-center justify-between gap-3">
        <div className="text-sm">
          <div className="font-medium">Deload denna vecka</div>
          <div className="text-xs text-muted">Lättare vikt, färre set, RIR 3–4. Rekommenderas automatiskt.</div>
        </div>
        <input
          type="checkbox"
          checked={st.deloadWeeks.includes(thisWeek)}
          onChange={(e) => set({ deloadWeeks: e.target.checked ? [...st.deloadWeeks, thisWeek] : st.deloadWeeks.filter((w) => w !== thisWeek) })}
          className="size-5 accent-black"
        />
      </Card>

      <SectionTitle>Utbytta övningar</SectionTitle>
      <Card className="divide-y divide-line p-2">
        {subs.length === 0 && <p className="p-2 text-sm text-muted">Inga permanenta byten.</p>}
        {subs.map(([from, to]) => (
          <div key={from} className="flex items-center justify-between px-2 py-2 text-sm">
            <span>{EXERCISES[from]?.name} → {EXERCISES[to]?.name}</span>
            <button
              className="text-xs underline"
              onClick={() => {
                const next = { ...st.substitutions };
                delete next[from];
                set({ substitutions: next });
              }}
            >
              Återställ
            </button>
          </div>
        ))}
      </Card>

      <SectionTitle>Volymjusteringar</SectionTitle>
      <Card className="divide-y divide-line p-2">
        {mods.length === 0 && <p className="p-2 text-sm text-muted">Programmets standardvolym.</p>}
        {mods.map(([id, v]) => (
          <div key={id} className="flex items-center justify-between px-2 py-2 text-sm">
            <span>{EXERCISES[id]?.name} ({MUSCLE_LABEL[EXERCISES[id]?.primary]})</span>
            <span className="flex items-center gap-3">
              <span className="tabular">{v > 0 ? `+${v}` : v} set</span>
              <button
                className="text-xs underline"
                onClick={() => {
                  const next = { ...st.volumeModifiers };
                  delete next[id];
                  set({ volumeModifiers: next });
                }}
              >
                Återställ
              </button>
            </span>
          </div>
        ))}
      </Card>

      <SectionTitle>Föredragen cardiomaskin</SectionTitle>
      <Card className="space-y-3">
        {(["A", "B", "C"] as CardioSlot[]).map((slot) => (
          <div key={slot}>
            <div className="mb-1 text-xs text-muted">Pass {slot}</div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => {
                  const next = { ...st.cardioPreferred };
                  delete next[slot];
                  set({ cardioPreferred: next });
                }}
                className={cn("h-8 rounded-full px-3 text-xs", !st.cardioPreferred[slot] ? "bg-ink text-white" : "bg-card-2")}
              >
                Auto
              </button>
              {allowed.map((m) => (
                <button
                  key={m}
                  onClick={() => set({ cardioPreferred: { ...st.cardioPreferred, [slot]: m } })}
                  className={cn("h-8 rounded-full px-3 text-xs", st.cardioPreferred[slot] === m ? "bg-ink text-white" : "bg-card-2")}
                >
                  {MODALITY_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </Card>
      <p className="text-xs text-muted">
        Regler: reps ökar inom intervallet, och vikten ökar med minsta tillgängliga steg när alla set når toppen med rätt RIR. Två missade pass i rad ger −7,5 %, och 3 pass utan framsteg räknas som platå. Cardio: +2–3 min per pass upp till taket, därefter intensitet, med högst +10 % veckobelastning.
      </p>
    </>
  );
}

function DataSettings() {
  const store = useStore();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const sb = supabase();
  const counts = {
    pass: store.s.sessions.filter((x) => x.status === "completed" && !x.deletedAt).length,
    set: store.s.sets.filter((x) => !x.deletedAt).length,
    cardio: store.s.cardio.filter((x) => !x.deletedAt).length,
  };

  const download = async () => {
    const json = await store.exportJson();
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `traning-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Card className="tabular grid grid-cols-3 text-center">
        <div><div className="text-xl font-semibold">{counts.pass}</div><div className="text-[11px] text-muted">pass</div></div>
        <div><div className="text-xl font-semibold">{counts.set}</div><div className="text-[11px] text-muted">set</div></div>
        <div><div className="text-xl font-semibold">{counts.cardio}</div><div className="text-[11px] text-muted">cardio</div></div>
      </Card>

      <SectionTitle>Synk (Supabase)</SectionTitle>
      <Card className="space-y-2 text-sm">
        {!sb ? (
          <p className="text-ink-2">
            Ej konfigurerat. All historik sparas på den här enheten (IndexedDB). Lägg in Supabase-nycklar i <code>.env.local</code> för permanent lagring i databasen och synk mellan enheter.
          </p>
        ) : (
          <>
            <p>Status: <b>{{ off: "Av", idle: "Synkad", syncing: "Synkar…", error: "Fel", signed_out: "Inte inloggad" }[store.syncState]}</b>{store.syncMessage && ` – ${store.syncMessage}`}</p>
            {store.syncState === "signed_out" && <LoginForm />}
            <Button size="sm" variant="soft" onClick={() => store.syncNow()}>Synka nu</Button>
          </>
        )}
        {msg && <p className="text-xs text-muted">{msg}</p>}
      </Card>

      <SectionTitle>Backup</SectionTitle>
      <div className="flex gap-2">
        <Button variant="dark" className="flex-1" onClick={download}>Exportera JSON</Button>
        <Button variant="soft" className="flex-1" onClick={() => file.current?.click()}>Importera</Button>
      </div>
      <input
        ref={file}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            const n = await store.importJson(await f.text());
            setMsg(`${n} poster importerade. Inget togs bort.`);
          } catch {
            setMsg("Kunde inte läsa filen.");
          }
        }}
      />
      <p className="text-xs text-muted">Import slår ihop med befintlig data (nyast vinner) och raderar aldrig något.</p>
    </>
  );
}
