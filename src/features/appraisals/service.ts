import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  appraisalEvents,
  appraisals,
  conditionNotes,
  valuationSnapshots,
  vehicles,
  type Role,
} from "@/db/schema";
import { can, canViewAppraisal } from "@/lib/rbac";
import {
  createAppraisalSchema,
  decideAppraisalSchema,
  type CreateAppraisalInput,
  type DecideAppraisalInput,
} from "./schema";

type Actor = { id: string; role: Role };

export class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
  }
}
export class ValidationError extends Error {}

function assertCan(user: Actor, action: Parameters<typeof can>[1]) {
  if (!can(user.role, action)) throw new ForbiddenError();
}

export async function createAppraisal(user: Actor, raw: CreateAppraisalInput | Record<string, unknown>) {
  assertCan(user, "appraisal:create");
  const parsed = createAppraisalSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
  const input = parsed.data;

  return db.transaction(async (tx) => {
    const [vehicle] = await tx
      .insert(vehicles)
      .values({ vin: input.vin, year: input.year, make: input.make, model: input.model, trim: input.trim })
      .onConflictDoUpdate({
        target: vehicles.vin,
        set: { year: input.year, make: input.make, model: input.model, trim: input.trim ?? null },
      })
      .returning();
    const [appraisal] = await tx
      .insert(appraisals)
      .values({
        vehicleId: vehicle!.id,
        createdBy: user.id,
        status: "submitted",
        submittedAt: new Date(),
        odometer: input.odometer,
        customerName: input.customerName,
        stockNumber: input.stockNumber,
      })
      .returning();
    if (input.conditionNotes) {
      await tx
        .insert(conditionNotes)
        .values({ appraisalId: appraisal!.id, authorId: user.id, body: input.conditionNotes });
    }
    await tx.insert(appraisalEvents).values({
      appraisalId: appraisal!.id,
      actorId: user.id,
      type: "submitted",
    });
    return appraisal!;
  });
}

/** Salespeople get their own appraisals; managers get everything. */
export async function listAppraisals(user: Actor) {
  return db.query.appraisals.findMany({
    where: can(user.role, "appraisal:view_all") ? undefined : eq(appraisals.createdBy, user.id),
    with: { vehicle: true, creator: { columns: { name: true } } },
    orderBy: desc(appraisals.createdAt),
  });
}

/** Returns null when missing OR not visible to this user (so existence isn't leaked). */
export async function getAppraisal(user: Actor, id: string) {
  const row = await db.query.appraisals.findFirst({
    where: eq(appraisals.id, id),
    with: {
      vehicle: true,
      creator: { columns: { name: true } },
      notes: true,
      valuations: { orderBy: desc(valuationSnapshots.valuedAt) },
      events: { orderBy: desc(appraisalEvents.createdAt) },
    },
  });
  return row && canViewAppraisal(user, row) ? row : null;
}

export async function decideAppraisal(user: Actor, id: string, raw: DecideAppraisalInput | Record<string, unknown>) {
  assertCan(user, "appraisal:decide");
  const parsed = decideAppraisalSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
  const { decision, offerDollars, reason } = parsed.data;

  return db.transaction(async (tx) => {
    // Only a submitted appraisal can be decided; the status guard in the WHERE makes this race-safe.
    const [updated] = await tx
      .update(appraisals)
      .set({
        status: decision,
        offerCents: decision === "approved" ? Math.round(offerDollars! * 100) : null,
        decisionBy: user.id,
        decidedAt: new Date(),
        decisionReason: reason ?? null,
      })
      .where(and(eq(appraisals.id, id), eq(appraisals.status, "submitted")))
      .returning();
    if (!updated) throw new ValidationError("Appraisal not found or already decided");
    await tx.insert(appraisalEvents).values({
      appraisalId: id,
      actorId: user.id,
      type: decision,
      payload: { offerCents: updated.offerCents, reason: reason ?? null },
    });
    return updated;
  });
}
