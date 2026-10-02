"use client";

import type { CustomerForm } from "./types";
import { Field, Segmented, inputCls } from "./ui";

export function StepCustomer({ value, onChange }: { value: CustomerForm; onChange: (patch: Partial<CustomerForm>) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Customer name">
        <input value={value.customerName} onChange={(e) => onChange({ customerName: e.target.value })} autoComplete="off" className={inputCls} />
      </Field>
      <Field label="Phone">
        <input value={value.customerPhone} onChange={(e) => onChange({ customerPhone: e.target.value })} type="tel" inputMode="tel" autoComplete="off" className={inputCls} />
      </Field>
      <Field label="Email" hint="Phone or email is required">
        <input value={value.customerEmail} onChange={(e) => onChange({ customerEmail: e.target.value })} type="email" inputMode="email" autoComplete="off" className={inputCls} />
      </Field>

      <hr className="border-neutral-200 dark:border-neutral-800" />

      <Field label="What are they buying?" hint="e.g. 2025 Tacoma TRD, or “just browsing”">
        <input value={value.purchaseInterest} onChange={(e) => onChange({ purchaseInterest: e.target.value })} className={inputCls} />
      </Field>
      <Field label="Stock # of that vehicle (optional)">
        <input value={value.stockNumber} onChange={(e) => onChange({ stockNumber: e.target.value })} autoCapitalize="characters" className={inputCls} />
      </Field>
      <div className="flex flex-col gap-1 text-sm font-medium">
        Does the customer still owe money on the trade?
        <Segmented
          name="hasLien"
          value={value.hasLien ? "yes" : "no"}
          options={[{ value: "no", label: "No" }, { value: "yes", label: "Yes, payoff needed" }]}
          onChange={(v) => onChange({ hasLien: v === "yes" })}
        />
      </div>
    </div>
  );
}
