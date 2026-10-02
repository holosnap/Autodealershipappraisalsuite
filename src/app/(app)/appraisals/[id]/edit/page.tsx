import { redirect } from "next/navigation";
import { getDraft } from "@/features/appraisals/service";
import { IntakeWizard } from "@/features/appraisals/intake/wizard";
import type { WizardData } from "@/features/appraisals/intake/types";
import { requireUser } from "@/lib/session";

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export default async function EditDraftPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const [{ id }, { step }, user] = await Promise.all([params, searchParams, requireUser()]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/appraisals");
  const d = await getDraft(user, id);
  if (!d) redirect(`/appraisals/${id}`); // submitted (or not yours): the read-only view decides what to show

  const initial: WizardData = {
    vehicle: { vin: d.vehicle.vin, odometer: str(d.odometer), year: str(d.vehicle.year), make: str(d.vehicle.make), model: str(d.vehicle.model), trim: str(d.vehicle.trim) },
    customer: {
      customerName: str(d.customerName),
      customerPhone: str(d.customerPhone),
      customerEmail: str(d.customerEmail),
      purchaseInterest: str(d.purchaseInterest),
      stockNumber: str(d.stockNumber),
      hasLien: d.hasLien,
    },
    condition: d.condition ?? {},
  };
  const initialStep = Math.min(4, Math.max(1, Number(step) || d.wizardStep));

  return (
    <div className="mx-auto max-w-lg">
      <IntakeWizard
        key={d.id}
        appraisalId={d.id}
        initial={initial}
        initialStep={initialStep}
        initialPhotos={d.photos.map((p) => ({ id: p.id, slot: p.slot }))}
      />
    </div>
  );
}
