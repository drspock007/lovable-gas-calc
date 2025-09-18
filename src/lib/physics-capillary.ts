/**
 * Capillary Flow Physics - Dedicated Module
 * Points d'attention:
 * - L_SI en mètres, μ en Pa·s
 * - Dépendance t(D) ~ 1/D^4 (laminaire). N'utilise JAMAIS un diamètre en mm avant la puissance 4
 * - Re calculé avec vitesse moyenne issue du débit; si Re>2000 ou L/D<10 → renvoie un avertissement
 */

import type { ComputeInputs } from './physics';

/**
 * Calculate Reynolds number for capillary flow
 * @param rho Density [kg/m³]
 * @param v_avg Average velocity [m/s]
 * @param D_SI Diameter in SI units [m]
 * @param mu Dynamic viscosity [Pa·s]
 * @returns Reynolds number [-]
 */
function reynoldsNumberCapillary(rho: number, v_avg: number, D_SI: number, mu: number): number {
  return (rho * v_avg * D_SI) / mu;
}

/**
 * Calculate average velocity from mass flow rate
 * @param mdot Mass flow rate [kg/s]
 * @param rho Density [kg/m³]
 * @param A_SI Cross-sectional area [m²]
 * @returns Average velocity [m/s]
 */
function averageVelocity(mdot: number, rho: number, A_SI: number): number {
  return mdot / (rho * A_SI);
}

/**
 * Capillary time calculation with proper SI units and validation
 * @param SI Object with SI units and gas properties
 * @param A_SI Cross-sectional area [m²]
 * @returns Object with time and warnings
 */
export function timeCapillaryFromAreaSI_validated(SI: any, A_SI: number): { t_SI_s: number; warnings: string[] } {
  const { V_SI_m3: V, P1_Pa: P1, P2_Pa: P2, T_K: T, gas, epsilon = 0.01 } = SI;
  const L = SI.L_SI_m ?? SI.L_m;
  
  // Validation de la longueur L
  if (!Number.isFinite(L) || L <= 0) {
    throw new Error("Invalid capillary length L");
  }
  const { mu, R } = gas; // μ en Pa·s, L_SI en mètres
  
  const warnings: string[] = [];
  
  // CRITICAL: Diameter MUST be in SI (meters) before 4th power
  const D_SI = Math.sqrt(4 * A_SI / Math.PI); // [m]
  const D4_SI = D_SI * D_SI * D_SI * D_SI; // [m⁴] - JAMAIS en mm avant cette puissance!
  
  // Validation: L/D ratio
  const LD_ratio = L / D_SI;
  if (LD_ratio < 10) {
    warnings.push(`L/D = ${LD_ratio.toFixed(1)} < 10: Flow may not be fully developed laminar`);
  }
  
  // Capillary flow calculation (Poiseuille with pressure integration)
  const Pf = P2 * (1 + epsilon);
  
  // Logarithmic term for blowdown
  const numerator = (P1 - P2) * (Pf + P2);
  const denominator = (P1 + P2) * (Pf - P2);
  
  if (numerator <= 0 || denominator <= 0) {
    throw new Error('Invalid pressure conditions for capillary flow');
  }
  
  const lnTerm = Math.log(numerator / denominator);
  
  // t = (128 μ L V ln_term) / (π D⁴ P2)
  // μ [Pa·s], L [m], V [m³], D⁴ [m⁴], P2 [Pa] → t [s]
  const t_SI_s = (128 * mu * L * V * lnTerm) / (Math.PI * D4_SI * P2);
  
  // Reynolds number check
  // Estimate average mass flow rate during process
  const rho_avg = (P1 + P2) / (2 * R * T); // Average density [kg/m³]
  const mdot_avg = (Math.PI * D4_SI * P2) / (128 * mu * L) * (P1 - P2) / lnTerm; // Approximate [kg/s]
  const v_avg = averageVelocity(mdot_avg, rho_avg, A_SI);
  const Re = reynoldsNumberCapillary(rho_avg, v_avg, D_SI, mu);
  
  if (Re > 2000) {
    warnings.push(`Reynolds number Re = ${Re.toFixed(0)} > 2000: Flow may be turbulent, laminar model invalid`);
  }
  
  return { t_SI_s, warnings };
}

/**
 * Capillary diameter calculation with validation
 * @param inputs Computation inputs
 * @returns Object with diameter and warnings
 */
export function capillaryDfromT_validated(inputs: ComputeInputs): { D_SI_m: number; warnings: string[] } {
  const { V, P1, P2, T, L, gas, t, epsilon = 0.01 } = inputs;
  const { mu, R } = gas;
  
  const warnings: string[] = [];
  const Pf = P2 * (1 + epsilon);
  
  // Closed-form solution for capillary blowdown
  const numerator = (P1 - P2) * (Pf + P2);
  const denominator = (P1 + P2) * (Pf - P2);
  
  if (numerator <= 0 || denominator <= 0) {
    throw new Error('Invalid pressure conditions for capillary blowdown');
  }
  
  const lnTerm = Math.log(numerator / denominator);
  
  // D⁴ = (128 μ L V ln_term) / (π t P2)
  const D4_SI = (128 * mu * L * V * lnTerm) / (Math.PI * t! * P2);
  const D_SI_m = Math.pow(D4_SI, 0.25); // 4th root to get diameter in meters
  
  // Validation checks
  const LD_ratio = L / D_SI_m;
  if (LD_ratio < 10) {
    warnings.push(`L/D = ${LD_ratio.toFixed(1)} < 10: Flow may not be fully developed laminar`);
  }
  
  // Reynolds number check
  const A_SI = Math.PI * D_SI_m * D_SI_m / 4;
  const rho_avg = (P1 + P2) / (2 * R * T);
  const mdot_avg = (Math.PI * D4_SI * P2) / (128 * mu * L) * (P1 - P2) / lnTerm;
  const v_avg = averageVelocity(mdot_avg, rho_avg, A_SI);
  const Re = reynoldsNumberCapillary(rho_avg, v_avg, D_SI_m, mu);
  
  if (Re > 2000) {
    warnings.push(`Reynolds number Re = ${Re.toFixed(0)} > 2000: Flow may be turbulent, laminar model invalid`);
  }
  
  return { D_SI_m, warnings };
}