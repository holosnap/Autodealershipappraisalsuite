import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can, type Action } from "@/lib/rbac";
import type { Role } from "@/db/schema";

export type SessionUser = { id: string; name: string; email: string; role: Role; active: boolean };

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as unknown as SessionUser;
  return u.active === false ? null : u;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Call at the top of every server action / query that needs a permission. */
export async function requireCan(action: Action): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, action)) throw new Error("Forbidden");
  return user;
}
