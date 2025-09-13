import { toSI_Pressure, absFromGauge, patmFromAltitude } from "@/lib/pressure-units";

export type DisabledReason =
  | "submitting"
  | "invalid-abs"         // non-positive absolute pressures
  | "ineq-blowdown"       // P1_abs <= P2_abs
  | "ineq-filling"        // Ps_abs <= P1_abs or P2_abs <= P1_abs
  | "parse-error"         // NaN somewhere
  | "ok";

export function computeDisabledReason(values: any): DisabledReason {
  try {
    const parse = (s: string) => {
      if (typeof s !== "string") return NaN;
      const n = Number(s.replace(/\s/g,"").replace(",","."));
      return Number.isFinite(n) ? n : NaN;
    };
    
    const { pressureInputMode, patmMode, patmValue, altitude_m, process, P1, P2, Ps } = values;

    const u = P1?.unit ?? "kPa";
    const Patm_SI =
      patmMode === "standard" ? 101325 :
      patmMode === "custom"   ? toSI_Pressure(parse(patmValue?.value ?? "101.325"), patmValue?.unit ?? "kPa") :
                                patmFromAltitude(Number(altitude_m ?? 0));

    const toAbs = (valStr: string, unit: string) => {
      const x = toSI_Pressure(parse(valStr), unit as any);
      if (!Number.isFinite(x)) return NaN;
      return pressureInputMode === "gauge" ? absFromGauge(x, Patm_SI) : x;
    };

    const P1_abs = toAbs(P1?.value ?? "", P1?.unit ?? u);
    const P2_abs = toAbs(P2?.value ?? "", P2?.unit ?? u);

    if (!(P1_abs > 1 && P2_abs > 1)) return "invalid-abs";

    if (process === "blowdown") {
      if (!(P1_abs > P2_abs)) return "ineq-blowdown";
      return "ok";
    } else {
      // filling
      const Ps_abs = toAbs(Ps?.value ?? "", Ps?.unit ?? u);
      if (!(Ps_abs > 1)) return "invalid-abs";
      if (!(Ps_abs > P1_abs && P2_abs > P1_abs)) return "ineq-filling";
      return "ok";
    }
  } catch {
    return "parse-error";
  }
}