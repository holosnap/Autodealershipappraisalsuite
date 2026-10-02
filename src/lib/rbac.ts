import type { Role } from "@/db/schema";

export type Action = "appraisal:create" | "appraisal:view_all" | "appraisal:decide";

const permissions: Record<Role, ReadonlySet<Action>> = {
  salesperson: new Set<Action>(["appraisal:create"]),
  manager: new Set<Action>(["appraisal:create", "appraisal:view_all", "appraisal:decide"]),
};

export function can(role: Role, action: Action): boolean {
  return permissions[role].has(action);
}

/** Salespeople see only their own appraisals; managers see all. */
export function canViewAppraisal(
  user: { id: string; role: Role },
  appraisal: { createdBy: string },
): boolean {
  return can(user.role, "appraisal:view_all") || appraisal.createdBy === user.id;
}
