import type { ReactNode } from "react";

export const inputCls =
  "h-12 w-full rounded-lg border border-neutral-300 bg-white px-3 text-base dark:border-neutral-700 dark:bg-neutral-900";
export const textareaCls = `${inputCls} h-auto py-2`;

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-neutral-500">{hint}</span>}
    </label>
  );
}

/** Large touch-friendly single-choice buttons built on real radio inputs (keyboard + screen-reader friendly). */
export function Segmented<T extends string | number>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" className="flex gap-2">
      {options.map((o) => (
        <label key={String(o.value)} className="flex-1">
          <input
            type="radio"
            name={name}
            value={String(o.value)}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="peer sr-only"
          />
          <span className="flex h-12 cursor-pointer items-center justify-center rounded-lg border border-neutral-300 px-2 text-center text-sm font-medium peer-checked:border-blue-600 peer-checked:bg-blue-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-blue-400 dark:border-neutral-700">
            {o.label}
          </span>
        </label>
      ))}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}
