"use client";

import { useRef, useState } from "react";
import { Camera, Plus, Trash2 } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AnatomyFigure } from "@/components/anatomy";
import { ProgressPhoto } from "@/components/progress-photo";
import { Button, Card, PillTabs, ScreenHeader, SectionTitle, Sheet, Stepper, cn } from "@/components/ui";
import type { BodyMeasurementRec, PhotoPose, ProgressPhotoRec } from "@/lib/db/records";
import { addDays } from "@/lib/engine/weekly/dates";
import { useStore, today } from "@/lib/store";

type Tab = "overview" | "measures" | "photos" | "composition";
type Field = "weightKg" | "bodyFatPct" | "muscleMassKg" | "waistCm" | "chestCm" | "armCm" | "thighCm" | "hipsCm";

const FIELDS: Record<Field, { label: string; unit: string; step: number; good: "up" | "down" | "none" }> = {
  weightKg: { label: "Vikt", unit: "kg", step: 0.1, good: "none" },
  bodyFatPct: { label: "Kroppsfett", unit: "%", step: 0.1, good: "down" },
  muscleMassKg: { label: "Muskelmassa", unit: "kg", step: 0.1, good: "up" },
  waistCm: { label: "Midja", unit: "cm", step: 0.5, good: "down" },
  chestCm: { label: "Bröst", unit: "cm", step: 0.5, good: "up" },
  armCm: { label: "Överarm", unit: "cm", step: 0.5, good: "up" },
  thighCm: { label: "Lår", unit: "cm", step: 0.5, good: "up" },
  hipsCm: { label: "Höft", unit: "cm", step: 0.5, good: "none" },
};
const POSE_LABEL: Record<PhotoPose, string> = { front: "Framifrån", side: "Från sidan", back: "Bakifrån" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
const fmt = (n: number | null | undefined, d = 1) => (n == null ? "–" : n.toLocaleString("sv-SE", { maximumFractionDigits: d }));

/** Latest value of a field and its change vs ~30 days earlier. */
function stat(list: BodyMeasurementRec[], field: Field) {
  const withVal = list.filter((b) => b[field] != null);
  const last = withVal.at(-1);
  if (!last) return { value: null, delta: null };
  const ref = [...withVal].reverse().find((b) => b.date <= addDays(last.date, -28)) ?? (withVal.length > 1 ? withVal[0] : null);
  return { value: last[field] as number, delta: ref && ref !== last ? (last[field] as number) - (ref[field] as number) : null };
}

function Delta({ field, delta }: { field: Field; delta: number | null }) {
  if (delta == null || Math.abs(delta) < 0.05) return <span className="text-[12px] text-muted">–</span>;
  const good = FIELDS[field].good;
  const positive = good === "none" ? null : good === "up" ? delta > 0 : delta < 0;
  return (
    <span className={cn("tabular text-[12px] font-semibold", positive == null ? "text-ink-2" : positive ? "text-good" : "text-bad")}>
      {delta > 0 ? "+" : "−"}
      {fmt(Math.abs(delta))} {FIELDS[field].unit}
    </span>
  );
}

export default function BodyPage() {
  const { s } = useStore();
  const [tab, setTab] = useState<Tab>("overview");
  const [logOpen, setLogOpen] = useState(false);
  const list = s.body.filter((b) => !b.deletedAt).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <ScreenHeader title="Kropp" back right={<Button size="sm" onClick={() => setLogOpen(true)}><Plus size={15} /> Logga</Button>} />
      <PillTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: "Översikt" },
          { value: "measures", label: "Mått" },
          { value: "photos", label: "Foton" },
          { value: "composition", label: "Komposition" },
        ]}
      />
      <div className="mt-4">
        {tab === "overview" && <Overview list={list} onLog={() => setLogOpen(true)} />}
        {tab === "measures" && <Measures list={list} onLog={() => setLogOpen(true)} />}
        {tab === "photos" && <Photos />}
        {tab === "composition" && <Composition list={list} onLog={() => setLogOpen(true)} />}
      </div>
      {logOpen && <LogSheet open onClose={() => setLogOpen(false)} list={list} />}
    </div>
  );
}

