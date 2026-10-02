import Link from "next/link";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { listAppraisals } from "@/features/appraisals/service";
import { money, vehicleTitle } from "@/lib/format";
import { StatusBadge } from "./status-badge";

export default async function AppraisalsPage() {
  const user = await requireUser();
  const rows = await listAppraisals(user);
  const isManager = can(user.role, "appraisal:view_all");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{isManager ? "All appraisals" : "My appraisals"}</h1>
        <Link href="/appraisals/new" className="flex h-11 items-center rounded-lg bg-blue-600 px-4 font-medium text-white">
          New appraisal
        </Link>
      </div>
      {rows.length === 0 && <p className="text-neutral-500">No appraisals yet.</p>}
      <ul className="flex flex-col gap-3">
        {rows.map((a) => (
          <li key={a.id}>
            <Link
              href={a.status === "draft" ? `/appraisals/${a.id}/edit` : `/appraisals/${a.id}`}
              className="flex flex-col gap-1 rounded-xl border border-neutral-200 p-4 active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-900"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{vehicleTitle(a.vehicle)}</span>
                <StatusBadge status={a.status} />
              </div>
              <span className="text-sm text-neutral-500">
                {a.odometer?.toLocaleString()} mi · VIN …{a.vehicle.vin.slice(-6)}
                {isManager && ` · ${a.creator.name}`}
              </span>
              {a.status === "draft" && (
                <span className="text-sm font-medium text-blue-700">Continue · step {a.wizardStep} of 4</span>
              )}
              {a.offerCents != null && <span className="text-sm">Offer: {money(a.offerCents)}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
