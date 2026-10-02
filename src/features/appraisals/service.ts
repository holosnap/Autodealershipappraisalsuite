import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, ne, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  appraisalEvents,
  appraisalPhotos,
  appraisals,
  valuationSnapshots,
  vehicles,
  type Role,
} from "@/db/schema";
import { can, canEditDraft, canViewAppraisal } from "@/lib/rbac";
import { extFor, getUploadTarget, objectExists, removeObject } from "@/lib/storage";
import { conditionSchema } from "./condition";
import { MAX_DAMAGE_PHOTOS, MAX_PHOTO_BYTES, photoSlots } from "./photo-slots";
import { missingForSubmit } from "./readiness";
import {
  customerStepSchema,
  decideAppraisalSchema,
  vehicleStepSchema,
  type DecideAppraisalInput,
  type VehicleStep,
} from "./schema";

type Actor = { id: string; role: Role };

export class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
  }
}
export class NotFoundError extends Error {
  constructor() {
    super("Not found");
  }
}
export class ValidationError extends Error {
  constructor(
    message: string,
    readonly missing?: string[],
  ) {
    super(message);
  }
}

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid input";
const defined = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

function assertCan(user: Actor, action: Parameters<typeof can>[1]) {
  if (!can(user.role, action)) throw new ForbiddenError();
}

/** Loads an appraisal the user may edit (own + draft) or throws. */
async function loadEditableDraft(user: Actor, id: string) {
  const row = await db.query.appraisals.findFirst({ where: eq(appraisals.id, id), with: { vehicle: true } });
  if (!row || row.createdBy !== user.id) throw new NotFoundError(); // don't reveal other people's appraisals
  if (!canEditDraft(user, row)) throw new ValidationError("This appraisal has already been submitted");
  return row;
}

/** Find or create the vehicle for a VIN, filling in any details supplied (never blanking known ones). */
async function upsertVehicle(tx: Pick<typeof db, "insert">, v: VehicleStep) {
  const attrs = defined({ year: v.year, make: v.make, model: v.model, trim: v.trim });
  const [row] = await tx
    .insert(vehicles)
    .values({ vin: v.vin, ...attrs })
    .onConflictDoUpdate({ target: vehicles.vin, set: { ...attrs, updatedAt: new Date() } })
    .returning();
  return row!;
}

// ---------------------------------------------------------------- drafts

/** Step 1 "Continue": the first point at which a draft exists (it needs a VIN). */
export async function createDraft(user: Actor, raw: unknown) {
  assertCan(user, "appraisal:create");
  const parsed = vehicleStepSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));
  const input = parsed.data;

  return db.transaction(async (tx) => {
    const vehicle = await upsertVehicle(tx, input);
    const [appraisal] = await tx
      .insert(appraisals)
      .values({
        vehicleId: vehicle.id,
        createdBy: user.id,
        status: "draft",
        odometer: input.odometer ?? null,
        wizardStep: 2,
      })
      .returning();
    await tx.insert(appraisalEvents).values({ appraisalId: appraisal!.id, actorId: user.id, type: "draft_created" });
    return appraisal!;
  });
}

export type DraftStep = "vehicle" | "customer" | "condition" | "progress";

/** Autosave for one wizard step. Idempotent; safe to call repeatedly with the same data. */
export async function saveDraft(user: Actor, id: string, step: DraftStep, raw: unknown, stepNumber: number) {
  const row = await loadEditableDraft(user, id);
  const wizardStep = Math.min(4, Math.max(1, Math.trunc(stepNumber) || 1));
  let patch: Partial<typeof appraisals.$inferInsert> = {};

  if (step === "vehicle") {
    const parsed = vehicleStepSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));
    const v = parsed.data;
    patch = defined({ odometer: v.odometer });
    await db.transaction(async (tx) => {
      const vehicle = await upsertVehicle(tx, v); // a corrected VIN re-points the appraisal at that vehicle
      await tx
        .update(appraisals)
        .set({ ...patch, vehicleId: vehicle.id, wizardStep })
        .where(eq(appraisals.id, id));
    });
    return { savedAt: new Date().toISOString() };
  } else if (step === "customer") {
    const parsed = customerStepSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));
    patch = defined(parsed.data);
  } else if (step === "progress") {
    // navigation only: remember which step the user is on so the draft resumes there
  } else {
    const parsed = conditionSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));
    patch = { condition: parsed.data, keysCount: parsed.data.keys ?? null };
  }

  await db.update(appraisals).set({ ...patch, wizardStep }).where(eq(appraisals.id, row.id));
  return { savedAt: new Date().toISOString() };
}

const draftWith = {
  vehicle: true,
  photos: { where: eq(appraisalPhotos.status, "uploaded"), orderBy: asc(appraisalPhotos.sortOrder) },
} as const;

/** The editable draft with its uploaded photos, or null if it isn't the caller's open draft. */
export async function getDraft(user: Actor, id: string) {
  const row = await db.query.appraisals.findFirst({ where: eq(appraisals.id, id), with: draftWith });
  return row && canEditDraft(user, row) ? row : null;
}

