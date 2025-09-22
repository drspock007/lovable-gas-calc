/**
 * Build SI units object from UI inputs
 * Unifies pressure conversion handling with gauge/absolute modes and atmospheric pressure
 */

import { toSI_Pressure, absFromGauge, patmFromAltitude } from "@/lib/pressure-units";
import { toSI_Volume } from "@/lib/units";
import { toSI_Temperature } from "@/lib/units";
import { toSI_Length } from "@/lib/length-units";

function resolvePatm(values: any): number {
  return values.patmMode === "standard" ? 101325
    : values.patmMode === "custom" ? toSI_Pressure(Number(String(values.patmValue?.value ?? "101.325").replace(",", ".")), values.patmValue?.unit ?? "kPa")
    : patmFromAltitude(Number(values.altitude_m ?? 0));
}

function toAbsSI(value: any, unit: string, mode: string, Patm: number): number {
  const numValue = Number(String(value ?? "0").replace(",", "."));
  const si = toSI_Pressure(numValue, unit as any);
  return mode === "gauge" ? absFromGauge(si, Patm) : si;
}

export function buildSI(values: any) {
  // Volume with multi-path fallbacks
  const Vraw = values?.V?.value ?? values?.vesselVolume?.value ?? values?.volume?.value ?? values?.V;
  const Vunit = values?.V?.unit ?? values?.vesselVolume?.unit ?? values?.volume?.unit ?? "m3";
  const V_SI_m3 = toSI_Volume(Number(String(Vraw ?? "0").replace(",", ".")), Vunit);

  // Temperature with multi-path fallbacks
  const Traw = values?.T?.value ?? values?.temperature?.value ?? values?.T ?? values?.temp;
  const Tunit = values?.T?.unit ?? values?.temperature?.unit ?? "C";
  const T_K = toSI_Temperature(Number(String(Traw ?? "15").replace(",", ".")), Tunit);

  // Pressures with multi-path fallbacks
  const P1v = values?.P1?.value ?? values?.initialPressure?.value ?? values?.p1?.value ?? values?.P1;
  const P1u = values?.P1?.unit ?? values?.initialPressure?.unit ?? values?.p1?.unit ?? values?.P1_unit ?? "kPa";
  const P2v = values?.P2?.value ?? values?.finalPressure?.value ?? values?.p2?.value ?? values?.P2;
  const P2u = values?.P2?.unit ?? values?.finalPressure?.unit ?? values?.p2?.unit ?? values?.P2_unit ?? "kPa";
  const mode = values?.pressureInputMode ?? "gauge";
  const Patm = resolvePatm(values);
  const P1_Pa = toAbsSI(P1v, P1u, mode, Patm);
  const P2_Pa = toAbsSI(P2v, P2u, mode, Patm);

  // Length with multi-path fallbacks
  const Lraw = values?.L?.value ?? values?.length?.value ?? values?.L_SI_m ?? values?.L_m ?? values?.orificeLength?.value;
  const Lunit = values?.L?.unit ?? values?.length?.unit ?? "mm";
  const L_SI_m = toSI_Length(Number(String(Lraw ?? "2").replace(",", ".")), Lunit);

  // Coefficients and gas
  const gas = values?.gas;
  const Cd = Number(values?.Cd ?? 0.62);
  const epsilon = Number(values?.epsilon ?? 0.01);
  const regime = values?.regime ?? "isothermal";

  const result = {
    V_SI_m3,
    P1_Pa,
    P2_Pa,
    T_K,
    L_SI_m,
    L_m: L_SI_m, // Backward compatibility
    gas,
    Cd,
    epsilon,
    regime
  };

  // Validation check
  const required = ["V_SI_m3", "P1_Pa", "P2_Pa", "T_K"];
  for (const k of required) {
    if (!Number.isFinite((result as any)[k])) {
      throw new Error(`buildSI: missing or invalid ${k}`);
    }
  }

  return result;
}

/**
 * Build absolute SI units object from UI values
 * Handles gauge/absolute pressure modes and atmospheric pressure settings
 * @param v UI values object
 * @returns SI units object with absolute pressures
 */
