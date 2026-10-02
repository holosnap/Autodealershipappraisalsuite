import { describe, expect, it } from "vitest";
import { can, canViewAppraisal } from "../src/lib/rbac";

describe("rbac", () => {
  it("salesperson can create but not decide or view all", () => {
    expect(can("salesperson", "appraisal:create")).toBe(true);
    expect(can("salesperson", "appraisal:decide")).toBe(false);
    expect(can("salesperson", "appraisal:view_all")).toBe(false);
  });
  it("manager can view all and decide", () => {
    expect(can("manager", "appraisal:view_all")).toBe(true);
    expect(can("manager", "appraisal:decide")).toBe(true);
  });
  it("salesperson views only their own appraisals", () => {
    const sp = { id: "u1", role: "salesperson" as const };
    expect(canViewAppraisal(sp, { createdBy: "u1" })).toBe(true);
    expect(canViewAppraisal(sp, { createdBy: "u2" })).toBe(false);
    expect(canViewAppraisal({ id: "m", role: "manager" }, { createdBy: "u2" })).toBe(true);
  });
});
