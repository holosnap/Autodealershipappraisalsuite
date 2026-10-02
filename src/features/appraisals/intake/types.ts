import type { ConditionChecklist } from "../condition";

export type VehicleForm = { vin: string; odometer: string; year: string; make: string; model: string; trim: string };
export type CustomerForm = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  purchaseInterest: string;
  stockNumber: string;
  hasLien: boolean;
};
export type WizardData = { vehicle: VehicleForm; customer: CustomerForm; condition: ConditionChecklist };
export type PhotoRef = { id: string; slot: string };

export const STEPS = [
  { key: "vehicle", title: "Vehicle" },
  { key: "customer", title: "Customer" },
  { key: "condition", title: "Condition" },
  { key: "photos", title: "Photos" },
] as const;
