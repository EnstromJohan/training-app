"use client";

import { ChevronsRight } from "lucide-react";
import { animate, useMotionValue, useTransform } from "motion/react";
import * as m from "motion/react-m";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { spring } from "@/lib/motion";
import { cn } from "../ui";

const PAD = 4;
const KNOB = 52;
const THRESHOLD = 0.85;

/** Await an animation, but never longer than `ms`: an interrupted animation's promise may never settle. */
const settle = (anim: { then(onResolve: () => void): unknown }, ms = 600) =>
  Promise.race([new Promise<void>((r) => void anim.then(r)), new Promise<void>((r) => setTimeout(r, ms))]);

/**
 * Drag the knob to the end to confirm. Releasing before 85 % springs back. The knob is a real
 * button: Enter/Space confirms too (keyboard and screen readers don't have to drag).
 */
export function SwipeToConfirm({
  label,
  onConfirm,
  disabled,
  icon,
  className,
}: {
  label: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [max, setMax] = useState(0);
  const [busy, setBusy] = useState(false);
  // Synchronous guard: keydown and a screen reader's click can both arrive for one activation.
  const running = useRef(false);
  const x = useMotionValue(0);
  // Press feedback on an inner layer: `whileTap` on the draggable itself interrupts the x animation.
  const press = useMotionValue(1);
  // The fill is a full-width bar slid in from the left, so it only ever moves (transform), never resizes.
  const fillX = useTransform(x, (v) => v - max);
  const labelOpacity = useTransform(x, [0, Math.max(1, max * 0.6)], [1, 0]);

  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => setMax(Math.max(0, el.clientWidth - KNOB - PAD * 2));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const confirm = async () => {
    if (running.current || disabled) return;
    running.current = true;
    setBusy(true);
    await settle(animate(x, max, spring.snappy));
    try {
      await onConfirm();
    } finally {
      // Let the "done" state register, then snap back quickly so the next set can be swiped.
      await new Promise((r) => setTimeout(r, 120));
      await settle(animate(x, 0, spring.snappy), 500);
      running.current = false;
      setBusy(false);
    }
  };

  return (
    <div
      ref={track}
      className={cn(
        "relative h-[60px] select-none overflow-hidden rounded-full border border-line bg-card-2",
        disabled && "opacity-40",
        className,
      )}
    >
      <m.div aria-hidden className="absolute inset-y-0 left-0 w-full rounded-full bg-accent/25" style={{ x: fillX }} />
      <m.span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center pl-12 text-[15px] font-semibold text-ink-2" style={{ opacity: labelOpacity }}>
        {label}
      </m.span>
      <m.button
        type="button"
        aria-label={label}
        disabled={disabled || busy}
        drag={disabled || busy ? false : "x"}
        dragConstraints={{ left: 0, right: max }}
        dragElastic={0}
        dragMomentum={false}
        style={{ x, width: KNOB, height: KNOB, top: PAD, left: PAD }}
        transition={spring.snappy}
        onPointerDown={() => animate(press, 0.94, spring.snappy)}
        onPointerUp={() => animate(press, 1, spring.snappy)}
        onPointerCancel={() => animate(press, 1, spring.snappy)}
        onDragEnd={() => {
          animate(press, 1, spring.snappy);
          if (max > 0 && x.get() >= max * THRESHOLD) void confirm();
          else animate(x, 0, spring.snappy);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            void confirm();
          }
        }}
        // Screen readers activate with a synthetic click (detail 0); pointer clicks are ignored – drag instead.
        onClick={(e) => {
          if (e.detail === 0) void confirm();
        }}
        className="absolute cursor-grab touch-none rounded-full text-on-accent active:cursor-grabbing"
      >
        <m.span style={{ scale: press }} className="bg-accent-grad glow absolute inset-0 flex items-center justify-center rounded-full">
          {icon ?? <ChevronsRight size={24} strokeWidth={2.2} />}
        </m.span>
      </m.button>
    </div>
  );
}
