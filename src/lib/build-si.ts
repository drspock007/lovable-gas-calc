/**
 * Build SI units object from UI inputs
 * Unifies pressure conversion handling with gauge/absolute modes and atmospheric pressure
 */

import { toSI_Pressure, absFromGauge, patmFromAltitude } from "@/lib/pressure-units";

/**
 * Build absolute SI units object from UI values
 * Handles gauge/absolute pressure modes and atmospheric pressure settings
 * @param v UI values object
 * @returns SI units object with absolute pressures
 */
export function buildAbsoluteSIFromUI(v: any) {
  const u = v.userPressureUnit ?? "kPa";
  
  // Determine atmospheric pressure based on mode
  const Patm =
    v.patmMode === "standard"
      ? 101_325
      : v.patmMode === "custom"
      ? toSI_Pressure(Number(String(v.patmValue?.value ?? "101.325").replace(",", ".")), v.patmValue?.unit ?? "kPa")
      : patmFromAltitude(Number(v.altitude_m ?? 0));

  // Helper function to convert pressure to absolute SI
  const toAbs = (x: string, unit: string) => {
    const z = Number(String(x).replace(",", "."));
    const si = toSI_Pressure(z, unit as any);
    return v.pressureInputMode === "gauge" ? absFromGauge(si, Patm) : si;
  };

  return {
    V_SI_m3: v.V_SI_m3, // suppose déjà converti côté volume
    P1_Pa: toAbs(v.P1.value, v.P1.unit),
    P2_Pa: toAbs(v.P2.value, v.P2.unit),
    Ps_Pa: v.process === "filling" && v.Ps ? toAbs(v.Ps.value, v.Ps.unit) : undefined,
    T_K: v.T_SI_K,
    L_SI_m: v.L_SI_m,
    gas: v.gas, 
    Cd: v.Cd, 
    epsilon: v.epsilon, 
    regime: v.regime
  };
}