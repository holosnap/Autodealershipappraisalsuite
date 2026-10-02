import { describe, expect, it } from "vitest";
import { can, canEditAppraisal } from "../src/lib/rbac";

describe("rbac", () => {
  it("limits salespeople", () => {
    expect(can("salesperson", "appraisal:create")).toBe(true);
    expect(can("salesperson", "offer:set")).toBe(false);
    expect(can("salesperson", "appraisal:view_all")).toBe(false);
  });
  it("lets managers review but not manage users", () => {
    expect(can("manager", "offer:set")).toBe(true);
    expect(can("manager", "user:manage")).toBe(false);
    expect(can("admin", "user:manage")).toBe(true);
  });
  it("salesperson edits only own draft/returned appraisals", () => {
    const sp = { id: "u1", role: "salesperson" as const };
    expect(canEditAppraisal(sp, { createdBy: "u1", status: "draft" })).toBe(true);
    expect(canEditAppraisal(sp, { createdBy: "u1", status: "returned" })).toBe(true);
    expect(canEditAppraisal(sp, { createdBy: "u1", status: "submitted" })).toBe(false);
    expect(canEditAppraisal(sp, { createdBy: "u2", status: "draft" })).toBe(false);
    expect(canEditAppraisal({ id: "m", role: "manager" }, { createdBy: "u2", status: "submitted" })).toBe(true);
  });
});
