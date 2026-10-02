/* eslint-disable @next/next/no-img-element -- photos come from an authenticated route */
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { getAppraisal } from "@/features/appraisals/service";
import { warningLightOptions, type ConditionChecklist } from "@/features/appraisals/condition";
import { photoSlots } from "@/features/appraisals/photo-slots";
import { money, vehicleTitle } from "@/lib/format";
import { StatusBadge } from "../status-badge";
import { DecisionForm } from "./decision-form";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function conditionRows(c: ConditionChecklist | null, keys: number | null): [string, string][] {
  if (!c) return [];
  const rows: [string, string | undefined][] = [
    ["Exterior", c.exterior?.rating && `${cap(c.exterior.rating)}${c.exterior.notes ? ` · ${c.exterior.notes}` : ""}`],
    ["Interior", c.interior?.rating && `${cap(c.interior.rating)}${c.interior.notes ? ` · ${c.interior.notes}` : ""}`],
    ["Mechanical", c.mechanical?.rating && `${cap(c.mechanical.rating)}${c.mechanical.notes ? ` · ${c.mechanical.notes}` : ""}`],
    ["Tires", c.tires?.rating && `${cap(c.tires.rating)}${c.tires.notes ? ` · ${c.tires.notes}` : ""}`],
    [
      "Warning lights",
      c.warningLights?.present === undefined
        ? undefined
        : c.warningLights.present
          ? (c.warningLights.lights ?? []).map((l) => warningLightOptions.find((o) => o.value === l)?.label ?? l).join(", ") +
            (c.warningLights.notes ? ` · ${c.warningLights.notes}` : "")
          : "None",
    ],
    ["Smoke odor", c.smokeOdor && cap(c.smokeOdor)],
    ["Accident history", c.accident?.history && `${cap(c.accident.history)}${c.accident.notes ? ` · ${c.accident.notes}` : ""}`],
    ["Keys", keys === null ? undefined : String(keys)],
    [
      "Aftermarket mods",
      c.aftermarketMods?.present === undefined ? undefined : c.aftermarketMods.present ? c.aftermarketMods.notes || "Yes" : "None",
    ],
  ];
  return rows.filter((r): r is [string, string] => !!r[1]);
}

export default async function AppraisalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const a = await getAppraisal(user, id);
  if (!a) notFound();
  if (a.status === "draft") redirect(`/appraisals/${a.id}/edit`); // only the author can see a draft; continue the intake

  const rows = conditionRows(a.condition, a.keysCount);
  const bySlot = photoSlots.map((s) => ({ ...s, photos: a.photos.filter((p) => p.slot === s.slot) })).filter((s) => s.photos.length);

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
        {(a.customerPhone || a.customerEmail) && (
          <div><dt className="text-neutral-500">Contact</dt><dd className="break-words">{[a.customerPhone, a.customerEmail].filter(Boolean).join(" · ")}</dd></div>
        )}
        {a.purchaseInterest && <div><dt className="text-neutral-500">Buying</dt><dd>{a.purchaseInterest}{a.stockNumber ? ` (#${a.stockNumber})` : ""}</dd></div>}
        <div><dt className="text-neutral-500">Owes on trade</dt><dd>{a.hasLien ? "Yes, payoff needed" : "No"}</dd></div>
        <div><dt className="text-neutral-500">Final offer</dt><dd className="font-medium">{money(a.offerCents)}</dd></div>
      </dl>

      {a.status === "rejected" && a.decisionReason && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-900">Rejected: {a.decisionReason}</p>
      )}

      {rows.length > 0 && (
        <section>
          <h2 className="mb-2 font-medium">Condition</h2>
          <dl className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 text-sm dark:divide-neutral-800 dark:border-neutral-800">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-3 py-2">
                <dt className="text-neutral-500">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {a.notes.length > 0 && (
        <section>
          <h2 className="mb-2 font-medium">Notes</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {a.notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">{n.body}</li>
            ))}
          </ul>
        </section>
      )}

      {bySlot.length > 0 && (
        <section>
          <h2 className="mb-2 font-medium">Photos</h2>
          <div className="flex flex-col gap-4">
            {bySlot.map((s) => (
              <div key={s.slot}>
                <h3 className="mb-1 text-sm text-neutral-500">{s.label}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {s.photos.map((p) => (
                    <a key={p.id} href={`/api/photos/${p.id}`} target="_blank" rel="noreferrer">
                      <img src={`/api/photos/${p.id}`} alt={`${s.label}`} loading="lazy" className="aspect-[4/3] w-full rounded-lg object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
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
