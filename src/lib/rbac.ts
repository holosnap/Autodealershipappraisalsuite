import type { Role } from "@/db/schema";

export type Action =
  | "appraisal:create"
  | "appraisal:view_all"
  | "appraisal:edit_own_draft"
  | "appraisal:review"
  | "valuation:create"
  | "offer:set"
  | "user:manage";

const permissions: Record<Role, ReadonlySet<Action>> = {
  salesperson: new Set<Action>(["appraisal:create", "appraisal:edit_own_draft"]),
  manager: new Set<Action>([
    "appraisal:create",
    "appraisal:edit_own_draft",
    "appraisal:view_all",
    "appraisal:review",
    "valuation:create",
    "offer:set",
  ]),
  admin: new Set<Action>([
    "appraisal:create",
    "appraisal:edit_own_draft",
    "appraisal:view_all",
    "appraisal:review",
    "valuation:create",
    "offer:set",
    "user:manage",
  ]),
};

export function can(role: Role, action: Action): boolean {
  return permissions[role].has(action);
}

/** Salespeople may only touch their own appraisals while still editable. */
export function canEditAppraisal(
  user: { id: string; role: Role },
  appraisal: { createdBy: string; status: string },
): boolean {
  if (can(user.role, "appraisal:review")) return true;
  return (
    appraisal.createdBy === user.id &&
    (appraisal.status === "draft" || appraisal.status === "returned")
  );
}
