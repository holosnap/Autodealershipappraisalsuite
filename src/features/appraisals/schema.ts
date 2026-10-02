import { z } from "zod";
import { VIN_RE } from "@/lib/vin";

/** Empty string -> null (clears the column); omitted -> undefined (leaves it alone). */
const text = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const int = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null ? null : typeof v === "string" ? Number(v) : v),
    z.number().int().min(min).max(max).nullable().optional(),
  );

export const vinField = z
  .string()
  .trim()
  .toUpperCase()
  .regex(VIN_RE, "VIN must be 17 characters (letters and digits, no I, O or Q)");

// Step 1
export const vehicleStepSchema = z.object({
  vin: vinField,
  odometer: int(0, 2_000_000),
  year: int(1981, new Date().getFullYear() + 1),
  make: text(60),
  model: text(80),
  trim: text(80),
});
export type VehicleStep = z.infer<typeof vehicleStepSchema>;

// Step 2
export const customerStepSchema = z.object({
  customerName: text(120),
  customerPhone: text(40),
  customerEmail: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().email("Enter a valid email").nullable())
    .optional(),
  purchaseInterest: text(200),
  stockNumber: text(40),
  hasLien: z.boolean().optional(),
});
export type CustomerStep = z.infer<typeof customerStepSchema>;

// Step 3 lives in ./condition.ts (conditionSchema) + keys, which maps to appraisals.keys_count.

export const draftStepSchemas = { vehicle: vehicleStepSchema, customer: customerStepSchema } as const;

export const decideAppraisalSchema = z
  .object({
    decision: z.enum(["approved", "rejected"]),
    offerDollars: z.coerce.number().positive().max(10_000_000).optional(),
    reason: z
      .string()
      .trim()
      .transform((v) => (v === "" ? undefined : v))
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (v.decision === "approved" && v.offerDollars === undefined)
      ctx.addIssue({ code: "custom", path: ["offerDollars"], message: "Enter the final offer to approve" });
    if (v.decision === "rejected" && !v.reason)
      ctx.addIssue({ code: "custom", path: ["reason"], message: "Give a reason for rejecting" });
  });
export type DecideAppraisalInput = z.infer<typeof decideAppraisalSchema>;
