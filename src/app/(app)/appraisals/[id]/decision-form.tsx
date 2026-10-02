"use client";

import { useActionState } from "react";
import { decideAppraisalAction, type FormState } from "@/features/appraisals/actions";

const input =
  "h-12 w-full rounded-lg border border-neutral-300 px-3 text-base dark:border-neutral-700 dark:bg-neutral-900";

export function DecisionForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(decideAppraisalAction.bind(null, id), {});
  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="font-medium">Decision</h2>
      <label className="flex flex-col gap-1 text-sm">
        Final offer (USD) — required to approve
        <input name="offerDollars" type="number" inputMode="decimal" min="0" step="1" className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Reason — required to reject
        <textarea name="reason" rows={2} className={`${input} h-auto py-2`} />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <button name="decision" value="rejected" disabled={pending} className="h-12 rounded-lg border border-red-600 font-medium text-red-600 disabled:opacity-60">
          Reject
        </button>
        <button name="decision" value="approved" disabled={pending} className="h-12 rounded-lg bg-green-600 font-medium text-white disabled:opacity-60">
          Approve
        </button>
      </div>
    </form>
  );
}