function Overview({ list, onLog }: { list: BodyMeasurementRec[]; onLog: () => void }) {
  const fields: Field[] = ["weightKg", "bodyFatPct", "muscleMassKg"];
  const data = list
    .filter((b) => b.weightKg != null || b.muscleMassKg != null)
    .map((b) => ({ d: `${MONTHS[Number(b.date.slice(5, 7)) - 1]} ${Number(b.date.slice(8))}`, w: b.weightKg, m: b.muscleMassKg }));

  return (
    <>
      <div className="grid grid-cols-[1fr_1.15fr] gap-3">
        <div className="relative flex items-center justify-center">
          <AnatomyFigure view="front" fills={{}} viewBox="26 6 148 400" className="h-[300px] w-auto opacity-90 drop-shadow-[0_0_18px_rgba(160,170,200,0.18)]" />
        </div>
        <div className="space-y-2">
          {fields.map((f) => {
            const st = stat(list, f);
            return (
              <Card key={f} className="p-3">
                <div className="text-[12px] text-ink-2">{FIELDS[f].label}</div>
                <div className="flex items-baseline justify-between gap-1">
                  <span className="tabular text-[22px] font-bold">
                    {fmt(st.value)}
                    <span className="text-[13px] font-medium text-ink-2"> {FIELDS[f].unit}</span>
                  </span>
                  <Delta field={f} delta={st.delta} />
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {list.length === 0 ? (
        <Card className="mt-4 text-center">
          <p className="text-[14px] text-ink-2">Logga vikt, kroppsfett och muskelmassa (t.ex. från en smart våg) för att följa utvecklingen.</p>
          <Button className="mt-3" onClick={onLog}>
            <Plus size={16} /> Första mätningen
          </Button>
        </Card>
      ) : data.length >= 2 ? (
        <Card className="mt-4 px-2 pb-2">
          <div role="img" aria-label="Vikt och muskelmassa över tid" style={{ height: 190 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="d" stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} minTickGap={18} />
                <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12 }} formatter={(v) => [`${fmt(Number(v))} kg`]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--ink-2)", paddingTop: 6 }} verticalAlign="bottom" />
                <Line isAnimationActive={false} type="monotone" dataKey="w" name="Vikt" stroke="#ff8a3d" strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
                <Line isAnimationActive={false} type="monotone" dataKey="m" name="Muskelmassa" stroke="#b9a7f5" strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : (
        <p className="mt-4 text-center text-[13px] text-muted">Grafen visas efter två mätningar.</p>
      )}
    </>
  );
}

function Measures({ list, onLog }: { list: BodyMeasurementRec[]; onLog: () => void }) {
  const fields: Field[] = ["waistCm", "chestCm", "armCm", "thighCm", "hipsCm"];
  const any = fields.some((f) => stat(list, f).value != null);
  return (
    <>
      <Card className="divide-y divide-line px-3 py-1">
        {fields.map((f) => {
          const st = stat(list, f);
          return (
            <div key={f} className="flex items-center justify-between py-3 text-[14px]">
              <span>{FIELDS[f].label}</span>
              <span className="flex items-center gap-3">
                <span className="tabular font-semibold">
                  {fmt(st.value)} {st.value != null && <span className="text-[12px] font-normal text-ink-2">cm</span>}
                </span>
                <span className="w-16 text-right">
                  <Delta field={f} delta={st.delta} />
                </span>
              </span>
            </div>
          );
        })}
      </Card>
      {!any && (
        <Button variant="secondary" className="mt-3 w-full" onClick={onLog}>
          <Plus size={16} /> Logga mått
        </Button>
      )}
      <p className="mt-2 px-1 text-[11px] text-muted">Mät på morgonen, avslappnat, med måttbandet vågrätt. Förändring mot cirka en månad sedan.</p>
    </>
  );
}

function Composition({ list, onLog }: { list: BodyMeasurementRec[]; onLog: () => void }) {
  const latest = [...list].reverse().find((b) => b.weightKg != null && b.bodyFatPct != null);
  if (!latest) {
    return (
      <Card className="text-center">
        <p className="text-[14px] text-ink-2">Logga vikt och kroppsfett för att se hur vikten fördelar sig på fett och fettfri massa.</p>
        <Button className="mt-3" onClick={onLog}>
          <Plus size={16} /> Logga mätning
        </Button>
      </Card>
    );
  }
  const fat = (latest.weightKg! * latest.bodyFatPct!) / 100;
  const lean = latest.weightKg! - fat;
  const muscle = latest.muscleMassKg;
  const parts = [
    { label: "Fettmassa", kg: fat, color: "#ff8a3d" },
    { label: "Fettfri massa", kg: lean, color: "#5eb5c9" },
  ];
  const fatSeries = list.filter((b) => b.bodyFatPct != null);
  return (
    <>
      <Card>
        <div className="text-[12px] text-ink-2">Senaste mätningen · {latest.date}</div>
        <div className="tabular mt-1 text-[26px] font-bold">{fmt(latest.weightKg)} kg</div>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full">
          {parts.map((p) => (
            <div key={p.label} style={{ width: `${(p.kg / latest.weightKg!) * 100}%`, background: p.color }} />
          ))}
        </div>
        <div className="mt-3 space-y-1.5">
          {parts.map((p) => (
            <div key={p.label} className="flex justify-between text-[13px]">
              <span className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: p.color }} />
                {p.label}
              </span>
              <span className="tabular">
                {fmt(p.kg)} kg · {fmt((p.kg / latest.weightKg!) * 100)} %
              </span>
            </div>
          ))}
          {muscle != null && (
            <div className="flex justify-between border-t border-line pt-1.5 text-[13px]">
              <span className="text-ink-2">varav muskelmassa</span>
              <span className="tabular">
                {fmt(muscle)} kg · {fmt((muscle / latest.weightKg!) * 100)} %
              </span>
            </div>
          )}
        </div>
      </Card>
      {fatSeries.length >= 2 && (
        <>
          <SectionTitle>Kroppsfett över tid</SectionTitle>
          <Card className="px-2 pb-2">
            <div role="img" aria-label="Kroppsfett över tid" style={{ height: 150 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={fatSeries.map((b) => ({ d: b.date.slice(5).replace("-", "/"), v: b.bodyFatPct }))} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="d" stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} minTickGap={18} />
                  <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12 }} formatter={(v) => [`${fmt(Number(v))} %`, "Kroppsfett"]} />
                  <Line isAnimationActive={false} type="monotone" dataKey="v" stroke="#ff8a3d" strokeWidth={2} dot={{ r: 2.5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
      <p className="mt-2 px-1 text-[11px] text-muted">Beräknat från vikt och kroppsfett. Kroppsfett från smarta vågar varierar med vätskebalans – jämför helst mätningar gjorda vid samma tid på dygnet.</p>
    </>
  );
}

function Photos() {
  const store = useStore();
  const photos = store.s.photos.filter((p) => !p.deletedAt).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const fileRef = useRef<HTMLInputElement>(null);
  const [pose, setPose] = useState<PhotoPose>("front");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ProgressPhotoRec | null>(null);
  const [compare, setCompare] = useState<PhotoPose | null>(null);

  const add = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      await store.addPhoto(file, pose, today());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte spara fotot.");
    } finally {
      setBusy(false);
    }
  };

  const byPose = (p: PhotoPose) => photos.filter((x) => x.pose === p);

  return (
    <>
      <Card className="space-y-3">
        <div className="flex gap-1.5">
          {(Object.keys(POSE_LABEL) as PhotoPose[]).map((p) => (
            <button
              key={p}
              aria-pressed={pose === p}
              onClick={() => setPose(p)}
              className={cn("h-9 flex-1 rounded-full text-[12px] font-medium", pose === p ? "bg-accent-grad text-on-accent" : "border border-line bg-card-2 text-ink-2")}
            >
              {POSE_LABEL[p]}
            </button>
          ))}
        </div>
        <Button className="w-full" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Camera size={17} /> {busy ? "Sparar…" : "Ta eller välj foto"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) add(f);
          }}
        />
        {error && <p className="text-[12px] text-bad">{error}</p>}
        <p className="text-[11px] text-muted">
          Fotona komprimeras på telefonen och all metadata (även GPS) tas bort. De sparas privat – på enheten och i ditt eget lagringsutrymme när synk är aktiverad.
        </p>
      </Card>

      {(Object.keys(POSE_LABEL) as PhotoPose[]).some((p) => byPose(p).length >= 2) && (
        <div className="mt-3 flex gap-2">
          {(Object.keys(POSE_LABEL) as PhotoPose[])
            .filter((p) => byPose(p).length >= 2)
            .map((p) => (
              <Button key={p} variant="secondary" size="sm" onClick={() => setCompare(p)}>
                Jämför {POSE_LABEL[p].toLowerCase()}
              </Button>
            ))}
        </div>
      )}

      {photos.length === 0 ? (
        <p className="mt-6 text-center text-[13px] text-muted">Inga foton än. Ta samma vinklar, i samma ljus, var fjärde vecka.</p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <button key={p.id} onClick={() => setView(p)} className="text-left">
              <ProgressPhoto photo={p} className="aspect-[3/4] rounded-[12px] border border-line" />
              <div className="mt-1 text-[11px] text-muted">
                {p.date.slice(5).replace("-", "/")} · {POSE_LABEL[p.pose]}
              </div>
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!view} onClose={() => setView(null)} title={view ? `${POSE_LABEL[view.pose]} · ${view.date}` : ""}>
        {view && (
          <div className="space-y-3">
            <ProgressPhoto photo={view} className="aspect-[3/4] w-full rounded-[16px]" />
            <Button
              variant="ghost"
              className="w-full text-bad"
              onClick={async () => {
                if (!confirm("Ta bort fotot? Det raderas från enheten och från molnet.")) return;
                await store.deletePhoto(view.id);
                setView(null);
              }}
            >
              <Trash2 size={16} /> Ta bort foto
            </Button>
          </div>
        )}
      </Sheet>

      <Sheet open={!!compare} onClose={() => setCompare(null)} title={compare ? `Jämför · ${POSE_LABEL[compare]}` : ""}>
        {compare && (
          <div className="grid grid-cols-2 gap-2">
            {[byPose(compare).at(-1)!, byPose(compare)[0]].map((p, i) => (
              <div key={p.id}>
                <ProgressPhoto photo={p} className="aspect-[3/4] rounded-[12px] border border-line" />
                <div className="mt-1 text-center text-[12px] text-ink-2">
                  {i === 0 ? "Första" : "Senaste"} · {p.date}
                </div>
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </>
  );
}

function LogSheet({ open, onClose, list }: { open: boolean; onClose: () => void; list: BodyMeasurementRec[] }) {
  const store = useStore();
  const t = today();
  const todays = list.find((b) => b.date === t);
  const last = (f: Field) => (todays?.[f] ?? [...list].reverse().find((b) => b[f] != null)?.[f] ?? null) as number | null;
  const defaults: Record<Field, number> = { weightKg: 80, bodyFatPct: 15, muscleMassKg: 65, waistCm: 85, chestCm: 100, armCm: 36, thighCm: 58, hipsCm: 98 };
  const [values, setValues] = useState<Record<Field, number | null>>(() =>
    Object.fromEntries((Object.keys(FIELDS) as Field[]).map((f) => [f, last(f)])) as Record<Field, number | null>,
  );
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await store.logBody({ date: t, notes: null, ...values });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const row = (f: Field) =>
    values[f] == null ? (
      <button key={f} onClick={() => setValues({ ...values, [f]: defaults[f] })} className="flex h-12 w-full items-center justify-between rounded-[14px] border border-dashed border-line px-4 text-[13px] text-ink-2">
        {FIELDS[f].label} <Plus size={15} />
      </button>
    ) : (
      <div key={f} className="flex items-center gap-2">
        <div className="flex-1">
          <Stepper label={FIELDS[f].label} value={values[f]!} onChange={(v) => setValues({ ...values, [f]: v })} step={FIELDS[f].step} unit={FIELDS[f].unit} />
        </div>
        <button aria-label={`Ta bort ${FIELDS[f].label}`} onClick={() => setValues({ ...values, [f]: null })} className="flex size-9 items-center justify-center rounded-full text-muted">
          <Trash2 size={15} />
        </button>
      </div>
    );

  return (
    <Sheet open={open} onClose={onClose} title={todays ? "Uppdatera dagens mätning" : "Ny mätning"}>
      <div className="space-y-2">
        {(["weightKg", "bodyFatPct", "muscleMassKg"] as Field[]).map(row)}
        <div className="pt-2 text-[12px] font-medium text-ink-2">Mått</div>
        {(["waistCm", "chestCm", "armCm", "thighCm", "hipsCm"] as Field[]).map(row)}
        <Button size="lg" className="mt-3 w-full" disabled={busy || Object.values(values).every((v) => v == null)} onClick={save}>
          Spara mätning
        </Button>
        <p className="text-center text-[11px] text-muted">En mätning per dag – sparar du igen uppdateras dagens.</p>
      </div>
    </Sheet>
  );
}
