import { missingCondition, type ConditionChecklist } from "./condition";
import { requiredSlots, slotLabel } from "./photo-slots";

type Draft = {
  vehicle: { year: number | null; make: string | null; model: string | null };
  odometer: number | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  condition: ConditionChecklist | null;
  photoSlots: string[]; // slots with an uploaded photo
};

/** Everything still missing before a draft can be submitted (client + server share this). */
export function missingForSubmit(d: Draft): string[] {
  const m: string[] = [];
  if (!d.vehicle.year || !d.vehicle.make || !d.vehicle.model) m.push("Year, make and model");
  if (d.odometer == null) m.push("Odometer");
  if (!d.customerName) m.push("Customer name");
  if (!d.customerPhone && !d.customerEmail) m.push("Customer phone or email");
  m.push(...missingCondition(d.condition));
  for (const slot of requiredSlots) if (!d.photoSlots.includes(slot)) m.push(`${slotLabel(slot)} photo`);
  return m;
}
