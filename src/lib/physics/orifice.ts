/**
 * Orifice flow calculations and integrals
 */

import { adaptiveSimpson, clamp, pos, criticalRatio, Cstar, K } from './math-utils';
import { IntegralError, ResidualError } from './errors';
import type { ComputeInputs, SolverResultSI } from './types';

/**
 * Subcritical integral for blowdown using y = (P2/P)^(1/gamma) substitution
 * @param P2 Exit pressure [Pa]
 * @param Pstar Critical pressure [Pa]
 * @param Pf Final pressure [Pa]
 * @param gamma Heat capacity ratio
 * @returns Integral value [-]
 */
export function subcriticalIntegralBlowdown(P2: number, Pstar: number, Pf: number, gamma: number): number {
  // Enhanced numerical guards
  const eps = clamp(Math.max(1e-3, Math.min(0.1, 1e-3)), 1e-6, 0.1);
  
  // Clamp pressure ratios with numerical guards
  const r_star = clamp(P2/Pstar, 1e-12, 1-1e-9);
  const r_f = clamp(P2/Pf, 1e-12, 1-1e-9);
  
  // y = (P2/P)^(1/gamma), so P = P2/y^gamma
  // Limits: P goes from Pstar to Pf
  // y goes from (P2/Pstar)^(1/gamma) to (P2/Pf)^(1/gamma)
  const y_hi = Math.pow(r_star, 1/gamma);
  const y_lo = Math.pow(r_f, 1/gamma);
  
  // Guard against invalid integration bounds
  if (y_hi <= y_lo || y_hi >= 1-eps || y_lo <= 0) {
    return 0;
  }
  
  // Integrand: gamma / (y * sqrt(y^2 - y^(gamma+1)))
  const integrand = (y: number) => {
    if (y <= 0 || y >= 1-eps) return 0;
    const y2 = y * y;
    const ygp1 = Math.pow(y, gamma + 1);
    const discriminant = pos(y2 - ygp1);
    
    // Additional protection for near-singularity
    if (discriminant <= 1e-15 || y >= 1-2*eps) {
      return 0;
    }
    
    const sqrtTerm = Math.sqrt(discriminant);
    if (sqrtTerm <= 1e-15) return 0;
    
    return gamma / (y * sqrtTerm);
  };
  
  try {
    return adaptiveSimpson(integrand, y_lo, Math.min(y_hi, 1-eps), 1e-7, 1e-12);
  } catch (error) {
    // Throw specific integral error for better user feedback
    throw new IntegralError(
      'Integral near target pressure is too stiff for numerical integration',
      { 
        y_lo, 
        y_hi, 
        eps, 
        P2, 
        Pstar, 
        Pf, 
        gamma,
        integration_bounds: { y_lo, y_hi: Math.min(y_hi, 1-eps) }
      }
    );
  }
}

/**
 * Subcritical integral for filling using z = (P/Ps)^(1/gamma) substitution
 * @param Ps Supply pressure [Pa]
 * @param Pstar Critical pressure [Pa]
 * @param Pf Final pressure [Pa]
 * @param gamma Heat capacity ratio
 * @returns Integral value [-]
 */
export function subcriticalIntegralFilling(Ps: number, Pstar: number, Pf: number, gamma: number): number {
  // Enhanced numerical guards
  const eps = clamp(Math.max(1e-3, Math.min(0.1, 1e-3)), 1e-6, 0.1);
  
  // Clamp pressure ratios with numerical guards
  const r_star = clamp(Pstar/Ps, 1e-12, 1-1e-9);
  const r_f = clamp(Pf/Ps, 1e-12, 1-1e-9);
  
  // z = (P/Ps)^(1/gamma), so P = Ps * z^gamma
  // Limits: P goes from Pstar to Pf
  // z goes from (Pstar/Ps)^(1/gamma) to (Pf/Ps)^(1/gamma)
  const z_lo = Math.pow(r_star, 1/gamma);
  const z_hi = Math.pow(r_f, 1/gamma);
  
  // Guard against invalid integration bounds
  if (z_hi <= z_lo || z_hi >= 1-eps || z_lo <= 0) {
    return 0;
  }
  
  // Integrand: gamma / (z * sqrt(z^2 - z^(gamma+1)))
  const integrand = (z: number) => {
    if (z <= 0 || z >= 1-eps) return 0;
    const z2 = z * z;
    const zgp1 = Math.pow(z, gamma + 1);
    const discriminant = pos(z2 - zgp1);
    
    // Additional protection for near-singularity
    if (discriminant <= 1e-15 || z >= 1-2*eps) {
      return 0;
    }
    
    const sqrtTerm = Math.sqrt(discriminant);
    if (sqrtTerm <= 1e-15) return 0;
    
    return gamma / (z * sqrtTerm);
  };
  
  try {
    return adaptiveSimpson(integrand, z_lo, Math.min(z_hi, 1-eps), 1e-7, 1e-12);
  } catch (error) {
    // Throw specific integral error for better user feedback
    throw new IntegralError(
      'Integral near target pressure is too stiff for numerical integration',
      { 
        z_lo, 
        z_hi, 
        eps, 
        Ps, 
        Pstar, 
        Pf, 
        gamma,
        integration_bounds: { z_lo, z_hi: Math.min(z_hi, 1-eps) }
      }
    );
  }
}

