/** Pure VIN helpers, safe to import from client and server. */
export const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

export const normalizeVin = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

export const isValidVin = (s: string) => VIN_RE.test(s);

const findWindow = (s: string): string | null => {
  for (let i = 0; i + 17 <= s.length; i++) {
    const w = s.slice(i, i + 17);
    if (VIN_RE.test(w)) return w;
  }
  return null;
};

/**
 * Pull a VIN out of raw barcode text. Door-jamb Code 39 / Data Matrix codes often carry a prefix
 * (e.g. a leading "I") or trailing junk, and QR codes can be URLs, so look for a valid 17-character
 * window inside each alphanumeric token first, and only then across the whole string (a VIN split by spaces).
 */
export function extractVin(raw: string): string | null {
  const upper = raw.toUpperCase();
  for (const token of upper.split(/[^A-Z0-9]+/)) {
    const hit = findWindow(token);
    if (hit) return hit;
  }
  return findWindow(upper.replace(/[^A-Z0-9]/g, ""));
}
