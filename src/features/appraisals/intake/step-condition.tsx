"use client";

import { ratings, warningLightOptions, type ConditionChecklist } from "../condition";
import { Section, Segmented, textareaCls } from "./ui";

const ratingOptions = ratings.map((r) => ({ value: r, label: r[0]!.toUpperCase() + r.slice(1) }));
const yesNo = [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }];
type Triple = "yes" | "no" | undefined;
const tri = (b: boolean | undefined): Triple => (b === undefined ? undefined : b ? "yes" : "no");

function Notes({ value, onChange, placeholder }: { value: string | undefined; onChange: (v: string) => void; placeholder: string }) {
  return (
    <textarea
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      rows={2}
      maxLength={500}
      placeholder={placeholder}
      className={textareaCls}
    />
  );
}

export function StepCondition({ value: c, onChange }: { value: ConditionChecklist; onChange: (patch: Partial<ConditionChecklist>) => void }) {
  const lights = c.warningLights?.lights ?? [];
  const sections = [
    ["exterior", "Exterior", "Dents, scratches, paint, glass…"],
    ["interior", "Interior", "Seats, carpets, headliner, electronics…"],
    ["mechanical", "Mechanical", "Engine, transmission, brakes, leaks, noises…"],
    ["tires", "Tires & wheels", "Tread depth, mismatched, curb rash…"],
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      {sections.map(([key, title, placeholder]) => (
        <Section key={key} title={title}>
          <Segmented name={key} value={c[key]?.rating} options={ratingOptions} onChange={(rating) => onChange({ [key]: { ...c[key], rating } })} />
          <Notes value={c[key]?.notes} placeholder={placeholder} onChange={(notes) => onChange({ [key]: { ...c[key], notes } })} />
        </Section>
      ))}

      <Section title="Warning lights on?">
        <Segmented
          name="warn"
          value={tri(c.warningLights?.present)}
          options={yesNo}
          onChange={(v) => onChange({ warningLights: { ...c.warningLights, present: v === "yes" } })}
        />
        {c.warningLights?.present && (
          <>
            <div className="flex flex-wrap gap-2">
              {warningLightOptions.map((o) => (
                <label key={o.value}>
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={lights.includes(o.value)}
                    onChange={(e) =>
                      onChange({
                        warningLights: {
                          ...c.warningLights,
                          lights: e.target.checked ? [...lights, o.value] : lights.filter((l) => l !== o.value),
                        },
                      })
                    }
                  />
                  <span className="flex h-11 cursor-pointer items-center rounded-full border border-neutral-300 px-4 text-sm peer-checked:border-amber-600 peer-checked:bg-amber-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-blue-400 dark:border-neutral-700">
                    {o.label}
                  </span>
                </label>
              ))}
            </div>
            <Notes value={c.warningLights?.notes} placeholder="Anything else about the lights" onChange={(notes) => onChange({ warningLights: { ...c.warningLights, notes } })} />
          </>
        )}
      </Section>

      <Section title="Smoke odor">
        <Segmented
          name="smoke"
          value={c.smokeOdor}
          options={[{ value: "none", label: "None" }, { value: "light", label: "Light" }, { value: "strong", label: "Strong" }]}
          onChange={(smokeOdor) => onChange({ smokeOdor })}
        />
      </Section>

      <Section title="Accident history">
        <Segmented
          name="accident"
          value={c.accident?.history}
          options={[{ value: "none", label: "None" }, { value: "minor", label: "Minor" }, { value: "major", label: "Major" }, { value: "unknown", label: "Unknown" }]}
          onChange={(history) => onChange({ accident: { ...c.accident, history } })}
        />
        {c.accident?.history && c.accident.history !== "none" && (
          <Notes value={c.accident.notes} placeholder="What happened / what was repaired" onChange={(notes) => onChange({ accident: { ...c.accident, notes } })} />
        )}
      </Section>

      <Section title="Number of keys / fobs">
        <Segmented
          name="keys"
          value={c.keys}
          options={[0, 1, 2, 3, 4].map((n) => ({ value: n, label: n === 4 ? "4+" : String(n) }))}
          onChange={(keys) => onChange({ keys })}
        />
      </Section>

      <Section title="Aftermarket modifications">
        <Segmented
          name="mods"
          value={tri(c.aftermarketMods?.present)}
          options={yesNo}
          onChange={(v) => onChange({ aftermarketMods: { ...c.aftermarketMods, present: v === "yes" } })}
        />
        {c.aftermarketMods?.present && (
          <Notes value={c.aftermarketMods.notes} placeholder="Lift, wheels, tune, tint, stereo…" onChange={(notes) => onChange({ aftermarketMods: { ...c.aftermarketMods, notes } })} />
        )}
      </Section>
    </div>
  );
}
