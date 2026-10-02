import { describe, expect, it } from "vitest";
import { extractVin, isValidVin, normalizeVin } from "../src/lib/vin";
import { missingCondition } from "../src/features/appraisals/condition";
import { missingForSubmit } from "../src/features/appraisals/readiness";
import { customerPayload, vehiclePayload } from "../src/features/appraisals/intake/payload";

describe("vin", () => {
  it("validates 17 chars without I/O/Q", () => {
    expect(isValidVin("1HGCV1F34LA000001")).toBe(true);
    expect(isValidVin("1HGCV1F34LA00000")).toBe(false);
    expect(isValidVin("1HGCV1F34LA00000O")).toBe(false);
  });
  it("normalizes typed input", () => {
    expect(normalizeVin(" 1hgcv1f34la-000001 ")).toBe("1HGCV1F34LA000001");
  });
  it("extracts a VIN from barcode text with prefix/suffix noise", () => {
    expect(extractVin("1HGCV1F34LA000001")).toBe("1HGCV1F34LA000001");
    expect(extractVin("I1HGCV1F34LA000001")).toBe("1HGCV1F34LA000001"); // leading "I" prefix some jambs carry
    expect(extractVin("https://x.test/?v=5TDKZ3DC5LS000002&z=1")).toBe("5TDKZ3DC5LS000002");
    expect(extractVin("not a vin")).toBeNull();
    expect(extractVin("")).toBeNull();
  });
});

describe("condition checklist", () => {
  it("lists every unanswered item for an empty checklist", () => {
    expect(missingCondition({})).toHaveLength(9);
    expect(missingCondition(null)).toHaveLength(9);
  });
  it("requires which lights when warning lights are present", () => {
    expect(missingCondition({ warningLights: { present: true, lights: [] } })).toContain("Which warning lights are on");
  });
  it("is complete when everything is answered", () => {
    expect(
      missingCondition({
        exterior: { rating: "good" }, interior: { rating: "good" }, mechanical: { rating: "fair" }, tires: { rating: "poor" },
        warningLights: { present: false }, smokeOdor: "none", accident: { history: "none" }, keys: 0, aftermarketMods: { present: false },
      }),
    ).toEqual([]);
  });
});

describe("readiness", () => {
  const base = {
    vehicle: { year: 2020, make: "Honda", model: "Accord" }, odometer: 1, customerName: "A", customerPhone: "1", customerEmail: null,
    condition: {
      exterior: { rating: "good" as const }, interior: { rating: "good" as const }, mechanical: { rating: "good" as const }, tires: { rating: "good" as const },
      warningLights: { present: false }, smokeOdor: "none" as const, accident: { history: "none" as const }, keys: 1, aftermarketMods: { present: false },
    },
    photoSlots: ["front", "rear", "driver_side", "passenger_side", "interior_front", "odometer"],
  };
  it("passes when complete (vin_plate and damage are optional)", () => expect(missingForSubmit(base)).toEqual([]));
  it("reports missing photos and contact", () => {
    const m = missingForSubmit({ ...base, customerPhone: null, photoSlots: ["front"] });
    expect(m).toContain("Customer phone or email");
    expect(m).toContain("Rear photo");
    expect(m).toContain("Odometer photo");
  });
});

describe("payload helpers", () => {
  it("converts form strings to typed vehicle values", () => {
    expect(vehiclePayload({ vin: "1hgcv1f34la000001", odometer: "48210", year: "", make: "Honda", model: "", trim: "" })).toMatchObject({
      vin: "1HGCV1F34LA000001", odometer: 48210, year: null,
    });
  });
  it("omits a half-typed email so the server doesn't reject the whole step", () => {
    const base = { customerName: "A", customerPhone: "", purchaseInterest: "", stockNumber: "", hasLien: false };
    expect("customerEmail" in customerPayload({ ...base, customerEmail: "bob@ex" })).toBe(false);
    expect("customerEmail" in customerPayload({ ...base, customerEmail: "bob@ex.com" })).toBe(true);
    expect("customerEmail" in customerPayload({ ...base, customerEmail: "" })).toBe(true);
  });
});