/**
 * Enhanced orifice flow model - Blowdown (isothermal)
 * @param inputs Computation inputs
 * @returns Computed time [s]
 */
export function orificeTfromD_blowdown(inputs: ComputeInputs): number {
  const { V, P1, P2, T, gas, D, Cd = 0.62, epsilon = 0.01 } = inputs;
  const { R, gamma } = gas;
  
  // Guard epsilon
  const eps = clamp(epsilon, 1e-3, 0.1);
  
  const rc = criticalRatio(gamma);
  const cstar = Cstar(gamma, R, T);
  const kCoeff = K(gamma, R, T);
  const A = Math.PI * Math.pow(D!, 2) / 4;
  const Pf = P2 * (1 + eps);
  
  // Critical pressure
  const Pstar = P2 / rc;
  
  if (P1 <= Pstar) {
    // Only subcritical flow
    const I_sub = subcriticalIntegralBlowdown(P2, P1, Pf, gamma);
    return (V / (R * T * Cd * A)) * (1 / kCoeff) * I_sub;
  } else {
    // Split into sonic and subsonic phases
    const t_sonic = (V / (R * T * Cd * A)) * Math.log(P1 / Pstar) / cstar;
    const I_sub = subcriticalIntegralBlowdown(P2, Pstar, Pf, gamma);
    const t_sub = (V / (R * T * Cd * A)) * (1 / kCoeff) * I_sub;
    
    return t_sonic + t_sub;
  }
}

/**
 * Enhanced orifice flow model - Filling (isothermal)
 * @param inputs Computation inputs  
 * @returns Computed time [s]
 */
export function orificeTfromD_filling(inputs: ComputeInputs): number {
  const { V, P1, P2, T, gas, D, Cd = 0.62, epsilon = 0.01, Ps } = inputs;
  const { R, gamma } = gas;
  
  if (!Ps) throw new Error('Supply pressure Ps required for filling');
  
  // Validate filling inequalities: Ps > Pf > P1 > 0
  if (P1 <= 0 || P2 <= P1 || Ps <= P2) {
    throw new Error(`Invalid filling inequalities: need Ps(${Ps}) > Pf(${P2}) > P1(${P1}) > 0`);
  }
  
  // Guard epsilon
  const eps = clamp(epsilon, 1e-3, 0.1);
  
  // Choking criterion: r_crit = (2/(γ+1))^(γ/(γ-1))
  const r_crit = Math.pow(2/(gamma+1), gamma/(gamma-1));
  const cstar = Cstar(gamma, R, T);
  const kCoeff = K(gamma, R, T);
  const A = Math.PI * Math.pow(D!, 2) / 4;
  const Pf = P2 * (1 - eps);
  
  // Check choking at vessel pressure: r = Pv/Ps
  // Start with initial pressure, check if choked at beginning
  const r_initial = P1 / Ps;
  const r_final = P2 / Ps;
  
  // Determine if flow is choked based on vessel pressure ratio
  if (r_final < r_crit) {
    // Flow becomes choked at some point - split integration
    const P_choke = Ps * r_crit; // Pressure where choking occurs
    
    if (P1 < P_choke) {
      // Start choked, then become unchoked
      const t_choked = (V / (R * T * Cd * A)) * Math.log(P_choke / P1) / cstar;
      const I_sub = subcriticalIntegralFilling(Ps, P_choke, Pf, gamma);
      const t_sub = (V / (R * T * Cd * A)) * (1 / kCoeff) * I_sub;
      
      return t_choked + t_sub;
    } else {
      // Never choked - only subcritical flow
      const I_sub = subcriticalIntegralFilling(Ps, P1, Pf, gamma);
      return (V / (R * T * Cd * A)) * (1 / kCoeff) * I_sub;
    }
  } else {
    // Never choked throughout filling - only subcritical flow  
    const I_sub = subcriticalIntegralFilling(Ps, P1, Pf, gamma);
    return (V / (R * T * Cd * A)) * (1 / kCoeff) * I_sub;
  }
}

