export type PhotoSlot =
  | "front" | "rear" | "driver_side" | "passenger_side" | "interior_front"
  | "odometer" | "vin_plate" | "damage";

export const photoSlots: { slot: PhotoSlot; label: string; hint: string; required: boolean; multiple?: boolean }[] = [
  { slot: "front", label: "Front", hint: "Stand 10 ft back, corner to corner, whole car in frame", required: true },
  { slot: "rear", label: "Rear", hint: "Whole rear of the car, plate visible", required: true },
  { slot: "driver_side", label: "Driver side", hint: "Full side profile, wheels included", required: true },
  { slot: "passenger_side", label: "Passenger side", hint: "Full side profile, wheels included", required: true },
  { slot: "interior_front", label: "Interior", hint: "Dashboard and front seats from the rear door", required: true },
  { slot: "odometer", label: "Odometer", hint: "Instrument cluster with ignition on, mileage readable", required: true },
  { slot: "vin_plate", label: "VIN plate", hint: "Door-jamb sticker or dash plate, VIN readable", required: false },
  { slot: "damage", label: "Damage close-ups", hint: "Each dent, scratch, crack or stain: one photo each", required: false, multiple: true },
];

export const requiredSlots = photoSlots.filter((s) => s.required).map((s) => s.slot);
export const MAX_DAMAGE_PHOTOS = 12;
export const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
export const slotLabel = (slot: string) => photoSlots.find((s) => s.slot === slot)?.label ?? slot;
