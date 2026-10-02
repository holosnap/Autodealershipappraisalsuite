import { describe, expect, it } from "vitest";
import { can, canEditDraft, canViewAppraisal } from "../src/lib/rbac";

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
    expect(canViewAppraisal(sp, { createdBy: "u1", status: "submitted" })).toBe(true);
    expect(canViewAppraisal(sp, { createdBy: "u2", status: "submitted" })).toBe(false);
  });
  it("manager sees everyone's submitted work but not other people's drafts", () => {
    const m = { id: "m", role: "manager" as const };
    expect(canViewAppraisal(m, { createdBy: "u2", status: "submitted" })).toBe(true);
    expect(canViewAppraisal(m, { createdBy: "u2", status: "draft" })).toBe(false);
    expect(canViewAppraisal(m, { createdBy: "m", status: "draft" })).toBe(true);
  });
  it("only the author edits, and only while draft", () => {
    expect(canEditDraft({ id: "u1" }, { createdBy: "u1", status: "draft" })).toBe(true);
    expect(canEditDraft({ id: "u1" }, { createdBy: "u1", status: "submitted" })).toBe(false);
    expect(canEditDraft({ id: "m" }, { createdBy: "u1", status: "draft" })).toBe(false);
  });
});
