import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { getAppraisal } from "@/features/appraisals/service";
import { money, vehicleTitle } from "@/lib/format";
import { StatusBadge } from "../status-badge";
import { DecisionForm } from "./decision-form";

export default async function AppraisalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const a = await getAppraisal(user, id);
  if (!a) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{vehicleTitle(a.vehicle)}</h1>
          <p className="font-mono text-sm text-neutral-500">{a.vehicle.vin}</p>
        </div>
        <StatusBadge status={a.status} />
      </header>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-neutral-500">Odometer</dt><dd>{a.odometer?.toLocaleString()} mi</dd></div>
        <div><dt className="text-neutral-500">Submitted by</dt><dd>{a.creator.name}</dd></div>
        {a.customerName && <div><dt className="text-neutral-500">Customer</dt><dd>{a.customerName}</dd></div>}
        {a.stockNumber && <div><dt className="text-neutral-500">Stock #</dt><dd>{a.stockNumber}</dd></div>}
        <div><dt className="text-neutral-500">Final offer</dt><dd className="font-medium">{money(a.offerCents)}</dd></div>
      </dl>

      {a.status === "rejected" && a.decisionReason && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-900">Rejected: {a.decisionReason}</p>
      )}

      {a.notes.length > 0 && (
        <section>
          <h2 className="mb-2 font-medium">Condition notes</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {a.notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">{n.body}</li>
            ))}
          </ul>
        </section>
      )}

      {a.valuations.length > 0 && (
        <section>
          <h2 className="mb-2 font-medium">Valuations</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {a.valuations.map((v) => (
              <li key={v.id} className="flex justify-between">
                <span>{v.source.replace("_", " ")} · {v.kind.replace("_", " ")}</span>
                <span>{money(v.valueCents)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {can(user.role, "appraisal:decide") && a.status === "submitted" && <DecisionForm id={a.id} />}
    </div>
  );
}
