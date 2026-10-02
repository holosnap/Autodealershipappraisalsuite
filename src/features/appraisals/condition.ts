import { z } from "zod";

export const ratings = ["excellent", "good", "fair", "poor"] as const;
export const warningLightOptions = [
  { value: "check_engine", label: "Check engine" },
  { value: "abs", label: "ABS" },
  { value: "airbag", label: "Airbag" },
  { value: "tpms", label: "Tire pressure" },
  { value: "battery", label: "Battery / charging" },
  { value: "oil", label: "Oil pressure" },
  { value: "other", label: "Other" },
] as const;

const note = z.string().trim().max(500).optional();
const section = z.object({ rating: z.enum(ratings).optional(), notes: note });

/** Every field optional so a half-finished checklist can be saved as a draft. */
export const conditionSchema = z.object({
  exterior: section.optional(),
  interior: section.optional(),
  mechanical: section.optional(),
  tires: section.optional(),
  warningLights: z
    .object({
      present: z.boolean().optional(),
      lights: z.array(z.enum(warningLightOptions.map((o) => o.value) as [string, ...string[]])).optional(),
      notes: note,
    })
    .optional(),
  smokeOdor: z.enum(["none", "light", "strong"]).optional(),
  accident: z.object({ history: z.enum(["none", "minor", "major", "unknown"]).optional(), notes: note }).optional(),
  keys: z.number().int().min(0).max(9).optional(),
  aftermarketMods: z.object({ present: z.boolean().optional(), notes: note }).optional(),
});
export type ConditionChecklist = z.infer<typeof conditionSchema>;

/** Labels of checklist items still unanswered; empty array means complete. */
export function missingCondition(c: ConditionChecklist | null | undefined): string[] {
  const m: string[] = [];
  const x = c ?? {};
  for (const k of ["exterior", "interior", "mechanical", "tires"] as const) {
    if (!x[k]?.rating) m.push(`${k[0]!.toUpperCase()}${k.slice(1)} condition`);
  }
  if (x.warningLights?.present === undefined) m.push("Warning lights");
  else if (x.warningLights.present && !x.warningLights.lights?.length) m.push("Which warning lights are on");
  if (!x.smokeOdor) m.push("Smoke odor");
  if (!x.accident?.history) m.push("Accident history");
  if (x.keys === undefined) m.push("Number of keys");
  if (x.aftermarketMods?.present === undefined) m.push("Aftermarket modifications");
  return m;
}
