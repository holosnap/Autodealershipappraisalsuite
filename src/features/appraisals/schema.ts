import { z } from "zod";

const vin = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NPR-Z0-9]{17}$/, "VIN must be 17 characters (no I, O or Q)");

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

export const createAppraisalSchema = z.object({
  vin,
  year: z.coerce.number().int().min(1981).max(new Date().getFullYear() + 1),
  make: z.string().trim().min(1, "Make is required"),
  model: z.string().trim().min(1, "Model is required"),
  trim: optionalText,
  odometer: z.coerce.number().int().min(0).max(2_000_000),
  customerName: optionalText,
  stockNumber: optionalText,
  conditionNotes: optionalText,
});
export type CreateAppraisalInput = z.infer<typeof createAppraisalSchema>;

export const decideAppraisalSchema = z
  .object({
    decision: z.enum(["approved", "rejected"]),
    offerDollars: z.coerce.number().positive().max(10_000_000).optional(),
    reason: optionalText,
  })
  .superRefine((v, ctx) => {
    if (v.decision === "approved" && v.offerDollars === undefined)
      ctx.addIssue({ code: "custom", path: ["offerDollars"], message: "Enter the final offer to approve" });
    if (v.decision === "rejected" && !v.reason)
      ctx.addIssue({ code: "custom", path: ["reason"], message: "Give a reason for rejecting" });
  });
export type DecideAppraisalInput = z.infer<typeof decideAppraisalSchema>;
