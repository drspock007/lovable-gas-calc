export type LengthUnit = "m" | "mm" | "cm";
const LEN2SI: Record<LengthUnit, number> = { m: 1, mm: 1e-3, cm: 1e-2 };
export const LENGTH_LABEL: Record<LengthUnit,string> = { m:'m', cm:'cm', mm:'mm' };

// ⚠️ tolérant aux variantes (espaces, majuscules, symbole "µm", etc.)
export function normalizeLengthUnit(u: unknown): LengthUnit {
  const raw = String(u ?? "").toLowerCase().replace(/\s/g, "");
  if (raw === "m") return "m";
  if (raw === "mm") return "mm";
  if (raw === "cm") return "cm";
  if (raw === "μm" || raw === "um" || raw === "µm") return "mm"; // on laissera parse * 1e-3 ensuite
  return "mm"; // défaut safe pour l'UI
}

export function toSI_Length(v: number, u: unknown): number {
  const unit = normalizeLengthUnit(u);
  const si = v * LEN2SI[unit];
  return si;
}

export function fromSI_Length(vSI:number,u:LengthUnit){return vSI/LEN2SI[u];}

// A single **formatter** to avoid UI drift
export function formatLength(vSI:number,u:LengthUnit, sig=3){
const v = fromSI_Length(vSI,u);
return Number.isFinite(v) ? Number(v.toPrecision(sig)) : NaN;
}