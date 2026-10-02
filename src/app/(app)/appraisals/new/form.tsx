"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createDraftAction } from "@/features/appraisals/actions";
import { vehiclePayload, vehicleSavable } from "@/features/appraisals/intake/payload";
import { StepVehicle } from "@/features/appraisals/intake/step-vehicle";
import type { VehicleForm } from "@/features/appraisals/intake/types";

const STASH = "appraisal-draft:new";
const empty: VehicleForm = { vin: "", odometer: "", year: "", make: "", model: "", trim: "" };

/** Step 1 before a draft exists. Typed/scanned values are stashed locally until "Continue" creates the draft. */
export function NewAppraisalForm() {
  const router = useRouter();
  const [value, setValue] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STASH);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from localStorage, which isn't available during SSR
      if (raw) setValue({ ...empty, ...JSON.parse(raw) });
    } catch {}
  }, []);

  function onChange(patch: Partial<VehicleForm> | ((cur: VehicleForm) => Partial<VehicleForm>)) {
    setValue((v) => {
      const next = { ...v, ...(typeof patch === "function" ? patch(v) : patch) };
      try {
        localStorage.setItem(STASH, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  async function onContinue() {
    setPending(true);
    setError(null);
    const res = await createDraftAction(vehiclePayload(value)).catch(() => null);
    if (res?.ok) {
      try {
        localStorage.removeItem(STASH);
      } catch {}
      router.replace(`/appraisals/${res.id}/edit?step=2`);
      return;
    }
    setError(res ? res.error : "Couldn't reach the server. Check your signal and try again.");
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-4 pb-28">
      <p className="text-sm font-semibold">Step 1 of 4 · Vehicle</p>
      <StepVehicle value={value} onChange={onChange} />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            disabled={!vehicleSavable(value) || pending}
            onClick={() => void onContinue()}
            className="h-12 w-full rounded-lg bg-blue-600 font-medium text-white disabled:opacity-50"
          >
            {pending ? "Saving…" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
