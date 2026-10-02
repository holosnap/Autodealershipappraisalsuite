import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";

// Integration tests: need a migrated Postgres. Skipped when DATABASE_URL is unset.
const run = process.env.DATABASE_URL ? describe : describe.skip;

run("appraisal intake + review (db)", () => {
  const tag = `t${Date.now()}`;
  const sp1 = { id: `${tag}-sp1`, role: "salesperson" as const };
  const sp2 = { id: `${tag}-sp2`, role: "salesperson" as const };
  const mgr = { id: `${tag}-mgr`, role: "manager" as const };
  const vin = (n: number) => `9ZZZZ1234LA${String(n).padStart(6, "0")}`;
  const vinStep = (n: number, extra: object = {}) => ({ vin: vin(n), odometer: 40000, year: 2020, make: "Honda", model: "Accord", ...extra });
  const fullCondition = {
    exterior: { rating: "good" }, interior: { rating: "good" }, mechanical: { rating: "good" }, tires: { rating: "fair" },
    warningLights: { present: false }, smokeOdor: "none", accident: { history: "none" }, keys: 2, aftermarketMods: { present: false },
  };

  let svc: typeof import("../src/features/appraisals/service");
  let storage: typeof import("../src/lib/storage");
  let dbm: typeof import("../src/db");
  let schema: typeof import("../src/db/schema");
  const keys: string[] = [];

  /** Simulates the browser: request target, put bytes in storage, confirm. */
  async function uploadPhoto(user: typeof sp1, appraisalId: string, slot: string) {
    const { photoId } = await svc.requestPhotoUpload(user, appraisalId, { slot, contentType: "image/jpeg", sizeBytes: 100 });
    const row = await dbm.db.query.appraisalPhotos.findFirst({ where: eq(schema.appraisalPhotos.id, photoId) });
    keys.push(row!.storageKey);
    await storage.writeLocal(row!.storageKey, Buffer.from("fake-jpeg"));
    await svc.confirmPhotoUpload(user, photoId, { width: 10, height: 10 });
    return photoId;
  }

  beforeAll(async () => {
    svc = await import("../src/features/appraisals/service");
    storage = await import("../src/lib/storage");
    dbm = await import("../src/db");
    schema = await import("../src/db/schema");
    await dbm.db.insert(schema.users).values([sp1, sp2, mgr].map((u) => ({ id: u.id, name: u.id, email: `${u.id}@test.local`, role: u.role })));
  });

  afterAll(async () => {
    const ids = [sp1.id, sp2.id, mgr.id];
    await dbm.db.delete(schema.appraisals).where(inArray(schema.appraisals.createdBy, ids));
    await dbm.db.delete(schema.vehicles).where(inArray(schema.vehicles.vin, [1, 2, 3, 4].map(vin)));
    await dbm.db.delete(schema.users).where(inArray(schema.users.id, ids));
    await Promise.all(keys.map((k) => storage.removeObject(k)));
  });

  it("step 1 creates a private draft; rejects bad VINs", async () => {
    await expect(svc.createDraft(sp1, { vin: "NOTAVIN" })).rejects.toThrow(svc.ValidationError);
    const d = await svc.createDraft(sp1, vinStep(1));
    expect(d.status).toBe("draft");
    expect(d.wizardStep).toBe(2);

    expect((await svc.listAppraisals(sp1)).map((a) => a.id)).toContain(d.id);
    expect((await svc.listAppraisals(mgr)).map((a) => a.id)).not.toContain(d.id); // drafts stay private
    expect(await svc.getAppraisal(mgr, d.id)).toBeNull();
    expect(await svc.getDraft(sp2, d.id)).toBeNull();
    expect((await svc.getDraft(sp1, d.id))?.vehicle.make).toBe("Honda");
  });

  it("autosaves each step and is idempotent", async () => {
    const d = await svc.createDraft(sp1, vinStep(2));

    await svc.saveDraft(sp1, d.id, "customer", { customerName: " Jo Rivera ", customerPhone: "555-1", customerEmail: "", purchaseInterest: "2025 Civic", hasLien: true }, 2);
    await svc.saveDraft(sp1, d.id, "customer", { customerName: " Jo Rivera ", customerPhone: "555-1", customerEmail: "", purchaseInterest: "2025 Civic", hasLien: true }, 2);
    await svc.saveDraft(sp1, d.id, "condition", { ...fullCondition, keys: 3 }, 3);

    let row = await svc.getDraft(sp1, d.id);
    expect(row).toMatchObject({ customerName: "Jo Rivera", purchaseInterest: "2025 Civic", hasLien: true, keysCount: 3, wizardStep: 3 });
    expect(row?.customerEmail).toBeNull();
    expect(row?.condition?.tires?.rating).toBe("fair");

    await svc.saveDraft(sp1, d.id, "progress", null, 4);
    expect((await svc.getDraft(sp1, d.id))?.wizardStep).toBe(4);

    // correcting the VIN re-points the draft at the right vehicle; odometer updates
    await svc.saveDraft(sp1, d.id, "vehicle", vinStep(3, { odometer: 41000 }), 1);
    row = await svc.getDraft(sp1, d.id);
    expect(row?.vehicle.vin).toBe(vin(3));
    expect(row?.odometer).toBe(41000);

    await expect(svc.saveDraft(sp1, d.id, "customer", { customerEmail: "nope" }, 2)).rejects.toThrow(svc.ValidationError);
    await expect(svc.saveDraft(sp1, d.id, "condition", { smokeOdor: "tons" }, 3)).rejects.toThrow(svc.ValidationError);
  });

  it("other users cannot touch someone else's draft", async () => {
    const d = await svc.createDraft(sp1, vinStep(2));
    await expect(svc.saveDraft(sp2, d.id, "customer", { customerName: "x" }, 2)).rejects.toThrow(svc.NotFoundError);
    await expect(svc.saveDraft(mgr, d.id, "customer", { customerName: "x" }, 2)).rejects.toThrow(svc.NotFoundError);
    await expect(svc.requestPhotoUpload(sp2, d.id, { slot: "front", contentType: "image/jpeg", sizeBytes: 1 })).rejects.toThrow(svc.NotFoundError);
    await expect(svc.submitAppraisal(sp2, d.id)).rejects.toThrow(svc.NotFoundError);
  });

  it("photos: validates input, replaces single-shot slots, keeps multiple damage shots, deletes", async () => {
    const d = await svc.createDraft(sp1, vinStep(2));
    await expect(svc.requestPhotoUpload(sp1, d.id, { slot: "roof", contentType: "image/jpeg", sizeBytes: 1 })).rejects.toThrow(svc.ValidationError);
    await expect(svc.requestPhotoUpload(sp1, d.id, { slot: "front", contentType: "image/gif", sizeBytes: 1 })).rejects.toThrow(svc.ValidationError);
    await expect(svc.requestPhotoUpload(sp1, d.id, { slot: "front", contentType: "image/jpeg", sizeBytes: 50_000_000 })).rejects.toThrow(/too large/);

    // confirming an upload that never reached storage fails
    const { photoId: ghost } = await svc.requestPhotoUpload(sp1, d.id, { slot: "front", contentType: "image/jpeg", sizeBytes: 5 });
    await expect(svc.confirmPhotoUpload(sp1, ghost, {})).rejects.toThrow(/did not complete/);

    const first = await uploadPhoto(sp1, d.id, "front");
    const second = await uploadPhoto(sp1, d.id, "front"); // retake
    const dmg1 = await uploadPhoto(sp1, d.id, "damage");
    const dmg2 = await uploadPhoto(sp1, d.id, "damage");

    const ids = (await svc.getDraft(sp1, d.id))!.photos.map((p) => p.id);
    expect(ids).toContain(second);
    expect(ids).not.toContain(first);
    expect(ids).toEqual(expect.arrayContaining([dmg1, dmg2]));
    expect(ids).not.toContain(ghost); // unconfirmed uploads are never exposed

    await svc.deletePhoto(sp1, dmg1);
    expect((await svc.getDraft(sp1, d.id))!.photos.map((p) => p.id)).not.toContain(dmg1);
  });

  it("submit lists everything missing, then succeeds once complete; managers then review it", async () => {
    const d = await svc.createDraft(sp1, { vin: vin(4) });
    const err = await svc.submitAppraisal(sp1, d.id).catch((e) => e);
    expect(err).toBeInstanceOf(svc.ValidationError);
    expect(err.missing).toEqual(expect.arrayContaining(["Year, make and model", "Odometer", "Customer name", "Front photo", "Smoke odor"]));

    await svc.saveDraft(sp1, d.id, "vehicle", vinStep(4), 1);
    await svc.saveDraft(sp1, d.id, "customer", { customerName: "Jo", customerEmail: "jo@example.com" }, 2);
    await svc.saveDraft(sp1, d.id, "condition", fullCondition, 3);
    for (const slot of ["front", "rear", "driver_side", "passenger_side", "interior_front"]) await uploadPhoto(sp1, d.id, slot);
    await expect(svc.submitAppraisal(sp1, d.id)).rejects.toThrow(/Odometer photo/);
    await uploadPhoto(sp1, d.id, "odometer");

    const done = await svc.submitAppraisal(sp1, d.id);
    expect(done.status).toBe("submitted");
    expect(done.submittedAt).toBeTruthy();

    // locked after submit
    await expect(svc.saveDraft(sp1, d.id, "customer", { customerName: "x" }, 2)).rejects.toThrow(/already been submitted/);
    await expect(svc.submitAppraisal(sp1, d.id)).rejects.toThrow(/already been submitted/);
    expect(await svc.getDraft(sp1, d.id)).toBeNull();

    // salesperson 2 cannot see it; manager can, with photos
    expect(await svc.getAppraisal(sp2, d.id)).toBeNull();
    const seen = await svc.getAppraisal(mgr, d.id);
    expect(seen?.photos).toHaveLength(6);

    // decision rules
    await expect(svc.decideAppraisal(sp1, d.id, { decision: "approved", offerDollars: 1000 })).rejects.toThrow(svc.ForbiddenError);
    await expect(svc.decideAppraisal(mgr, d.id, { decision: "approved" })).rejects.toThrow(svc.ValidationError);
    await expect(svc.decideAppraisal(mgr, d.id, { decision: "rejected" })).rejects.toThrow(svc.ValidationError);
    const decided = await svc.decideAppraisal(mgr, d.id, { decision: "approved", offerDollars: 18500 });
    expect(decided).toMatchObject({ status: "approved", offerCents: 1_850_000, decisionBy: mgr.id });
    await expect(svc.decideAppraisal(mgr, d.id, { decision: "rejected", reason: "x" })).rejects.toThrow(svc.ValidationError);

    const events = await dbm.db.select().from(schema.appraisalEvents).where(eq(schema.appraisalEvents.appraisalId, d.id));
    expect(events.map((e) => e.type).sort()).toEqual(["approved", "draft_created", "submitted"]);
  });

  it("discarding a draft removes it and its photos", async () => {
    const d = await svc.createDraft(sp2, vinStep(2));
    const p = await uploadPhoto(sp2, d.id, "rear");
    await svc.discardDraft(sp2, d.id);
    expect(await svc.getDraft(sp2, d.id)).toBeNull();
    expect(await dbm.db.query.appraisalPhotos.findFirst({ where: eq(schema.appraisalPhotos.id, p) })).toBeUndefined();
  });
});
