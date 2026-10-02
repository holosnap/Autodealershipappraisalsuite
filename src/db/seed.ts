import { hashPassword } from "better-auth/crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

// Demo data for local development. Idempotent: re-running resets the demo users and their appraisals.
//   npm run db:seed
if (process.env.NODE_ENV === "production" && !process.env.ALLOW_PROD_SEED) {
  throw new Error("Refusing to seed demo data in production (set ALLOW_PROD_SEED=1 to override)");
}
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const DEMO_PASSWORD = "password1234";
const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

const demoUsers = [
  { id: "demo-manager", name: "Maria Manager", email: "manager@example.com", role: "manager" as const },
  { id: "demo-sales-1", name: "Sam Sales", email: "sam@example.com", role: "salesperson" as const },
  { id: "demo-sales-2", name: "Sue Seller", email: "sue@example.com", role: "salesperson" as const },
];

await db.transaction(async (tx) => {
  // Reset prior demo data (appraisals cascade to photos/notes/valuations/events).
  for (const u of demoUsers) {
    await tx.delete(schema.appraisals).where(eq(schema.appraisals.createdBy, u.id));
    await tx.delete(schema.users).where(eq(schema.users.id, u.id));
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  for (const u of demoUsers) {
    await tx.insert(schema.users).values({ ...u, emailVerified: true });
    await tx.insert(schema.accounts).values({
      id: `${u.id}-credential`,
      userId: u.id,
      accountId: u.id,
      providerId: "credential",
      password: passwordHash,
    });
  }

  const cars = await tx
    .insert(schema.vehicles)
    .values([
      { vin: "1HGCV1F34LA000001", year: 2020, make: "Honda", model: "Accord", trim: "EX-L", bodyStyle: "Sedan" },
      { vin: "5TDKZ3DC5LS000002", year: 2020, make: "Toyota", model: "Highlander", trim: "XLE", bodyStyle: "SUV" },
      { vin: "1FTFW1E50MFA00003", year: 2021, make: "Ford", model: "F-150", trim: "XLT", bodyStyle: "Truck" },
      { vin: "WBA5R1C50KFH00004", year: 2019, make: "BMW", model: "330i", trim: null, bodyStyle: "Sedan" },
    ])
    .onConflictDoUpdate({ target: schema.vehicles.vin, set: { updatedAt: new Date() } })
    .returning();
  const [accord, highlander, f150, bmw] = cars;

  const [a1, a2, a3, a4] = await tx
    .insert(schema.appraisals)
    .values([
      { vehicleId: accord!.id, createdBy: "demo-sales-1", status: "submitted", odometer: 48210, submittedAt: new Date(), customerName: "J. Rivera" },
      { vehicleId: highlander!.id, createdBy: "demo-sales-1", status: "approved", odometer: 61350, submittedAt: new Date(), offerCents: 2_850_000, decisionBy: "demo-manager", decidedAt: new Date() },
      { vehicleId: f150!.id, createdBy: "demo-sales-2", status: "submitted", odometer: 33890, submittedAt: new Date(), stockNumber: "T-1042" },
      { vehicleId: bmw!.id, createdBy: "demo-sales-2", status: "rejected", odometer: 97400, submittedAt: new Date(), decisionBy: "demo-manager", decidedAt: new Date(), decisionReason: "Frame damage; over mileage limit for our lot." },
    ])
    .returning();

  await tx.insert(schema.conditionNotes).values([
    { appraisalId: a1!.id, authorId: "demo-sales-1", category: "exterior", severity: "minor", body: "Small door ding on passenger side, light curb rash on rear wheels." },
    { appraisalId: a2!.id, authorId: "demo-sales-1", category: "interior", severity: "info", body: "Clean interior, no odors, all keys present." },
    { appraisalId: a3!.id, authorId: "demo-sales-2", category: "mechanical", severity: "moderate", body: "Check-engine light on; customer says it's an O2 sensor." },
    { appraisalId: a4!.id, authorId: "demo-sales-2", category: "paint_body", severity: "major", body: "Visible frame repair under rear bumper." },
  ]);

  await tx.insert(schema.valuationSnapshots).values([
    { appraisalId: a2!.id, createdBy: "demo-manager", source: "manual", kind: "wholesale", valueCents: 2_700_000, odometerAtValuation: 61350 },
    { appraisalId: a2!.id, createdBy: "demo-manager", source: "manual", kind: "retail", valueCents: 3_200_000, odometerAtValuation: 61350 },
  ]);

  await tx.insert(schema.appraisalEvents).values(
    [a1!, a2!, a3!, a4!].map((a) => ({ appraisalId: a.id, actorId: a.createdBy, type: "submitted" })),
  );
});

console.log(`Seeded demo users (password: ${DEMO_PASSWORD}):`);
for (const u of demoUsers) console.log(`  ${u.role.padEnd(11)} ${u.email}`);
await client.end();
