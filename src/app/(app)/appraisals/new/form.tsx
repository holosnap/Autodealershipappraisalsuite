"use client";

import { useActionState } from "react";
import { createAppraisalAction, type FormState } from "@/features/appraisals/actions";

const input =
  "h-12 w-full rounded-lg border border-neutral-300 px-3 text-base dark:border-neutral-700 dark:bg-neutral-900";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      {children}
    </label>
  );
}

export function NewAppraisalForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createAppraisalAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="VIN">
        <input name="vin" required maxLength={17} autoCapitalize="characters" autoComplete="off" className={`${input} font-mono uppercase`} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Year">
          <input name="year" type="number" inputMode="numeric" required className={input} />
        </Field>
        <Field label="Odometer (mi)">
          <input name="odometer" type="number" inputMode="numeric" required className={input} />
        </Field>
      </div>
      <Field label="Make">
        <input name="make" required className={input} />
      </Field>
      <Field label="Model">
        <input name="model" required className={input} />
      </Field>
      <Field label="Trim (optional)">
        <input name="trim" className={input} />
      </Field>
      <Field label="Customer name (optional)">
        <input name="customerName" autoComplete="off" className={input} />
      </Field>
      <Field label="Condition notes">
        <textarea name="conditionNotes" rows={4} className={`${input} h-auto py-2`} />
      </Field>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button disabled={pending} className="h-12 rounded-lg bg-blue-600 font-medium text-white disabled:opacity-60">
        {pending ? "Submitting…" : "Submit appraisal"}
      </button>
    </form>
  );
}