export function buildAbsoluteSIFromUI(values: any) {
  // Volume with multi-path fallbacks
  const Vraw = values?.V?.value ?? values?.vesselVolume?.value ?? values?.volume?.value ?? values?.V ?? values?.V_SI_m3;
  const Vunit = values?.V?.unit ?? values?.vesselVolume?.unit ?? values?.volume?.unit ?? "m3";
  const V_SI_m3 = Vraw !== undefined ? toSI_Volume(Number(String(Vraw).replace(",", ".")), Vunit) : values?.V_SI_m3;

  // Temperature with multi-path fallbacks
  const Traw = values?.T?.value ?? values?.temperature?.value ?? values?.T ?? values?.temp ?? values?.T_SI_K;
  const Tunit = values?.T?.unit ?? values?.temperature?.unit ?? "C";
  const T_K = Traw !== undefined && values?.T_SI_K === undefined ? toSI_Temperature(Number(String(Traw).replace(",", ".")), Tunit) : values?.T_SI_K;

  // Pressures with enhanced multi-path fallbacks for Filling mode
  const P1v = values?.P1?.value ?? values?.initialPressure?.value ?? values?.p1?.value ?? values?.P1;
  const P1u = values?.P1?.unit ?? values?.initialPressure?.unit ?? values?.p1?.unit ?? values?.P1_unit ?? "kPa";
  
  const Pfv = values?.P2?.value ?? values?.finalPressure?.value ?? values?.targetPressure?.value ?? values?.p2?.value ?? values?.P2;
  const Pfu = values?.P2?.unit ?? values?.finalPressure?.unit ?? values?.targetPressure?.unit ?? values?.p2?.unit ?? values?.P2_unit ?? "kPa";
  
  const Psv = values?.Ps?.value ?? values?.supplyPressure?.value;
  const Psu = values?.Ps?.unit ?? values?.supplyPressure?.unit ?? "kPa";
  
  const mode = values?.pressureInputMode ?? "gauge";
  const Patm = resolvePatm(values);
  
  // Convert to SI + absolute pressures
  const P1_Pa = toAbsSI(P1v, P1u, mode, Patm);
  const Pf_Pa = toAbsSI(Pfv, Pfu, mode, Patm);
  const Ps_Pa = toAbsSI(Psv, Psu, mode, Patm);

  // Length with multi-path fallbacks
  const Lraw = values?.L?.value ?? values?.length?.value ?? values?.L_SI_m ?? values?.L_m ?? values?.orificeLength?.value;
  const Lunit = values?.L?.unit ?? values?.length?.unit ?? "mm";
  const L_SI_m = toSI_Length(Number(String(Lraw ?? "2").replace(",", ".")), Lunit);

  // Coefficients and gas
  const gas = values?.gas;
  const Cd = Number(values?.Cd ?? 0.62);
  const epsilon = Number(values?.epsilon ?? 0.01);
  const regime = values?.regime ?? "isothermal";

  const result = {
    V_SI_m3,
    P1_Pa,
    P2_Pa: Pf_Pa, // Alias for backward compatibility
    Pf_Pa, // Target/final pressure (explicit)
    Ps_Pa, // Supply pressure
    T_K,
    L_SI_m,
    L_m: L_SI_m, // Backward compatibility
    gas,
    Cd,
    epsilon,
    regime,
    pressureInputMode: mode,
    Patm_SI: Patm
  };

  // Enhanced validation for Filling mode
  if (values?.process === "filling") {
    // Guards: check that critical pressures are finite for Filling mode
    const criticalPressures = ["P1_Pa", "Pf_Pa", "Ps_Pa"];
    for (const k of criticalPressures) {
      if (!Number.isFinite((result as any)[k])) {
        throw new Error(`buildSI: missing ${k} (required for Filling mode)`);
      }
    }
  } else {
    // Standard validation for other modes
    const required = ["V_SI_m3", "P1_Pa", "P2_Pa", "T_K"];
    for (const k of required) {
      if (!Number.isFinite((result as any)[k])) {
        throw new Error(`buildAbsoluteSIFromUI: missing or invalid ${k}`);
      }
    }
  }

  return result;
}