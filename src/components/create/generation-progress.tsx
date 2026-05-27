"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  Clock,
  Layers,
  Loader2,
  Save,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * The four SSE `status` steps emitted by /api/designs/generate, in order.
 * Order matters here — `GenerationProgress` infers "all earlier steps are
 * done" from the index of the currently-active step.
 */
export type GenerationStep = "generating" | "moderation" | "analyzing" | "saving";

type StepMeta = {
  id: GenerationStep;
  label: string;
  estimate: string;
  Icon: typeof Wand2;
};

const STEPS: StepMeta[] = [
  { id: "generating", label: "Generating your design with AI", estimate: "~15s", Icon: Wand2 },
  { id: "moderation", label: "Running safety checks", estimate: "~2s", Icon: ShieldCheck },
  { id: "analyzing", label: "Inspecting transparency", estimate: "~1s", Icon: Layers },
  { id: "saving", label: "Saving to your library", estimate: "~1s", Icon: Save },
];

/**
 * Rotated through every ~10s while the generate request is in flight. The
 * 60s threshold swaps to a calmer "service may be slow" warning instead of
 * cheerfully claiming we're almost done.
 */
const REASSURANCE = [
  "AI image generation usually takes 10–30 seconds…",
  "Almost there — wrapping up the finishing touches…",
  "Hang tight — this design will be worth the wait!",
];
const STUCK_AFTER_S = 60;

export function GenerationProgress({
  prompt,
  activeStep,
  onCancel,
}: {
  prompt: string;
  /** `null` before the first SSE event lands — treat as "generating" so the
   * first row lights up immediately while we wait for the Gemini call. */
  activeStep: GenerationStep | null;
  onCancel: () => void;
}) {
  // `Date.now()` is impure, so it can't be the `useRef` initialiser under
  // React 19's purity rules. Seed in an effect instead and start ticking
  // from there.
  const startedAtRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    startedAtRef.current = Date.now();
    const id = setInterval(() => {
      if (startedAtRef.current == null) return;
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const activeIdx = activeStep ? STEPS.findIndex((s) => s.id === activeStep) : 0;
  const stuck = elapsed >= STUCK_AFTER_S;

  let reassuranceIdx = 0;
  if (elapsed >= 20) reassuranceIdx = 2;
  else if (elapsed >= 10) reassuranceIdx = 1;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className="mx-auto max-w-xl"
    >
      <Card className="overflow-hidden border-border/50 bg-card p-0">
        <div
          className="relative h-1 w-full overflow-hidden bg-muted"
          role="progressbar"
          aria-label="Generating design"
          aria-valuetext="In progress"
        >
          <motion.div
            className="absolute top-0 h-full w-1/3 rounded-r-full bg-gradient-to-r from-primary/0 via-primary to-primary/0"
            initial={{ x: "-100%" }}
            animate={{ x: "350%" }}
            transition={{ duration: 1.6, ease: "linear", repeat: Infinity }}
          />
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Creating your design</h2>
              {prompt && (
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {`"${prompt}"`}
                </p>
              )}
            </div>
            <div
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-sm tabular-nums text-muted-foreground"
              aria-label={`Elapsed: ${elapsed} seconds`}
            >
              <Clock className="h-3.5 w-3.5" aria-hidden />
              <span>{elapsed}s</span>
            </div>
          </div>

          <ul className="mt-6 space-y-2">
            {STEPS.map((step, idx) => {
              const isDone = idx < activeIdx;
              const isActive = idx === activeIdx;
              const isPending = idx > activeIdx;
              const Icon = step.Icon;
              return (
                <li
                  key={step.id}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                    isDone
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : isActive
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/40 bg-background/40"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      isDone
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : isActive
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                    }`}
                    aria-hidden
                  >
                    {isDone ? (
                      <Check className="h-4 w-4" />
                    ) : isActive ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium ${
                        isPending ? "text-muted-foreground" : "text-foreground"
                      }`}
                    >
                      {step.label}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                    {step.estimate}
                  </span>
                </li>
              );
            })}
          </ul>

          <div
            aria-live="polite"
            className={`mt-5 rounded-lg border px-4 py-3 text-sm leading-relaxed ${
              stuck
                ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100"
                : "border-border/60 bg-muted/40 text-muted-foreground"
            }`}
          >
            {stuck
              ? "This is taking longer than usual — the AI service may be slow. You can wait or cancel and try again."
              : REASSURANCE[reassuranceIdx]}
          </div>

          <div className="mt-5 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
