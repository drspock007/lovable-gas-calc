import { toSI_Pressure, absFromGauge, patmFromAltitude } from "@/lib/pressure-units";

export type DisabledReason =
  | "submitting" | "invalid-abs" | "ineq-blowdown" | "ineq-filling" | "parse-error" | "ok";

const parse = (s: unknown) => {
  if (typeof s !== "string") return NaN;
  const n = Number(s.replace(/\s/g,"").replace(",","."));
  return Number.isFinite(n) ? n : NaN;
};
const empty = (s: unknown) =>
  s == null || (typeof s === "string" && s.trim() === ""); // "0" n'est PAS vide

export function computeDisabledReason(values: any): DisabledReason {
  try {
    const { pressureInputMode, patmMode, patmValue, altitude_m, process, P1, P2, Ps } = values;
    
    // Debug logging for gauge zero case
    console.info("DEBUG compute-enabled called:", { 
      pressureInputMode, P1: P1?.value, P2: P2?.value, process,
      P1_empty: empty(P1?.value), P2_empty: empty(P2?.value)
    });

    if (empty(P1?.value) || empty(P2?.value)) return "parse-error";
    if (process === "filling" && empty(Ps?.value)) return "parse-error";

    const unit = P1?.unit ?? "kPa";
    const Patm_SI =
      patmMode === "standard" ? 101_325 :
      patmMode === "custom"   ? toSI_Pressure(parse(patmValue?.value ?? "101.325"), (patmValue?.unit ?? "kPa") as any) :
                                patmFromAltitude(parse(altitude_m ?? "0"));

    const toAbs = (valStr: string, u: string) => {
      const x = toSI_Pressure(parse(valStr), u as any);
      if (!Number.isFinite(x)) return NaN;
      return pressureInputMode === "gauge" ? absFromGauge(x, Patm_SI) : x;
    };

    const P1_abs = toAbs(P1.value, P1.unit ?? unit);
    const P2_abs = toAbs(P2.value, P2.unit ?? unit);
    
    // Debug logging for gauge zero case
    if (pressureInputMode === "gauge" && P2?.value === "0") {
      console.info("DEBUG abs pressures:", { P1_abs, P2_abs, Patm_SI, P1_value: P1.value, P2_value: P2.value });
    }
    
    if (!(P1_abs > 1 && P2_abs > 1)) return "invalid-abs";

    if (process === "blowdown") {
      // Ps ne compte pas ici
      return P1_abs > P2_abs ? "ok" : "ineq-blowdown";
    }

    const Ps_abs = toAbs(Ps.value, Ps.unit ?? unit);
    if (!(Ps_abs > 1)) return "invalid-abs";
    return (Ps_abs > P1_abs && P2_abs > P1_abs) ? "ok" : "ineq-filling";
  } catch {
    return "parse-error";
  }
}