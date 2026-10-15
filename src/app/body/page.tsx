"use client";

import { useRef, useState } from "react";
import { Camera, Plus, Sparkles, Trash2 } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AnatomyFigure } from "@/components/anatomy";
import { ProgressPhoto } from "@/components/progress-photo";
import { Button, Card, PillTabs, ScreenHeader, SectionTitle, Sheet, Stepper, cn } from "@/components/ui";
import type { BodyMeasurementRec, PhotoPose, ProgressPhotoRec } from "@/lib/db/records";
import { rfm } from "@/lib/engine/body/rfm";
import { addDays, daysBetween } from "@/lib/engine/weekly/dates";
import { aiAvailability, requestBodyEstimate } from "@/lib/ai-estimate";
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

/** Waist-based body fat (RFM) for every measurement that has a waist. */
function rfmSeries(list: BodyMeasurementRec[], heightCm: number | null | undefined, sex: "male" | "female" | null | undefined) {
  return list.map((b) => ({ date: b.date, v: rfm(heightCm, b.waistCm, sex) })).filter((x): x is { date: string; v: number } => x.v != null);
}

function latestAi(photos: ProgressPhotoRec[]) {
  return photos
    .filter((p) => !p.deletedAt && p.aiEstimate?.assessable && p.aiEstimate.bodyFatLow != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
}

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
  const { s } = useStore();
  const fields: Field[] = ["weightKg", "bodyFatPct", "muscleMassKg"];
  const rfmList = rfmSeries(list, s.settings.heightCm, s.settings.sex);
  const rfmNow = rfmList.at(-1)?.v ?? null;
  const rfmDelta = rfmList.length > 1 ? rfmNow! - rfmList[0].v : null;
  const ai = latestAi(s.photos)?.aiEstimate;
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
            // Body fat: a measured value (scale) wins; otherwise the waist-based RFM estimate.
            const useRfm = f === "bodyFatPct" && st.value == null && rfmNow != null;
            const value = useRfm ? rfmNow : st.value;
            return (
              <Card key={f} className="p-3">
                <div className="text-[12px] text-ink-2">
                  {FIELDS[f].label}
                  {useRfm && " (midja)"}
                </div>
                <div className="flex items-baseline justify-between gap-1">
                  <span className="tabular text-[22px] font-bold">
                    {fmt(value)}
                    <span className="text-[13px] font-medium text-ink-2"> {FIELDS[f].unit}</span>
                  </span>
                  <Delta field={f} delta={useRfm ? rfmDelta : st.delta} />
                </div>
                {f === "bodyFatPct" && (
                  <div className="mt-1 space-y-0.5 text-[11px] text-muted">
                    {!useRfm && rfmNow != null && <div className="tabular">Midja (RFM): {fmt(rfmNow)} %</div>}
                    {ai && (
                      <div className="tabular">
                        AI (foto): {fmt(ai.bodyFatLow)}–{fmt(ai.bodyFatHigh)} %
                      </div>
                    )}
                    {rfmNow == null && !s.settings.heightCm && <div>Lägg till längd för midjeberäkning</div>}
                  </div>
                )}
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
  const { s } = useStore();
  const latestWeight = [...list].reverse().find((b) => b.weightKg != null);
  const measured = [...list].reverse().find((b) => b.bodyFatPct != null);
  const rfmList = rfmSeries(list, s.settings.heightCm, s.settings.sex);
  const aiPhotos = s.photos
    .filter((p) => !p.deletedAt && p.aiEstimate?.assessable && p.aiEstimate.bodyFatMid != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Source priority: measured (scale) → waist-based RFM → AI photo estimate.
  const source = measured
    ? { pct: measured.bodyFatPct!, label: `Uppmätt ${measured.date}` }
    : rfmList.length
      ? { pct: rfmList.at(-1)!.v, label: "Uppskattat från midjemått (RFM)" }
      : aiPhotos.length
        ? { pct: aiPhotos.at(-1)!.aiEstimate!.bodyFatMid!, label: "AI-uppskattning från foto" }
        : null;

  if (!latestWeight || !source) {
    return (
      <Card className="text-center">
        <p className="text-[14px] text-ink-2">
          Logga vikt plus antingen kroppsfett (smart våg), midjemått (räknas om till kroppsfett med RFM) eller en AI-uppskattning från ett foto.
        </p>
        <Button className="mt-3" onClick={onLog}>
          <Plus size={16} /> Logga mätning
        </Button>
      </Card>
    );
  }
  const weight = latestWeight.weightKg!;
  const fat = (weight * source.pct) / 100;
  const lean = weight - fat;
  const muscle = latestWeight.muscleMassKg;
  const parts = [
    { label: "Fettmassa", kg: fat, color: "#ff8a3d" },
    { label: "Fettfri massa", kg: lean, color: "#5eb5c9" },
  ];

  // One timeline with the three body-fat sources.
  const byDate = new Map<string, { d: string; m?: number; r?: number; a?: number }>();
  const row = (date: string) => byDate.get(date) ?? byDate.set(date, { d: date.slice(5).replace("-", "/") }).get(date)!;
  for (const b of list) if (b.bodyFatPct != null) row(b.date).m = b.bodyFatPct;
  for (const r of rfmList) row(r.date).r = r.v;
  for (const p of aiPhotos) row(p.date).a = p.aiEstimate!.bodyFatMid!;
  const series = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);

  return (
    <>
      <Card>
        <div className="text-[12px] text-ink-2">Vikt {latestWeight.date}</div>
        <div className="tabular mt-1 text-[26px] font-bold">{fmt(weight)} kg</div>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full">
          {parts.map((p) => (
            <div key={p.label} style={{ width: `${(p.kg / weight) * 100}%`, background: p.color }} />
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
                {fmt(p.kg)} kg · {fmt((p.kg / weight) * 100)} %
              </span>
            </div>
          ))}
          {muscle != null && (
            <div className="flex justify-between border-t border-line pt-1.5 text-[13px]">
              <span className="text-ink-2">varav muskelmassa</span>
              <span className="tabular">
                {fmt(muscle)} kg · {fmt((muscle / weight) * 100)} %
              </span>
            </div>
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted">Kroppsfett: {source.label}.</p>
      </Card>
      {series.length >= 2 && (
        <>
          <SectionTitle>Kroppsfett över tid</SectionTitle>
          <Card className="px-2 pb-2">
            <div role="img" aria-label="Kroppsfett över tid från våg, midjemått och AI" style={{ height: 170 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="d" stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} minTickGap={18} />
                  <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12 }} formatter={(v, n) => [`${fmt(Number(v))} %`, n]} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--ink-2)", paddingTop: 6 }} verticalAlign="bottom" />
                  {series.some((x) => x.m != null) && <Line isAnimationActive={false} type="monotone" dataKey="m" name="Våg" stroke="#ff8a3d" strokeWidth={2} dot={{ r: 2.5 }} connectNulls />}
                  {series.some((x) => x.r != null) && <Line isAnimationActive={false} type="monotone" dataKey="r" name="Midja (RFM)" stroke="#5eb5c9" strokeWidth={2} dot={{ r: 2.5 }} connectNulls />}
                  {series.some((x) => x.a != null) && <Line isAnimationActive={false} type="monotone" dataKey="a" name="AI (foto)" stroke="#b9a7f5" strokeWidth={0} dot={{ r: 4 }} connectNulls={false} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
      <p className="mt-2 px-1 text-[11px] text-muted">
        Alla metoder är uppskattningar: smarta vågar påverkas av vätskebalans, RFM bygger på midjemått och AI-bedömningar av foton har ungefär ±4 procentenheters osäkerhet. Följ trenden inom samma metod.
      </p>
    </>
  );
}

const PHOTO_INTERVAL_DAYS = 28;

function Photos() {
  const store = useStore();
  const { s } = store;
  const photos = s.photos.filter((p) => !p.deletedAt).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
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
  const last = photos[0];
  const daysSince = last ? daysBetween(last.date, today()) : null;
  const viewing = view ? (s.photos.find((p) => p.id === view.id) ?? view) : null;

  return (
    <>
      {daysSince != null && (
        <div className={cn("mb-3 rounded-[14px] border p-3 text-[13px]", daysSince >= PHOTO_INTERVAL_DAYS ? "border-accent/40 bg-accent-soft text-accent-ink" : "border-line bg-card text-ink-2")}>
          {daysSince >= PHOTO_INTERVAL_DAYS
            ? `Dags för nya progressionsfoton – ${daysSince} dagar sedan senast.`
            : `Nästa foto om ${PHOTO_INTERVAL_DAYS - daysSince} dagar (var fjärde vecka, samma ljus och vinkel).`}
        </div>
      )}

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
        <div className="mt-3 flex flex-wrap gap-2">
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
              <div className="relative">
                <ProgressPhoto photo={p} className="aspect-[3/4] rounded-[12px] border border-line" />
                {p.aiEstimate?.assessable && (
                  <span className="tabular absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-ink backdrop-blur">
                    {fmt(p.aiEstimate.bodyFatLow)}–{fmt(p.aiEstimate.bodyFatHigh)} %
                  </span>
                )}
              </div>
              <div className="mt-1 text-[11px] text-muted">
                {p.date.slice(5).replace("-", "/")} · {POSE_LABEL[p.pose]}
              </div>
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!viewing} onClose={() => setView(null)} title={viewing ? `${POSE_LABEL[viewing.pose]} · ${viewing.date}` : ""}>
        {viewing && (
          <div className="space-y-3">
            <ProgressPhoto photo={viewing} className="aspect-[3/4] w-full rounded-[16px]" />
            <AiEstimatePanel photo={viewing} />
            <Button
              variant="ghost"
              className="w-full text-bad"
              onClick={async () => {
                if (!confirm("Ta bort fotot? Det raderas från enheten och från molnet.")) return;
                await store.deletePhoto(viewing.id);
                setView(null);
              }}
            >
              <Trash2 size={16} /> Ta bort foto
            </Button>
          </div>
        )}
      </Sheet>

      {compare && <CompareSheet photos={byPose(compare)} pose={compare} onClose={() => setCompare(null)} />}
    </>
  );
}

/** Before/after comparison of any two photos of the same pose: side by side, or an overlay slider. */
function CompareSheet({ photos, pose, onClose }: { photos: ProgressPhotoRec[]; pose: PhotoPose; onClose: () => void }) {
  // Same-day photos keep their real order (date, then time taken).
  const chrono = [...photos].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const label = (p: ProgressPhotoRec) => {
    const sameDay = chrono.filter((x) => x.date === p.date);
    return sameDay.length > 1 ? `${p.date} (${sameDay.indexOf(p) + 1})` : p.date;
  };
  const [aId, setAId] = useState(chrono[0].id);
  const [bId, setBId] = useState(chrono.at(-1)!.id);
  const [mode, setMode] = useState<"side" | "slider">("slider");
  const [pos, setPos] = useState(50);
  const a = chrono.find((p) => p.id === aId)!;
  const b = chrono.find((p) => p.id === bId)!;
  const select = (value: string, onChange: (v: string) => void, title: string) => (
    <label className="flex-1">
      <span className="text-[11px] text-muted">{title}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-0.5 h-10 w-full rounded-[12px] border border-line bg-card-2 px-2 text-[16px] text-ink outline-none">
        {chrono.map((p) => (
          <option key={p.id} value={p.id} className="bg-[#141414]">
            {label(p)}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <Sheet open onClose={onClose} title={`Jämför · ${POSE_LABEL[pose]}`}>
      <div className="space-y-3">
        <div className="flex gap-2">
          {select(aId, setAId, "Före")}
          {select(bId, setBId, "Efter")}
        </div>
        <PillTabs
          size="sm"
          stretch
          value={mode}
          onChange={setMode}
          options={[
            { value: "slider", label: "Reglage" },
            { value: "side", label: "Sida vid sida" },
          ]}
          className="mx-0 px-0"
        />
        {mode === "side" ? (
          <div className="grid grid-cols-2 gap-2">
            {[a, b].map((p, i) => (
              <div key={p.id + i}>
                <ProgressPhoto photo={p} className="aspect-[3/4] rounded-[12px] border border-line" />
                <div className="mt-1 text-center text-[12px] text-ink-2">
                  {i === 0 ? "Före" : "Efter"} · {label(p)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div className="relative aspect-[3/4] overflow-hidden rounded-[14px] border border-line">
              <ProgressPhoto photo={a} className="absolute inset-0" />
              <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
                <ProgressPhoto photo={b} className="absolute inset-0" />
              </div>
              <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-accent shadow-[0_0_10px_rgba(255,138,61,0.9)]" style={{ left: `${pos}%` }} />
              <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px]">Före · {label(a)}</span>
              <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px]">Efter · {label(b)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={pos}
              onChange={(e) => setPos(Number(e.target.value))}
              aria-label="Jämförelsereglage"
              className="level-slider mt-3 w-full"
              style={{ ["--p" as string]: `${pos}%` }}
            />
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** AI body-fat estimate for one photo, with explicit opt-in before anything leaves the device. */
function AiEstimatePanel({ photo }: { photo: ProgressPhotoRec }) {
  const store = useStore();
  const { s } = store;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const est = photo.aiEstimate;
  const avail = aiAvailability();
  const list = s.body.filter((b) => !b.deletedAt).sort((a, b) => a.date.localeCompare(b.date));
  const near = [...list].reverse().find((b) => b.date <= photo.date) ?? list.at(-1);
  const waist = [...list].reverse().find((b) => b.waistCm != null && b.date <= photo.date)?.waistCm ?? null;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await requestBodyEstimate(photo, {
        sex: s.settings.sex ?? null,
        heightCm: s.settings.heightCm ?? null,
        weightKg: near?.weightKg ?? s.settings.bodyWeightKg ?? null,
        waistCm: waist,
        rfm: rfm(s.settings.heightCm, waist, s.settings.sex),
      });
      await store.setPhotoEstimate(photo.id, result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysen misslyckades.");
    } finally {
      setBusy(false);
    }
  };

  const start = () => (s.settings.aiPhotoConsent ? run() : setConsentOpen(true));

  return (
    <div className="surface rounded-[16px] p-3">
      <div className="flex items-center gap-2 text-[13px] font-semibold">
        <Sparkles size={15} className="text-accent" /> AI-uppskattning av kroppsfett
      </div>
      {est ? (
        <div className="mt-2 text-[13px]">
          {est.assessable ? (
            <>
              <div className="tabular text-[24px] font-bold">
                {fmt(est.bodyFatLow)}–{fmt(est.bodyFatHigh)} %
              </div>
              <div className="text-[12px] text-ink-2">
                Säkerhet: {est.confidence === "high" ? "hög" : est.confidence === "medium" ? "medel" : "låg"} · {est.at.slice(0, 10)}
              </div>
              {est.cues.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[12px] text-ink-2">
                  {est.cues.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-ink-2">Bilden gick inte att bedöma.</p>
          )}
          {est.limitations && <p className="mt-2 text-[11px] text-muted">{est.limitations}</p>}
          <button onClick={start} disabled={busy || !avail.ok} className="mt-2 text-[12px] font-medium text-accent disabled:opacity-40">
            {busy ? "Analyserar…" : "Analysera igen"}
          </button>
        </div>
      ) : (
        <>
          <p className="mt-1 text-[12px] text-ink-2">Ett intervall (±2–3 procentenheter) baserat på bilden. Bäst med samma ljus, vinkel och kläder varje gång.</p>
          <Button size="sm" className="mt-2 w-full" disabled={busy || !avail.ok} onClick={start}>
            {busy ? "Analyserar…" : "Uppskatta kroppsfett"}
          </Button>
        </>
      )}
      {!avail.ok && <p className="mt-2 text-[11px] text-muted">{avail.reason}</p>}
      {error && <p className="mt-2 text-[12px] text-bad">{error}</p>}

      <Sheet open={consentOpen} onClose={() => setConsentOpen(false)} title="Skicka foto för AI-analys?">
        <div className="space-y-3 text-[14px] text-ink-2">
          <p>
            Fotot skickas (nedskalat, utan metadata) till Anthropics API, där Claude uppskattar ett kroppsfettintervall. Appens server sparar inte bilden – bara resultatet sparas, på fotot.
          </p>
          <p>Anthropic behandlar bilden enligt sina villkor för API-data och använder den inte för att träna modeller. Du väljer varje gång vilket foto som analyseras.</p>
          <p className="text-[12px] text-muted">Du kan återkalla samtycket under Inställningar → Övrigt.</p>
          <Button
            size="lg"
            className="w-full"
            onClick={async () => {
              await store.updateSettings({ aiPhotoConsent: true });
              setConsentOpen(false);
              run();
            }}
          >
            Jag godkänner – analysera
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setConsentOpen(false)}>
            Avbryt
          </Button>
        </div>
      </Sheet>
    </div>
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
