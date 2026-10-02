import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/env";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
  emailAndPassword: {
    enabled: true,
    // Accounts are created by an admin (or the seed script), never self-serve.
    disableSignUp: true,
    minPasswordLength: 10,
  },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "salesperson", input: false },
      active: { type: "boolean", required: false, defaultValue: true, input: false },
    },
  },
  plugins: [nextCookies()],
});
