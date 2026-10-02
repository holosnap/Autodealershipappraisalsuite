import type { Role } from "@/db/schema";

export type Action = "appraisal:create" | "appraisal:view_all" | "appraisal:decide";

const permissions: Record<Role, ReadonlySet<Action>> = {
  salesperson: new Set<Action>(["appraisal:create"]),
  manager: new Set<Action>(["appraisal:create", "appraisal:view_all", "appraisal:decide"]),
};

export function can(role: Role, action: Action): boolean {
  return permissions[role].has(action);
}

/**
 * Salespeople see only their own appraisals; managers see everyone's submitted work.
 * Drafts are private to their author (a half-finished intake is noise for the queue).
 */
export function canViewAppraisal(
  user: { id: string; role: Role },
  appraisal: { createdBy: string; status: string },
): boolean {
  if (appraisal.createdBy === user.id) return true;
  return can(user.role, "appraisal:view_all") && appraisal.status !== "draft";
}

/** Only the author can edit, and only while it is still a draft. */
export function canEditDraft(user: { id: string }, appraisal: { createdBy: string; status: string }): boolean {
  return appraisal.createdBy === user.id && appraisal.status === "draft";
}