/**
 * Compute the integral I (independent of A) for orifice blowdown
 * Returns I for P1→Pf with sonic split if needed
 * @param P1 Initial pressure [Pa]
 * @param P2 Exit pressure [Pa]  
 * @param T Temperature [K]
 * @param gamma Heat capacity ratio [-]
 * @param R Specific gas constant [J/(kg·K)]
 * @param epsilon Convergence tolerance [-]
 * @returns Object containing integral I [-]
 */
export function orificeIsothermalIntegral(P1: number, P2: number, T: number, gamma: number, R: number, epsilon: number = 0.01): { I: number } {
  // Guard epsilon
  const eps = clamp(epsilon, 1e-3, 0.1);
  
  const rc = criticalRatio(gamma);
  const cstar = Cstar(gamma, R, T);
  const kCoeff = K(gamma, R, T);
  const Pf = P2 * (1 + eps);
  
  // Critical pressure
  const Pstar = P2 / rc;
  
  if (P1 <= Pstar) {
    // Only subcritical flow
    const I_sub = subcriticalIntegralBlowdown(P2, P1, Pf, gamma);
    return { I: (1 / kCoeff) * I_sub };
  } else {
    // Split into sonic and subsonic phases
    const I_sonic = Math.log(P1 / Pstar) / cstar;
    const I_sub = subcriticalIntegralBlowdown(P2, Pstar, Pf, gamma);
    const I_subsonic = (1 / kCoeff) * I_sub;
    
    return { I: I_sonic + I_subsonic };
  }
}

/**
 * Legacy orifice time calculation for forward checks
 * @param inputs Computation inputs
 * @param A Area [m²]
 * @returns Time [s]
 */
export function timeOrificeFromAreaSI_legacy(inputs: ComputeInputs, A: number): number {
  const testInputs = { ...inputs, D: Math.sqrt(4 * A / Math.PI) };
  
  if (inputs.process === 'blowdown') {
    return orificeTfromD_blowdown(testInputs);
  } else {
    return orificeTfromD_filling(testInputs);
  }
}

/**
 * Solve for orifice diameter from time using isothermal integral method
 * @param inputs Computation inputs
 * @returns Solver result with explicit SI units
 */
export function solveOrifice_DfromT_isothermal(inputs: ComputeInputs): SolverResultSI {
  const {V, P1, P2, T, gas: {R, gamma}, Cd = 0.62, epsilon = 0.01, t: t_target} = inputs;
  const { I } = orificeIsothermalIntegral(P1, P2, T, gamma, R, epsilon);
  // t = (V/(R T Cd A)) * I  =>  A = (V/(R T Cd t)) * I
  const A = (V/(R*T*Cd*t_target)) * I;
  const D = Math.sqrt(4*A/Math.PI);
  
  // Forward check using SAME path: isothermal orifice with SAME ε, SAME P_f = P2*(1+ε)
  const t_check = timeOrificeFromAreaSI_legacy(inputs, A);
  
  // Residual analysis
  const relativeError = Math.abs(t_check - t_target) / t_target;
  const warnings: string[] = [];
  
  if (relativeError <= 0.01) {
    // Accept - good residual
    return { model:'orifice', A_SI_m2:A, D_SI_m:D, t_SI_s:t_check, diag:{I_total:I}, warnings };
  } else if (relativeError <= 0.03) {
    // Warning but don't reject
    warnings.push(`Isothermal residual ${(relativeError*100).toFixed(1)}% > 1% (acceptable < 3%)`);
    return { model:'orifice', A_SI_m2:A, D_SI_m:D, t_SI_s:t_check, diag:{I_total:I}, warnings };
  } else {
    // Reject - too large residual, but keep computed D in dev panel
    throw new ResidualError(
      `Isothermal residual ${(relativeError*100).toFixed(1)}% > 3% threshold`,
      t_check,
      t_target,
      { D_SI_m: D, I_total: I, relativeError }
    );
  }
}
