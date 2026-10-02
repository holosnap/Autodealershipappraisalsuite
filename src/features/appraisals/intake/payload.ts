import { isValidVin, normalizeVin } from "@/lib/vin";
import type { CustomerForm, VehicleForm } from "./types";

const num = (s: string) => (s.trim() === "" ? null : Number(s));

export function vehiclePayload(f: VehicleForm) {
  return {
    vin: normalizeVin(f.vin),
    odometer: num(f.odometer),
    year: num(f.year),
    make: f.make,
    model: f.model,
    trim: f.trim,
  };
}

export const vehicleSavable = (f: VehicleForm) => isValidVin(normalizeVin(f.vin));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A half-typed email must not make the server reject the whole step, so leave it out until valid. */
export function customerPayload(f: CustomerForm) {
  const { customerEmail, ...rest } = f;
  return customerEmail.trim() === "" || EMAIL_RE.test(customerEmail.trim()) ? { ...rest, customerEmail } : rest;
}
