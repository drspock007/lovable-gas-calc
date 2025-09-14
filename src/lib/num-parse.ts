export function parseDecimalLoose(s: unknown): number {
  if (typeof s !== "string" && typeof s !== "number") return NaN;
  const t = String(s).trim().replace(/\s/g, "").replace(",", ".");
  if (t === "" || t === "." || t === "-") return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}