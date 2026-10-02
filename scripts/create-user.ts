import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";

// Create or update a real account (sign-up is disabled in the app).
//   npm run user:create -- <email> "<name>" <salesperson|manager> <password>
const [email, name, role, password] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!url || !email || !name || !password || !["salesperson", "manager"].includes(role ?? "")) {
  console.error('Usage: DATABASE_URL=... npm run user:create -- <email> "<name>" <salesperson|manager> <password>');
  process.exit(1);
}
if (password.length < 10) {
  console.error("Password must be at least 10 characters");
  process.exit(1);
}

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });
const passwordHash = await hashPassword(password);
const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });

if (existing) {
  await db.update(schema.users).set({ name, role: role as schema.Role, active: true }).where(eq(schema.users.id, existing.id));
  await db.update(schema.accounts).set({ password: passwordHash }).where(eq(schema.accounts.userId, existing.id));
  console.log(`Updated ${role} ${email}`);
} else {
  const id = randomUUID();
  await db.insert(schema.users).values({ id, email, name, role: role as schema.Role, emailVerified: true });
  await db.insert(schema.accounts).values({ id: randomUUID(), userId: id, accountId: id, providerId: "credential", password: passwordHash });
  console.log(`Created ${role} ${email}`);
}
await client.end();