export async function submitAppraisal(user: Actor, id: string) {
  const row = await loadEditableDraft(user, id);
  const photos = await db
    .select({ slot: appraisalPhotos.slot })
    .from(appraisalPhotos)
    .where(and(eq(appraisalPhotos.appraisalId, id), eq(appraisalPhotos.status, "uploaded")));
  const missing = missingForSubmit({
    vehicle: row.vehicle,
    odometer: row.odometer,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    customerEmail: row.customerEmail,
    condition: row.condition,
    photoSlots: photos.map((p) => p.slot),
  });
  if (missing.length) throw new ValidationError(`Still needed: ${missing.join(", ")}`, missing);

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(appraisals)
      .set({ status: "submitted", submittedAt: new Date() })
      .where(and(eq(appraisals.id, id), eq(appraisals.status, "draft")))
      .returning();
    if (!updated) throw new ValidationError("This appraisal has already been submitted");
    await tx.insert(appraisalEvents).values({ appraisalId: id, actorId: user.id, type: "submitted" });
    return updated;
  });
}

export async function discardDraft(user: Actor, id: string) {
  await loadEditableDraft(user, id);
  const photos = await db.select({ key: appraisalPhotos.storageKey }).from(appraisalPhotos).where(eq(appraisalPhotos.appraisalId, id));
  await db.delete(appraisals).where(eq(appraisals.id, id)); // cascades to photos/notes/events
  await Promise.all(photos.map((p) => removeObject(p.key)));
}

// ---------------------------------------------------------------- photos

const requestPhotoSchema = z.object({
  slot: z.enum(photoSlots.map((s) => s.slot) as [string, ...string[]]),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().positive().max(MAX_PHOTO_BYTES, "Photo is too large (max 6 MB)"),
});

/** Step 1 of an upload: register a pending photo and hand back where to PUT the bytes. */
export async function requestPhotoUpload(user: Actor, appraisalId: string, raw: unknown) {
  await loadEditableDraft(user, appraisalId);
  const parsed = requestPhotoSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));
  const { slot, contentType, sizeBytes } = parsed.data;

  const def = photoSlots.find((s) => s.slot === slot)!;
  if (def.multiple) {
    const [{ n } = { n: 0 }] = await db
      .select({ n: count() })
      .from(appraisalPhotos)
      .where(and(eq(appraisalPhotos.appraisalId, appraisalId), eq(appraisalPhotos.slot, slot as never)));
    if (n >= MAX_DAMAGE_PHOTOS) throw new ValidationError(`At most ${MAX_DAMAGE_PHOTOS} damage photos`);
  }

  const photoId = randomUUID();
  const key = `appraisals/${appraisalId}/${photoId}.${extFor(contentType)}`;
  await db.insert(appraisalPhotos).values({
    id: photoId,
    appraisalId,
    uploadedBy: user.id,
    slot: slot as never,
    storageKey: key,
    contentType,
    sizeBytes,
    status: "pending",
    sortOrder: Date.now() % 2_000_000_000,
  });
  return { photoId, upload: await getUploadTarget(photoId, key, contentType) };
}

/** Step 2 of an upload: bytes are in storage, so make the photo real (and replace the previous one for single-shot slots). */
export async function confirmPhotoUpload(user: Actor, photoId: string, dims: { width?: number; height?: number }) {
  const photo = await db.query.appraisalPhotos.findFirst({ where: eq(appraisalPhotos.id, photoId) });
  if (!photo) throw new NotFoundError();
  await loadEditableDraft(user, photo.appraisalId);
  if (!(await objectExists(photo.storageKey))) throw new ValidationError("Upload did not complete, please retry");

  const def = photoSlots.find((s) => s.slot === photo.slot);
  const replaced = await db.transaction(async (tx) => {
    await tx
      .update(appraisalPhotos)
      .set({ status: "uploaded", width: dims.width ?? null, height: dims.height ?? null })
      .where(eq(appraisalPhotos.id, photoId));
    if (def?.multiple) return [];
    return tx
      .delete(appraisalPhotos)
      .where(
        and(
          eq(appraisalPhotos.appraisalId, photo.appraisalId),
          eq(appraisalPhotos.slot, photo.slot),
          ne(appraisalPhotos.id, photoId),
        ),
      )
      .returning({ key: appraisalPhotos.storageKey });
  });
  await Promise.all(replaced.map((p) => removeObject(p.key)));
  return { photoId };
}

export async function deletePhoto(user: Actor, photoId: string) {
  const photo = await db.query.appraisalPhotos.findFirst({ where: eq(appraisalPhotos.id, photoId) });
  if (!photo) throw new NotFoundError();
  await loadEditableDraft(user, photo.appraisalId);
  await db.delete(appraisalPhotos).where(eq(appraisalPhotos.id, photoId));
  await removeObject(photo.storageKey);
}

// ---------------------------------------------------------------- viewing & deciding

/** Salespeople: their own. Managers: their own drafts plus everyone's submitted work. */
export async function listAppraisals(user: Actor) {
  const visible = can(user.role, "appraisal:view_all")
    ? or(eq(appraisals.createdBy, user.id), ne(appraisals.status, "draft"))
    : eq(appraisals.createdBy, user.id);
  return db.query.appraisals.findMany({
    where: visible,
    with: { vehicle: true, creator: { columns: { name: true } } },
    orderBy: desc(appraisals.updatedAt),
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
      photos: { where: eq(appraisalPhotos.status, "uploaded"), orderBy: asc(appraisalPhotos.sortOrder) },
      valuations: { orderBy: desc(valuationSnapshots.valuedAt) },
      events: { orderBy: desc(appraisalEvents.createdAt) },
    },
  });
  return row && canViewAppraisal(user, row) ? row : null;
}

export async function decideAppraisal(user: Actor, id: string, raw: DecideAppraisalInput | Record<string, unknown>) {
  assertCan(user, "appraisal:decide");
  const parsed = decideAppraisalSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));
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
