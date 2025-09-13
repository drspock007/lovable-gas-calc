import { toSI_Pressure, absFromGauge, patmFromAltitude } from "@/lib/pressure-units";

export type DisabledReason =
  | "submitting"
  | "invalid-abs"   // absolus non positifs / NaN
  | "ineq-blowdown" // P1_abs <= P2_abs
  | "ineq-filling"  // Ps_abs <= P1_abs ou P2_abs <= P1_abs
  | "parse-error"   // NaN dans le pipeline
  | "ok";

function parseFlexible(s: unknown): number {
  if (typeof s !== "string") return NaN;
  const t = s.replace(/\s/g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

export function computeDisabledReason(values: any): DisabledReason {
  try {
    const { pressureInputMode, patmMode, patmValue, altitude_m, process, P1, P2, Ps } = values;

    const unit = P1?.unit ?? "kPa";
    const Patm_SI =
      patmMode === "standard" ? 101_325 :
      patmMode === "custom"
        ? toSI_Pressure(parseFlexible(patmValue?.value ?? "101.325"), (patmValue?.unit ?? "kPa") as any)
        : patmFromAltitude(parseFlexible(altitude_m ?? "0"));

    const toAbs = (valStr: string, u: string) => {
      const x = toSI_Pressure(parseFlexible(valStr), u as any);
      if (!Number.isFinite(x)) return NaN;
      return pressureInputMode === "gauge" ? absFromGauge(x, Patm_SI) : x;
    };

    const P1_abs = toAbs(P1?.value ?? "", P1?.unit ?? unit);
    const P2_abs = toAbs(P2?.value ?? "", P2?.unit ?? unit);

    // Pressions absolues strictement > 0 (tolérance 1 Pa)
    if (!(P1_abs > 1 && P2_abs > 1)) return "invalid-abs";

    if (process === "blowdown") {
      // Ne pas regarder Ps en blowdown
      if (!(P1_abs > P2_abs)) return "ineq-blowdown";
      return "ok";
    }

    // Filling : Ps requis et strictement > P1_abs, P2_abs > P1_abs
    const Ps_abs = toAbs(Ps?.value ?? "", Ps?.unit ?? unit);
    if (!(Ps_abs > 1)) return "invalid-abs";
    if (!(Ps_abs > P1_abs && P2_abs > P1_abs)) return "ineq-filling";
    return "ok";
  } catch {
    return "parse-error";
  }
}