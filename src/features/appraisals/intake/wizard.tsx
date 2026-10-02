"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { discardDraftAction, submitAppraisalAction } from "../actions";
import type { ConditionChecklist } from "../condition";
import type { DraftStep } from "../service";
import { missingForSubmit } from "../readiness";
import { customerPayload, vehiclePayload, vehicleSavable } from "./payload";
import { StepCondition } from "./step-condition";
import { StepCustomer } from "./step-customer";
import { StepPhotos } from "./step-photos";
import { StepVehicle } from "./step-vehicle";
import { STEPS, type PhotoRef, type WizardData } from "./types";
import { useDraftSaver } from "./use-draft-saver";

const statusText = { saved: "Saved", saving: "Saving…", retrying: "Offline. Will retry", error: "Not saved" } as const;

export function IntakeWizard({
  appraisalId,
  initial,
  initialStep,
  initialPhotos,
}: {
  appraisalId: string;
  initial: WizardData;
  initialStep: number;
  initialPhotos: PhotoRef[];
}) {
  const router = useRouter();
  const saver = useDraftSaver(appraisalId);
  const [step, setStep] = useState(initialStep);
  const [data, setData] = useState(initial);
  const [photos, setPhotos] = useState(initialPhotos);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [restored, setRestored] = useState(false);
  const dataRef = useRef(data);
  const stepRef = useRef(step);

  // Recover edits that never reached the server (phone locked / signal lost / tab killed last time).
  useEffect(() => {
    const m = saver.restore();
    if (!m) return;
    const next = { ...dataRef.current };
    const p = m.pending as Partial<Record<DraftStep, Record<string, unknown>>>;
    if (p.vehicle) next.vehicle = { ...next.vehicle, ...fromVehiclePayload(p.vehicle) };
    if (p.customer) next.customer = { ...next.customer, ...fromCustomerPayload(p.customer) };
    if (p.condition) next.condition = p.condition as ConditionChecklist;
    dataRef.current = next;
    setData(next);
    setRestored(true);
    setTimeout(() => setRestored(false), 6000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof WizardData>(key: K, patch: Partial<WizardData[K]> | ((cur: WizardData[K]) => Partial<WizardData[K]>)) {
    const resolved = typeof patch === "function" ? patch(dataRef.current[key]) : patch;
    const next = { ...dataRef.current[key], ...resolved } as WizardData[K];
    dataRef.current = { ...dataRef.current, [key]: next };
    setData(dataRef.current);
    if (key === "vehicle") {
      if (vehicleSavable(next as WizardData["vehicle"])) saver.schedule("vehicle", vehiclePayload(next as WizardData["vehicle"]), stepRef.current);
    } else if (key === "customer") {
      saver.schedule("customer", customerPayload(next as WizardData["customer"]), stepRef.current);
    } else {
      saver.schedule("condition", next, stepRef.current);
    }
  }

  async function go(n: number) {
    const target = Math.min(STEPS.length, Math.max(1, n));
    stepRef.current = target;
    saver.schedule("progress", null, target); // remember where to resume
    setStep(target);
    router.replace(`?step=${target}`, { scroll: false });
    window.scrollTo({ top: 0 });
    await saver.flush();
  }

  const missing = missingForSubmit({
    vehicle: {
      year: data.vehicle.year ? Number(data.vehicle.year) : null,
      make: data.vehicle.make || null,
      model: data.vehicle.model || null,
    },
    odometer: data.vehicle.odometer ? Number(data.vehicle.odometer) : null,
    customerName: data.customer.customerName.trim() || null,
    customerPhone: data.customer.customerPhone.trim() || null,
    customerEmail: data.customer.customerEmail.trim() || null,
    condition: data.condition,
    photoSlots: photos.map((p) => p.slot),
  });

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    await saver.flush();
    const res = await submitAppraisalAction(appraisalId).catch(() => null);
    if (res?.ok) {
      saver.clearMirror();
      router.replace(`/appraisals/${appraisalId}`);
      router.refresh();
      return;
    }
    setSubmitError(res ? res.error : "Couldn't reach the server. Your draft is saved. Try again when you have signal.");
    setSubmitting(false);
  }

  async function discard() {
    if (!window.confirm("Discard this draft and its photos?")) return;
    const res = await discardDraftAction(appraisalId).catch(() => null);
    if (res?.ok) {
      saver.clearMirror();
      router.replace("/appraisals");
    }
  }

  const last = step === STEPS.length;

  return (
    <div className="flex flex-col gap-4 pb-28">
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-2 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">
            Step {step} of {STEPS.length} · {STEPS[step - 1]!.title}
          </span>
          <span
            role="status"
            className={saver.status === "saved" ? "text-green-700" : saver.status === "saving" ? "text-neutral-500" : "text-amber-700"}
          >
            {statusText[saver.status]}
          </span>
        </div>
        <ol className="flex gap-1.5" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex-1">
              <button
                type="button"
                onClick={() => void go(i + 1)}
                aria-label={`Go to step ${i + 1}: ${s.title}`}
                aria-current={i + 1 === step ? "step" : undefined}
                className={`h-2 w-full rounded-full ${i + 1 <= step ? "bg-blue-600" : "bg-neutral-200 dark:bg-neutral-800"}`}
              />
            </li>
          ))}
        </ol>
        {restored && <p className="text-xs text-amber-700">Restored changes that hadn’t finished saving.</p>}
        {saver.error && <p role="alert" className="text-xs text-red-600">{saver.error}</p>}
      </div>

      {step === 1 && <StepVehicle value={data.vehicle} onChange={(p) => update("vehicle", p)} />}
      {step === 2 && <StepCustomer value={data.customer} onChange={(p) => update("customer", p)} />}
      {step === 3 && <StepCondition value={data.condition} onChange={(p) => update("condition", p)} />}
      {step === 4 && (
        <>
          <StepPhotos appraisalId={appraisalId} photos={photos} onPhotos={(fn) => setPhotos(fn)} />
          <section className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <h3 className="font-semibold">Ready to submit?</h3>
            {missing.length > 0 ? (
              <>
                <p className="text-sm text-neutral-500">Still needed:</p>
                <ul className="list-disc pl-5 text-sm text-amber-800">
                  {missing.map((m) => <li key={m}>{m}</li>)}
                </ul>
              </>
            ) : (
              <p className="text-sm text-green-700">Everything required is filled in.</p>
            )}
            {submitError && <p role="alert" className="text-sm text-red-600">{submitError}</p>}
            <button type="button" onClick={() => void discard()} className="mt-2 self-start text-sm text-red-600 underline">
              Discard this draft
            </button>
          </section>
        </>
      )}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="mx-auto flex max-w-lg gap-3">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => void go(step - 1)}
            className="h-12 flex-1 rounded-lg border border-neutral-300 font-medium disabled:opacity-40 dark:border-neutral-700"
          >
            Back
          </button>
          {last ? (
            <button
              type="button"
              disabled={missing.length > 0 || submitting}
              onClick={() => void submit()}
              className="h-12 flex-[2] rounded-lg bg-green-600 font-medium text-white disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit appraisal"}
            </button>
          ) : (
            <button type="button" onClick={() => void go(step + 1)} className="h-12 flex-[2] rounded-lg bg-blue-600 font-medium text-white">
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Mirror payloads hold typed values (numbers/null); the form works in strings.
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
function fromVehiclePayload(p: Record<string, unknown>) {
  return { vin: s(p.vin), odometer: s(p.odometer), year: s(p.year), make: s(p.make), model: s(p.model), trim: s(p.trim) };
}
function fromCustomerPayload(p: Record<string, unknown>) {
  const out: Record<string, string | boolean> = {};
  for (const k of ["customerName", "customerPhone", "customerEmail", "purchaseInterest", "stockNumber"]) if (k in p) out[k] = s(p[k]);
  if ("hasLien" in p) out.hasLien = Boolean(p.hasLien);
  return out;
}
