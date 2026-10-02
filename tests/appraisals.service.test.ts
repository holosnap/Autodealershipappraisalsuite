import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";

// Integration tests: need a migrated Postgres. Skipped when DATABASE_URL is unset.
const run = process.env.DATABASE_URL ? describe : describe.skip;

run("appraisal service (db)", () => {
  const tag = `t${Date.now()}`;
  const sp1 = { id: `${tag}-sp1`, role: "salesperson" as const };
  const sp2 = { id: `${tag}-sp2`, role: "salesperson" as const };
  const mgr = { id: `${tag}-mgr`, role: "manager" as const };
  const vin = (n: number) => `9ZZZZ1234LA${String(n).padStart(6, "0")}`;
  const base = { year: 2020, make: "Honda", model: "Accord", odometer: 40000 };
  let svc: typeof import("../src/features/appraisals/service");
  let dbm: typeof import("../src/db");
  let schema: typeof import("../src/db/schema");

  beforeAll(async () => {
    svc = await import("../src/features/appraisals/service");
    dbm = await import("../src/db");
    schema = await import("../src/db/schema");
    await dbm.db.insert(schema.users).values(
      [sp1, sp2, mgr].map((u) => ({ id: u.id, name: u.id, email: `${u.id}@test.local`, role: u.role })),
    );
  });

  afterAll(async () => {
    const ids = [sp1.id, sp2.id, mgr.id];
    await dbm.db.delete(schema.appraisals).where(inArray(schema.appraisals.createdBy, ids));
    await dbm.db.delete(schema.vehicles).where(inArray(schema.vehicles.vin, [vin(1), vin(2)]));
    await dbm.db.delete(schema.users).where(inArray(schema.users.id, ids));
  });

  it("salesperson creates an appraisal and sees only their own", async () => {
    const mine = await svc.createAppraisal(sp1, { ...base, vin: vin(1), conditionNotes: "dent" });
    const theirs = await svc.createAppraisal(sp2, { ...base, vin: vin(2) });

    const list1 = (await svc.listAppraisals(sp1)).map((a) => a.id);
    expect(list1).toContain(mine.id);
    expect(list1).not.toContain(theirs.id);

    expect(await svc.getAppraisal(sp1, theirs.id)).toBeNull();
    expect((await svc.getAppraisal(sp1, mine.id))?.notes).toHaveLength(1);

    const all = (await svc.listAppraisals(mgr)).map((a) => a.id);
    expect(all).toEqual(expect.arrayContaining([mine.id, theirs.id]));
  });

  it("rejects invalid VINs", async () => {
    await expect(svc.createAppraisal(sp1, { ...base, vin: "NOTAVIN" })).rejects.toThrow(svc.ValidationError);
  });

  it("only managers can decide; approve needs an offer, reject needs a reason", async () => {
    const a = await svc.createAppraisal(sp1, { ...base, vin: vin(1) });
    await expect(svc.decideAppraisal(sp1, a.id, { decision: "approved", offerDollars: 1000 })).rejects.toThrow(
      svc.ForbiddenError,
    );
    await expect(svc.decideAppraisal(mgr, a.id, { decision: "approved" })).rejects.toThrow(svc.ValidationError);
    await expect(svc.decideAppraisal(mgr, a.id, { decision: "rejected" })).rejects.toThrow(svc.ValidationError);

    const done = await svc.decideAppraisal(mgr, a.id, { decision: "approved", offerDollars: 18500 });
    expect(done.status).toBe("approved");
    expect(done.offerCents).toBe(1_850_000);
    expect(done.decisionBy).toBe(mgr.id);

    // already decided -> cannot decide twice
    await expect(svc.decideAppraisal(mgr, a.id, { decision: "rejected", reason: "x" })).rejects.toThrow(
      svc.ValidationError,
    );
    const events = await dbm.db.select().from(schema.appraisalEvents).where(eq(schema.appraisalEvents.appraisalId, a.id));
    expect(events.map((e) => e.type).sort()).toEqual(["approved", "submitted"]);
  });
});
