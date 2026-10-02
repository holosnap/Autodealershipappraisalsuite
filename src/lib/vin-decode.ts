import { isValidVin } from "./vin";

export type DecodedVin = { year?: number; make?: string; model?: string; trim?: string };

const title = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : s);

/** NHTSA vPIC (free, no key). Best effort: returns null on any failure so the user can type details in. */
export async function decodeVin(vin: string): Promise<DecodedVin | null> {
  if (!isValidVin(vin)) return null;
  try {
    const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`, {
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) return null;
    const r = ((await res.json()) as { Results?: Record<string, string>[] }).Results?.[0];
    if (!r || (r.ErrorCode && !/^0?$/.test(r.ErrorCode.split(",")[0] ?? "") && !r.Make)) return null;
    const year = Number(r.ModelYear);
    const trim = [r.Trim, r.Series].find((t) => t && t.trim());
    const out: DecodedVin = {
      year: Number.isInteger(year) && year > 1980 ? year : undefined,
      make: r.Make ? title(r.Make) : undefined,
      model: r.Model || undefined,
      trim: trim || undefined,
    };
    return out.make || out.model ? out : null;
  } catch {
    return null;
  }
}
