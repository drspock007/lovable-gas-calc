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
const isEmpty = (s: unknown) =>
  s === null || s === undefined || (typeof s === "string" && s.trim() === "");

export function computeDisabledReason(values: any): DisabledReason {
  try {
    const { pressureInputMode, patmMode, patmValue, altitude_m, process, P1, P2, Ps } = values;

    // 1) Ne JAMAIS bloquer sur "0" : on ne teste pas la "véracité", on teste le vide
    if (isEmpty(P1?.value) || isEmpty(P2?.value)) return "parse-error";
    if (process === "filling" && isEmpty(Ps?.value)) return "parse-error";

    // 2) Base atmosphère
    const unit = P1?.unit ?? "kPa";
    const Patm_SI =
      patmMode === "standard" ? 101_325 :
      patmMode === "custom"
        ? toSI_Pressure(parseFlexible(patmValue?.value ?? "101.325"), (patmValue?.unit ?? "kPa") as any)
        : patmFromAltitude(parseFlexible(altitude_m ?? "0"));

    // 3) Conversion vers ABSOLU
    const toAbs = (valStr: string, u: string) => {
      const x = toSI_Pressure(parseFlexible(valStr), u as any);
      if (!Number.isFinite(x)) return NaN;
      return pressureInputMode === "gauge" ? absFromGauge(x, Patm_SI) : x;
    };

    const P1_abs = toAbs(P1.value, P1.unit ?? unit);
    const P2_abs = toAbs(P2.value, P2.unit ?? unit);

    if (!(P1_abs > 1 && P2_abs > 1)) return "invalid-abs";

    if (process === "blowdown") {
      // 4) Blowdown : Ps N'INTERVIENT PAS dans l'activation
      if (!(P1_abs > P2_abs)) return "ineq-blowdown";
      return "ok";
    }

    // 5) Filling
    const Ps_abs = toAbs(Ps.value, Ps.unit ?? unit);
    if (!(Ps_abs > 1)) return "invalid-abs";
    if (!(Ps_abs > P1_abs && P2_abs > P1_abs)) return "ineq-filling";
    return "ok";
  } catch {
    return "parse-error";
  }
}