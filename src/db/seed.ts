import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

// Creates (or updates) the first admin. Usage:
//   SEED_ADMIN_EMAIL=you@dealer.com SEED_ADMIN_PASSWORD='...' npm run db:seed
const url = process.env.DATABASE_URL;
const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
if (!url || !email || !password) {
  throw new Error("Set DATABASE_URL, SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD");
}
if (password.length < 10) throw new Error("SEED_ADMIN_PASSWORD must be at least 10 characters");

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
const passwordHash = await hashPassword(password);

if (existing) {
  await db.update(schema.users).set({ role: "admin", active: true }).where(eq(schema.users.id, existing.id));
  await db
    .update(schema.accounts)
    .set({ password: passwordHash })
    .where(eq(schema.accounts.userId, existing.id));
  console.log(`Updated admin ${email}`);
} else {
  const id = randomUUID();
  await db.insert(schema.users).values({ id, email, name: "Admin", role: "admin", emailVerified: true });
  await db.insert(schema.accounts).values({
    id: randomUUID(),
    userId: id,
    accountId: id,
    providerId: "credential",
    password: passwordHash,
  });
  console.log(`Created admin ${email}`);
}
await client.end();
