export const money = (cents: number | null | undefined) =>
  cents == null ? "—" : (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const vehicleTitle = (v: { year: number | null; make: string | null; model: string | null; trim: string | null }) =>
  [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
