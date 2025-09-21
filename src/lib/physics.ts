/**
 * Gas Transfer Physics Calculations for Rigid Vessels
 * All units in SI: pressures in Pa (absolute), volumes in m³, temperatures in K, etc.
 * @fileoverview Complete implementation of capillary and orifice flow models
 */

import { brent } from './rootfind';
import { timeCapillaryFromAreaSI_validated } from './physics-capillary';
import { parseDecimalLoose } from './num-parse';
import { toSI_Time, type TimeUnit } from './units';

/**
 * Gas properties at 20°C (293.15 K)
 */
export interface GasProps {
  /** Gas name */
  name: string;
  /** Molar mass [kg/mol] */
  M: number;
  /** Specific gas constant [J/(kg·K)] */
  R: number;
  /** Heat capacity ratio Cp/Cv [-] */
  gamma: number;
  /** Dynamic viscosity [Pa·s] */
  mu: number;
}

/**
 * Computation input parameters
 */
export interface ComputeInputs {
  /** Process type: 'blowdown' (vessel empties) or 'filling' (vessel fills) */
  process: 'blowdown' | 'filling';
  /** What to solve for: diameter from time or time from diameter */
  solveFor: 'DfromT' | 'TfromD';
  /** Vessel volume [m³] */
  V: number;
  /** Initial pressure [Pa, absolute] */
  P1: number;
  /** Final pressure [Pa, absolute] */
  P2: number;
  /** Temperature [K] */
  T: number;
  /** Capillary/orifice length [m] */
  L: number;
  /** Gas properties */
  gas: GasProps;
  /** Discharge coefficient [-], default 0.62 for sharp orifice */
  Cd?: number;
  /** Convergence tolerance [-], default 0.01 (1%) */
  epsilon?: number;
  /** Thermodynamic regime: 'isothermal' or 'adiabatic' */
  regime?: 'isothermal' | 'adiabatic';
  /** Supply pressure for filling [Pa, absolute] */
  Ps?: number;
  /** Diameter [m] (when solving for time) */
  D?: number;
  /** Time [s] (when solving for diameter) */
  t?: number;
  /** Atmospheric pressure [Pa] for diagnostics */
  Patm_SI?: number;
  /** Model selection override */
  modelSelection?: 'orifice' | 'capillary';
}

/**
 * Detailed error information for actionable feedback
 */
export interface ComputationError {
  type: 'convergence' | 'bracketing' | 'numerical' | 'input' | 'model' | 'integral' | 'residual';
  message: string;
  details?: Record<string, any>;
  suggestions?: string[];
}

/**
 * Specific error types for better user feedback
 */
export class BracketError extends Error {
  type = 'bracketing' as const;
  details: Record<string, any>;
  suggestions: string[];
  
  constructor(message: string, details: Record<string, any> = {}) {
    super(message);
    this.name = 'BracketError';
    this.details = details;
    this.suggestions = [
      'Try increasing target time',
      'Widen A bounds in solver settings', 
      'Set ε=1% (default) for more stable convergence'
    ];
  }
}

export class IntegralError extends Error {
  type = 'integral' as const;
  details: Record<string, any>;
  suggestions: string[];
  
  constructor(message: string, details: Record<string, any> = {}) {
    super(message);
    this.name = 'IntegralError';
    this.details = details;
    this.suggestions = [
      'Increase ε (e.g., 1–2%) for more stable integration',
      'Choose adiabatic=false (isothermal) for simpler model',
      'Check pressure conditions are physically reasonable'
    ];
  }
}

export class ResidualError extends Error {
  type = 'residual' as const;
  t_check: number;
  t_target: number;
  details: Record<string, any>;
  suggestions: string[];
  
  constructor(message: string, t_check: number, t_target: number, details: Record<string, any> = {}) {
    super(message);
    this.name = 'ResidualError';
    this.t_check = t_check;
    this.t_target = t_target;
    this.details = details;
    this.suggestions = [
      'Switch to alternative model',
      'Retry with different epsilon value',
      'Check input parameter accuracy'
    ];
  }
}

/**
 * Solver results with explicit SI units
 */
export type SolverResultSI = {
  model: 'capillary' | 'orifice';
  A_SI_m2?: number; // or undefined if solving t
  D_SI_m?: number; // sqrt(4A/pi)
  t_SI_s?: number; // time from forward simulation check
  I_total?: number; // integral constant used (dimensionless)
  diag: Record<string, number | string | boolean>;
  warnings: string[];
};

/**
 * Computation results
 */
export interface ComputeOutputs {
  /** Computed diameter [m] */
  D?: number;
  /** Computed time [s] */
  t?: number;
  /** Flow regime verdict */
  verdict: 'capillary' | 'orifice' | 'both' | 'inconclusive';
  /** Detailed diagnostics */
  diagnostics: Record<string, number | string | boolean>;
  /** Warning messages */
  warnings: string[];
  /** Detailed error information if computation fails */
  error?: ComputationError;
  /** Sampling data for debug display */
  sampling?: SamplingData;
  /** Explicit SI results */
  solverResultSI?: SolverResultSI;
}

/**
 * Sampling data for debug diagnostics
 */
export interface SamplingData {
  samples: Array<{
    A: number;
    D_mm: number;
    t_model: number;
  }>;
  bracketInfo: {
    A_lo: number;
    A_hi: number;
    t_A_lo: number;
    t_A_hi: number;
    expansions: number;
  };
  monotonic: boolean;
  warnings: string[];
}

/** Universal gas constant [J/(mol·K)] */
const R_UNIVERSAL = 8.314462618;

/**
 * Built-in gas properties at 20°C (293.15 K)
 */
export const GASES: Record<string, GasProps> = {
  air: {
    name: 'Air',
    M: 0.028964, // kg/mol
    R: R_UNIVERSAL / 0.028964, // 287.0 J/(kg·K)
    gamma: 1.4,
    mu: 1.825e-5, // Pa·s at 20°C
  },
  N2: {
    name: 'Nitrogen',
    M: 0.028014,
    R: R_UNIVERSAL / 0.028014, // 296.8 J/(kg·K)
    gamma: 1.4,
    mu: 1.780e-5,
  },
  O2: {
    name: 'Oxygen',
    M: 0.031998,
    R: R_UNIVERSAL / 0.031998, // 259.8 J/(kg·K)
    gamma: 1.4,
    mu: 2.055e-5,
  },
  CH4: {
    name: 'Methane',
    M: 0.016042,
    R: R_UNIVERSAL / 0.016042, // 518.3 J/(kg·K)
    gamma: 1.32,
    mu: 1.127e-5,
  },
  CO2: {
    name: 'Carbon Dioxide',
    M: 0.044010,
    R: R_UNIVERSAL / 0.044010, // 188.9 J/(kg·K)
    gamma: 1.30,
    mu: 1.480e-5,
  },
  He: {
    name: 'Helium',
    M: 0.004003,
    R: R_UNIVERSAL / 0.004003, // 2077.0 J/(kg·K)
    gamma: 1.67,
    mu: 1.990e-5,
  },
};

// ============= HELPER FUNCTIONS =============

/**
 * Clamp value between bounds
 */
function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Positive value protection
 */
function pos(x: number): number {
  return Math.max(x, 0);
}

/**
 * Calculate critical pressure ratio for compressible flow
 * @param gamma Heat capacity ratio [-]
 * @returns Critical pressure ratio r* [-]
 */
export function criticalPressureRatio(gamma: number): number {
  return Math.pow(2 / (gamma + 1), gamma / (gamma - 1));
}

/**
 * Enhanced critical ratio calculation (same as criticalPressureRatio but for clarity)
 */
function criticalRatio(g: number): number {
  return Math.pow(2 / (g + 1), g / (g - 1));
}

/**
 * Sonic velocity coefficient C*
 * @param g Heat capacity ratio [-]
 * @param R Specific gas constant [J/(kg·K)]
 * @param T Temperature [K]
 * @returns C* coefficient [kg/(m²·s·Pa)]
 */
function Cstar(g: number, R: number, T: number): number {
  return Math.sqrt(g / (R * T)) * Math.pow(2 / (g + 1), (g + 1) / (2 * (g - 1)));
}

/**
 * Subsonic flow coefficient K
 * @param g Heat capacity ratio [-]
 * @param R Specific gas constant [J/(kg·K)]
 * @param T Temperature [K]
 * @returns K coefficient [kg/(m²·s·Pa)]
 */
function K(g: number, R: number, T: number): number {
  return Math.sqrt(2 * g / (R * T * (g - 1)));
}

/**
 * Calculate sonic flow coefficient (legacy)
 * @param gamma Heat capacity ratio [-]
 * @param R Specific gas constant [J/(kg·K)]
 * @param T Temperature [K]
 * @returns Sonic flow coefficient [m/s]
 */
function sonicFlowCoeff(gamma: number, R: number, T: number): number {
  return Math.sqrt(gamma / (R * T)) * Math.pow(2 / (gamma + 1), (gamma + 1) / (2 * (gamma - 1)));
}

/**
 * Calculate subsonic flow coefficient (legacy)
 * @param gamma Heat capacity ratio [-]
 * @param R Specific gas constant [J/(kg·K)]
 * @param T Temperature [K]
 * @returns Subsonic flow coefficient [m/s]
 */
function subsonicFlowCoeff(gamma: number, R: number, T: number): number {
  return Math.sqrt(2 * gamma / (R * T * (gamma - 1)));
}

/**
 * Calculate Reynolds number for pipe flow
 * @param rho Density [kg/m³]
 * @param v Velocity [m/s]
 * @param D Diameter [m]
 * @param mu Dynamic viscosity [Pa·s]
 * @returns Reynolds number [-]
 */
function reynoldsNumber(rho: number, v: number, D: number, mu: number): number {
  return (rho * v * D) / mu;
}

/**
 * Calculate density from ideal gas law
 * @param P Pressure [Pa]
 * @param R Specific gas constant [J/(kg·K)]
 * @param T Temperature [K]
 * @returns Density [kg/m³]
 */
function gasDensity(P: number, R: number, T: number): number {
  return P / (R * T);
}

/**
 * Capillary flow model - Diameter from time (blowdown)
 * @param inputs Computation inputs
 * @returns Computed diameter [m]
 */
function capillaryDfromT_blowdown(inputs: ComputeInputs): number {
  const { V, P1, P2, T, L, gas, t, epsilon = 0.01 } = inputs;
  const { mu } = gas;
  
  const Pf = P2 * (1 + epsilon);
  
  // Closed-form solution for capillary blowdown
  const numerator = (P1 - P2) * (Pf + P2);
  const denominator = (P1 + P2) * (Pf - P2);
  
  if (numerator <= 0 || denominator <= 0) {
    throw new Error('Invalid pressure conditions for capillary blowdown');
  }
  
  const lnTerm = Math.log(numerator / denominator);
  const D4 = (128 * mu * L * V * lnTerm) / (Math.PI * t! * P2);
  
  return Math.pow(D4, 0.25);
}

/**
 * Capillary flow model - Diameter from time (filling)
 * @param inputs Computation inputs
 * @returns Computed diameter [m]
 */
function capillaryDfromT_filling(inputs: ComputeInputs): number {
  const { V, P1, P2, T, L, gas, t, epsilon = 0.01, Ps } = inputs;
  const { mu } = gas;
  
  if (!Ps) throw new Error('Supply pressure Ps required for filling');
  
  // Enhanced validation for filling mode
  if (Ps <= P1) {
    throw new Error(`Supply pressure Ps (${Ps}) must be greater than initial pressure P1 (${P1})`);
  }
  if (Ps <= P2) {
    throw new Error(`Supply pressure Ps (${Ps}) must be greater than final pressure P2 (${P2})`);
  }
  if (!Number.isFinite(t) || t! <= 0) {
    throw new Error(`Invalid time for filling: ${t}`);
  }
  
  const Pf = P2 * (1 - epsilon);
  
  const numerator = (Ps - P1) * (Pf + Ps);
  const denominator = (Ps + P1) * (Pf - Ps);
  
  if (numerator <= 0) {
    throw new Error(`Numerator ≤ 0: (Ps-P1)*(Pf+Ps) = (${Ps}-${P1})*(${Pf}+${Ps}) = ${numerator}`);
  }
  if (denominator <= 0) {
    throw new Error(`Denominator ≤ 0: (Ps+P1)*(Pf-Ps) = (${Ps}+${P1})*(${Pf}-${Ps}) = ${denominator}`);
  }
  
  const lnTerm = Math.log(numerator / denominator);
  if (!Number.isFinite(lnTerm)) {
    throw new Error(`Invalid logarithm: ln(${numerator}/${denominator}) = ${lnTerm}`);
  }
  
  const D4 = (128 * mu * L * V * lnTerm) / (Math.PI * t! * Ps);
  
  if (D4 <= 0) {
    throw new Error(`D^4 calculation invalid: ${D4}`);
  }
  
  return Math.pow(D4, 0.25);
}

/**
 * Capillary flow model - Time from diameter (filling)
 * @param inputs Computation inputs
 * @returns Computed time [s]
 */
function capillaryTfromD_filling(inputs: ComputeInputs): number {
  const { V, P1, P2, T, L, gas, D, epsilon = 0.01, Ps } = inputs;
  const { mu } = gas;
  
  if (!Ps) throw new Error('Supply pressure Ps required for filling');
  
  const Pf = P2 * (1 - epsilon);
  
  const numerator = (Ps - P1) * (Pf + Ps);
  const denominator = (Ps + P1) * (Pf - Ps);
  
  if (numerator <= 0 || denominator <= 0) {
    throw new Error('Invalid pressure conditions for capillary filling');
  }
  
  const lnTerm = Math.log(numerator / denominator);
  const D4 = Math.pow(D!, 4);
  
  return (128 * mu * L * V * lnTerm) / (Math.PI * D4 * Ps);
}

// ============= ADAPTIVE SIMPSON INTEGRATOR =============

/**
 * Adaptive Simpson's rule integrator
 * @param func Function to integrate
 * @param a Lower bound
 * @param b Upper bound
 * @param rtol Relative tolerance
 * @param atol Absolute tolerance
 * @param maxDepth Maximum recursion depth
 * @returns Integral value
 */
function adaptiveSimpson(
  func: (x: number) => number,
  a: number,
  b: number,
  rtol: number = 1e-7,
  atol: number = 1e-12,
  maxDepth: number = 20
): number {
  
  function simpson(x0: number, x1: number, x2: number): number {
    const h = (x2 - x0) / 2;
    return h * (func(x0) + 4 * func(x1) + func(x2)) / 3;
  }
  
  function adaptiveHelper(x0: number, x2: number, eps: number, whole: number, depth: number): number {
    if (depth >= maxDepth) return whole;
    
    const x1 = (x0 + x2) / 2;
    const x01 = (x0 + x1) / 2;
    const x12 = (x1 + x2) / 2;
    
    const left = simpson(x0, x01, x1);
    const right = simpson(x1, x12, x2);
    const total = left + right;
    
    const error = Math.abs(total - whole);
    if (error <= 15 * eps) {
      return total + (total - whole) / 15;
    }
    
    return adaptiveHelper(x0, x1, eps / 2, left, depth + 1) + 
           adaptiveHelper(x1, x2, eps / 2, right, depth + 1);
  }
  
  if (Math.abs(b - a) < atol) return 0;
  
  const mid = (a + b) / 2;
  const whole = simpson(a, mid, b);
  const eps = Math.max(atol, rtol * Math.abs(whole));
  
  return adaptiveHelper(a, b, eps, whole, 0);
}

// ============= SUBCRITICAL INTEGRALS =============

/**
 * Subcritical integral for blowdown using y = (P2/P)^(1/gamma) substitution
 * @param P2 Exit pressure [Pa]
 * @param Pstar Critical pressure [Pa]
 * @param Pf Final pressure [Pa]
 * @param gamma Heat capacity ratio
 * @returns Integral value [-]
 */
function subcriticalIntegralBlowdown(P2: number, Pstar: number, Pf: number, gamma: number): number {
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
function subcriticalIntegralFilling(Ps: number, Pstar: number, Pf: number, gamma: number): number {
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

// ============= ENHANCED ORIFICE TIME SOLVERS =============

/**
 * Enhanced orifice flow model - Blowdown (isothermal)
 * @param inputs Computation inputs
 * @returns Computed time [s]
 */
function orificeTfromD_blowdown(inputs: ComputeInputs): number {
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
function orificeIsothermalIntegral(P1: number, P2: number, T: number, gamma: number, R: number, epsilon: number = 0.01): { I: number } {
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
 * Solve for orifice diameter from time using isothermal integral method
 * @param inputs Computation inputs
 * @returns Solver result with explicit SI units
 */
function solveOrifice_DfromT_isothermal(inputs: ComputeInputs): SolverResultSI {
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

// ============= ROBUST ROOT FINDING FOR D FROM T =============

// ============= BRACKET PERSISTENCE =============

interface BracketCache {
  A_lo: number;
  A_hi: number;
  timestamp: number;
  processType: string;
  gasType: string;
}

function saveBracketToCache(A_lo: number, A_hi: number, process: string, gasName: string) {
  try {
    const cacheKey = `gasTransfer-bracket-${process}-${gasName}`;
    const cache: BracketCache = {
      A_lo,
      A_hi,
      timestamp: Date.now(),
      processType: process,
      gasType: gasName,
    };
    localStorage.setItem(cacheKey, JSON.stringify(cache));
  } catch (error) {
    // Silent fail - bracket caching is optimization only
  }
}

function loadBracketFromCache(process: string, gasName: string): [number, number] | null {
  try {
    const cacheKey = `gasTransfer-bracket-${process}-${gasName}`;
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;
    
    const cache: BracketCache = JSON.parse(cached);
    
    // Use cached bracket if less than 1 hour old
    const ageHours = (Date.now() - cache.timestamp) / (1000 * 60 * 60);
    if (ageHours < 1 && cache.processType === process && cache.gasType === gasName) {
      return [cache.A_lo, cache.A_hi];
    }
  } catch (error) {
    // Silent fail - bracket caching is optimization only
  }
  return null;
}

/**
 * Solve for diameter from time using robust root finding with auto-bracketing
 * @param inputs Computation inputs
 * @returns Computed diameter [m]
 */
function solveOrificeDfromT(inputs: ComputeInputs): { D: number; sampling?: SamplingData } {
  const t_target = inputs.t!;
  const gasName = inputs.gas.name || 'unknown';
  
  // Define objective function f(A) = t_model(A) - t_target
  const objectiveFunction = (A: number): number => {
    const D = Math.sqrt(4 * A / Math.PI);
    const testInputs = { ...inputs, D };
    
    let t_calc: number;
    if (inputs.process === 'blowdown') {
      t_calc = orificeTfromD_blowdown(testInputs);
    } else {
      t_calc = orificeTfromD_filling(testInputs);
    }
    
    return t_calc - t_target;
  };
  
  // Define time function for sampling and inclusion tests
  const timeFunction = (A: number): number => {
    const D = Math.sqrt(4 * A / Math.PI);
    const testInputs = { ...inputs, D };
    
    if (inputs.process === 'blowdown') {
      return orificeTfromD_blowdown(testInputs);
    } else {
      return orificeTfromD_filling(testInputs);
    }
  };
  
  // Try to load cached bracket first
  const cachedBracket = loadBracketFromCache(inputs.process, gasName);
  let A_lo: number, A_hi: number;
  
  if (cachedBracket) {
    [A_lo, A_hi] = cachedBracket;
    console.log(`Using cached bracket: A_lo=${A_lo.toExponential(3)}, A_hi=${A_hi.toExponential(3)}`);
  } else {
    // Default initial bracket
    A_lo = 1e-12; // Very small area
    A_hi = 1e-2;  // Large area (D ≈ 112.8 mm)
  }
  
  // Calculate physical diameter constraint based on vessel volume
  const D_eq = Math.pow(6 * inputs.V / Math.PI, 1/3); // Volumic equivalent diameter
  const k_physical = 2; // Safety factor (can be 1-3)
  const D_max_physical = k_physical * D_eq;
  const A_hi_max = Math.PI / 4 * Math.pow(D_max_physical, 2);
  
  // Apply physical constraint to initial bracket
  if (A_hi > A_hi_max) {
    const A_hi_original = A_hi;
    A_hi = A_hi_max;
    console.log(`🔧 Physical constraint applied: A_hi reduced from ${A_hi_original.toExponential(3)} to ${A_hi.toExponential(3)} (D_eq=${(D_eq*1000).toFixed(1)}mm, D_max=${(D_max_physical*1000).toFixed(1)}mm, k=${k_physical})`);
  }
  
  // Test inclusion and auto-expand based on time range
  let expansions = 0;
  const maxExpansions = 4; // Max 4 expansions as requested
  
  while (expansions < maxExpansions) {
    try {
      // Calculate times at bracket endpoints (assuming t decreases with A)
      const t_lo = timeFunction(A_lo);
      const t_hi = timeFunction(A_hi);
      
      // Test inclusion: t_target should be in [t_hi, t_lo] (t decreases with A)
      if (t_target > t_lo || t_target < t_hi) {
        // Target time is outside bracket, need to expand
        if (t_target > t_lo) {
          A_lo /= 10; // Need smaller A (larger time)
        }
        if (t_target < t_hi) {
          A_hi = Math.min(A_hi * 10, A_hi_max); // Need larger A (smaller time), but respect physical vessel limit
        }
        expansions++;
        console.log(`Expansion ${expansions}: t_target=${t_target}s not in [${t_hi}s, ${t_lo}s], expanding to A=[${A_lo.toExponential(3)}, ${A_hi.toExponential(3)}]`);
      } else {
        // Target time is included in bracket
        console.log(`Target time ${t_target}s is included in [${t_hi}s, ${t_lo}s], proceeding with solving`);
        break;
      }
    } catch (error) {
      // If evaluation fails, try expanding
      A_lo /= 10;
      A_hi = Math.min(A_hi * 10, A_hi_max);
      expansions++;
      console.log(`Expansion ${expansions}: evaluation failed, expanding to A=[${A_lo.toExponential(3)}, ${A_hi.toExponential(3)}]`);
    }
  }
  
  if (expansions >= maxExpansions) {
    // Final inclusion test for error message
    try {
      const t_lo = timeFunction(A_lo);
      const t_hi = timeFunction(A_hi);
      throw { 
        message: "Target time out of bracket", 
        devNote: { 
          t_target_SI: t_target, 
          t_lo, 
          t_hi, 
          bracket: { A_lo, A_hi },
          expansions,
          max_expansions: maxExpansions
        } 
      };
    } catch (evalError) {
      throw new BracketError(
        `Solver could not bracket the solution after ${maxExpansions} expansions`,
        { A_lo, A_hi, expansions, t_target }
      );
    }
  }

  // Sample t(A) at 5 log-spaced points for debugging
  const samplingData: SamplingData = {
    samples: [],
    bracketInfo: {
      A_lo,
      A_hi,
      t_A_lo: 0,
      t_A_hi: 0,
      expansions
    },
    monotonic: true,
    warnings: []
  };

  try {
    // Calculate bracket endpoint times
    samplingData.bracketInfo.t_A_lo = timeFunction(A_lo);
    samplingData.bracketInfo.t_A_hi = timeFunction(A_hi);

    // Generate 5 log-spaced A values
    const logA_lo = Math.log10(A_lo);
    const logA_hi = Math.log10(A_hi);
    const deltaLog = (logA_hi - logA_lo) / 4;
    
    for (let i = 0; i < 5; i++) {
      const logA = logA_lo + i * deltaLog;
      const A = Math.pow(10, logA);
      const D_mm = Math.sqrt(4 * A / Math.PI) * 1000; // Convert to mm
      const t_model = timeFunction(A);
      
      samplingData.samples.push({ A, D_mm, t_model });
    }

    // Check monotonicity: t should be strictly decreasing with A
    let isMonotonic = true;
    const tolerance = 1e-6; // Small tolerance for numerical errors
    
    for (let i = 1; i < samplingData.samples.length; i++) {
      const t_prev = samplingData.samples[i-1].t_model;
      const t_curr = samplingData.samples[i].t_model;
      
      if (t_curr >= t_prev * (1 - tolerance)) {
        isMonotonic = false;
        break;
      }
    }
    
    samplingData.monotonic = isMonotonic;
    
    if (!isMonotonic) {
      samplingData.warnings.push('t(A) is not strictly decreasing - consider adjusting ε or shrinking domain');
    }
  } catch (error) {
    samplingData.warnings.push(`Sampling failed: ${(error as Error).message}`);
  }
  
  // Use Brent's method for robust root finding
  const A_solution = brent(objectiveFunction, [A_lo, A_hi], {
    tolerance: 1e-6,
    maxIterations: 200
  });
  
  if (A_solution === null) {
    throw new BracketError(
      'Root finding failed to converge - solver could not bracket the solution',
      { A_lo, A_hi, method: 'Brent', t_target }
    );
  }
  
  // Check if solution is at boundary (prevent returning exact A_lo/A_hi)
  const tolerance = 1e-10; // Very small tolerance for boundary detection
  const relativeToleranceA = 1e-6; // Relative tolerance (0.0001%)
  
  if (Math.abs(A_solution - A_lo) < tolerance || 
      Math.abs(A_solution - A_hi) < tolerance ||
      Math.abs(A_solution - A_lo) / A_lo < relativeToleranceA ||
      Math.abs(A_solution - A_hi) / A_hi < relativeToleranceA) {
    
    // Solution is too close to boundary
    const t_lo = timeFunction(A_lo);
    const t_hi = timeFunction(A_hi);
    throw { 
      message: "Target time out of bracket", 
      devNote: { 
        t_target_SI: t_target, 
        t_lo, 
        t_hi, 
        bracket: { A_lo, A_hi },
        A_solution,
        boundary_reached: true,
        expansions
      } 
    };
  }
  
  // Verify residual time tolerance
  const t_computed = timeFunction(A_solution);
  const residual_time = Math.abs(t_computed - t_target) / Math.max(t_target, 1e-9);
  const epsilon_threshold = Math.max(inputs.epsilon || 0.01, 0.01);
  
  if (residual_time > epsilon_threshold) {
    throw { 
      message: "Time residual too large", 
      devNote: { 
        t_target_SI: t_target, 
        t_computed,
        residual_time,
        epsilon_threshold,
        A_solution,
        bracket: { A_lo, A_hi }
      } 
    };
  }
  
  // Save successful bracket for future use
  saveBracketToCache(A_lo, A_hi, inputs.process, gasName);
  
  // Convert area back to diameter
  const D = Math.sqrt(4 * A_solution / Math.PI);
  
  // Sanity check
  if (D <= 0 || D > 1.0) {
    throw new BracketError(
      `Computed diameter ${D.toExponential(3)} m is outside reasonable bounds`,
      { D, A_solution, t_target }
    );
  }
  
  return { D, sampling: samplingData };
}

/**
 * Export the retry function for external use
 */
export { solveOrificeDfromTWithRetry };

/**
 * Enhanced solver with expanded bounds for retry attempts
 */
function solveOrificeDfromTWithRetry(inputs: ComputeInputs, expandFactor: number = 1): number {
  const t_target = inputs.t!;
  const gasName = inputs.gas.name || 'unknown';
  
  // Define objective function f(A) = t_model(A) - t_target
  const objectiveFunction = (A: number): number => {
    const D = Math.sqrt(4 * A / Math.PI);
    const testInputs = { ...inputs, D };
    
    let t_calc: number;
    if (inputs.process === 'blowdown') {
      t_calc = orificeTfromD_blowdown(testInputs);
    } else {
      t_calc = orificeTfromD_filling(testInputs);
    }
    
    return t_calc - t_target;
  };
  
  // Calculate physical diameter constraint based on vessel volume
  const D_eq = Math.pow(6 * inputs.V / Math.PI, 1/3); // Volumic equivalent diameter
  const k_physical = 2; // Safety factor (can be 1-3)
  const D_max_physical = k_physical * D_eq;
  const A_hi_max = Math.PI / 4 * Math.pow(D_max_physical, 2);
  
  // Try cached bracket first, then expand
  const cachedBracket = loadBracketFromCache(inputs.process, gasName);
  let A_lo: number, A_hi: number;
  
  if (cachedBracket) {
    [A_lo, A_hi] = cachedBracket;
    // Apply expansion factor to cached bracket
    A_lo = A_lo / Math.pow(expandFactor, 2);
    A_hi = Math.min(A_hi * Math.pow(expandFactor, 2), A_hi_max); // Respect physical constraint
  } else {
    // Expanded initial bracket
    A_lo = 1e-12 / Math.pow(expandFactor, 2); // Divide A_lo by expandFactor^2
    A_hi = Math.min(1e-2 * Math.pow(expandFactor, 2), A_hi_max);  // Multiply A_hi by expandFactor^2, respect physical constraint
  }
  
  // Log physical constraint application for retry
  if (A_hi >= A_hi_max * 0.99) { // Close to limit
    console.log(`🔧 Retry: Physical constraint applied A_hi=${A_hi.toExponential(3)} (D_eq=${(D_eq*1000).toFixed(1)}mm, D_max=${(D_max_physical*1000).toFixed(1)}mm, k=${k_physical}, expandFactor=${expandFactor})`);
  }
  
  // Auto-expand bracket up to 12 times
  let expansions = 0;
  const maxExpansions = 12;
  
  while (expansions < maxExpansions) {
    try {
      const f_lo = objectiveFunction(A_lo);
      const f_hi = objectiveFunction(A_hi);
      
      // Check if we have proper bracketing
      if (f_lo * f_hi < 0) {
        break; // We have a bracket
      }
      
      // Expand bracket
      if (f_lo < 0) {
        A_lo /= 10;
      }
      if (f_hi > 0) {
        A_hi = Math.min(A_hi * 10, A_hi_max); // Respect physical constraint in retry
      }
      
      expansions++;
    } catch (error) {
      // If evaluation fails, try expanding
      A_lo /= 10;
      A_hi = Math.min(A_hi * 10, A_hi_max); // Respect physical constraint in retry
      expansions++;
    }
  }
  
  if (expansions >= maxExpansions) {
    throw new BracketError(
      `Solver could not bracket the solution after ${maxExpansions} expansions (retry attempt)`,
      { A_lo, A_hi, expansions, t_target, expandFactor }
    );
  }
  
  // Use Brent's method for robust root finding
  const A_solution = brent(objectiveFunction, [A_lo, A_hi], {
    tolerance: 1e-6,
    maxIterations: 200
  });
  
  if (A_solution === null) {
    throw new BracketError(
      'Root finding failed to converge - solver could not bracket the solution (retry attempt)',
      { A_lo, A_hi, method: 'Brent', t_target, expandFactor }
    );
  }
  
  // Save successful expanded bracket for future use
  saveBracketToCache(A_lo, A_hi, inputs.process, gasName);
  
  // Convert area back to diameter
  const D = Math.sqrt(4 * A_solution / Math.PI);
  
  // Sanity check
  if (D <= 0 || D > 1.0) {
    throw new BracketError(
      `Computed diameter ${D.toExponential(3)} m is outside reasonable bounds (retry attempt)`,
      { D, A_solution, t_target, expandFactor }
    );
  }
  
  return D;
}

/**
 * Enhanced orifice flow model - Filling (isothermal)
 * @param inputs Computation inputs
 * @returns Computed time [s]
 */
function orificeTfromD_filling(inputs: ComputeInputs): number {
  const { V, P1, P2, T, gas, D, Cd = 0.62, epsilon = 0.01, Ps } = inputs;
  const { R, gamma } = gas;
  
  if (!Ps) throw new Error('Supply pressure Ps required for filling');
  
  // Guard epsilon
  const eps = clamp(epsilon, 1e-3, 0.1);
  
  const rc = criticalRatio(gamma);
  const cstar = Cstar(gamma, R, T);
  const kCoeff = K(gamma, R, T);
  const A = Math.PI * Math.pow(D!, 2) / 4;
  const Pf = P2 * (1 - eps);
  
  // Critical pressure
  const Pstar = rc * Ps;
  
  if (P1 >= Pstar) {
    // Only subcritical flow
    const I_sub = subcriticalIntegralFilling(Ps, P1, Pf, gamma);
    return (V / (R * T * Cd * A)) * (Ps / kCoeff) * I_sub;
  } else {
    // Split into sonic and subsonic phases
    const t_sonic = (V / (R * T * Cd * A * Ps * cstar)) * (Pstar - P1);
    const I_sub = subcriticalIntegralFilling(Ps, Pstar, Pf, gamma);
    const t_sub = (V / (R * T * Cd * A)) * (Ps / kCoeff) * I_sub;
    
    return t_sonic + t_sub;
  }
}

/**
 * Calculate enhanced diagnostics with precise throat/exit states
 * @param inputs Computation inputs
 * @param D Diameter [m]
 * @returns Diagnostics object
 */
function calculateDiagnostics(inputs: ComputeInputs, D: number): Record<string, number | string | boolean> {
  const { V, P1, P2, T, L, gas, process, Ps } = inputs;
  const { R, gamma, mu } = gas;
  
  const A = Math.PI * Math.pow(D, 2) / 4;
  const rStar = criticalPressureRatio(gamma);
  const LoverD = L / D;
  
  // Determine if choked at start
  let isChoked: boolean;
  let Mach: number;
  let v: number; // velocity
  let rho: number; // density
  let P_exit: number;
  
  if (process === 'blowdown') {
    const Pstar = P2 / rStar;
    isChoked = P1 > Pstar;
    
    if (isChoked) {
      // Throat conditions at sonic state - Mach is exactly 1 at choking
      const T_t = T * 2 / (gamma + 1);
      const P_t = P1 * Math.pow(2 / (gamma + 1), gamma / (gamma - 1));
      const a_t = Math.sqrt(gamma * R * T_t);
      rho = P_t / (R * T_t);
      v = a_t;
      Mach = 1.0; // Exactly 1 at sonic choking
      P_exit = P_t;
    } else {
      // Subsonic conditions
      P_exit = P2;
      rho = P_exit / (R * T);
      // Estimate mass flow rate and velocity
      const deltaP = P1 - P2;
      v = Math.sqrt(2 * deltaP / rho);
      const a = Math.sqrt(gamma * R * T);
      Mach = v / a;
    }
  } else {
    // Filling
    const Ps_val = Ps || P2;
    const Pstar = rStar * Ps_val;
    isChoked = P1 < Pstar;
    
    if (isChoked) {
      // Throat conditions at sonic state - Mach is exactly 1 at choking
      const T_t = T * 2 / (gamma + 1);
      const P_t = Ps_val * Math.pow(2 / (gamma + 1), gamma / (gamma - 1));
      const a_t = Math.sqrt(gamma * R * T_t);
      rho = P_t / (R * T_t);
      v = a_t;
      Mach = 1.0; // Exactly 1 at sonic choking
      P_exit = P_t;
    } else {
      // Subsonic conditions
      P_exit = P1;
      rho = P_exit / (R * T);
      const deltaP = Ps_val - P1;
      v = Math.sqrt(2 * deltaP / rho);
      const a = Math.sqrt(gamma * R * T);
      Mach = v / a;
    }
  }
  
  const Re = reynoldsNumber(rho, v, D, mu);
  
  return {
    Re,
    'L/D': LoverD,
    Mach,
    choked: isChoked,
    'P_exit_Pa': P_exit,
    'rho_kg_m3': rho,
    'v_m_s': v,
    'r_critical': rStar,
    'throat_velocity': isChoked ? v : undefined,
    'throat_density': isChoked ? rho : undefined,
  };
}

/**
 * Generate warnings based on model validity
 * @param diagnostics Calculated diagnostics
 * @param inputs Computation inputs
 * @returns Array of warning messages
 */
function generateWarnings(diagnostics: Record<string, number | string | boolean>, inputs: ComputeInputs): string[] {
  const warnings: string[] = [];
  const Re = diagnostics.Re as number;
  const LoverD = diagnostics['L/D'] as number;
  
  // Capillary flow validity checks
  if (Re > 2000) {
    warnings.push(`Reynolds number ${Re.toFixed(0)} > 2000: turbulent flow, capillary model may be invalid`);
  }
  
  if (LoverD < 10) {
    warnings.push(`L/D ratio ${LoverD.toFixed(1)} < 10: entrance effects significant, capillary model may be invalid`);
  }
  
  // Pressure ratio checks
  if (inputs.process === 'blowdown' && inputs.P1 / inputs.P2 > 10) {
    warnings.push('High pressure ratio: consider compressibility effects');
  }
  
  if (inputs.process === 'filling' && inputs.Ps && inputs.Ps / inputs.P1 > 10) {
    warnings.push('High pressure ratio: consider compressibility effects');
  }
  
  return warnings;
}

/**
 * Compute diameter from time
 * @param inputs Computation inputs
 * @returns Computation results
 */
export function computeDfromT(inputs: ComputeInputs): ComputeOutputs {
  try {
    // Robust target time reading - compatible with current interface but extensible
    const raw = inputs?.t; // For now, read from 't' field since that's what ComputeInputs has
    const unit = "s"; // Default unit, could be extended later for UI inputs with unit selection
    const parsed = Number(String(raw).replace(",", ".").trim());
    const t_target_SI = toSI_Time(parsed, unit as TimeUnit);
    
    // Guard: prevent fallback on invalid time
    if (!Number.isFinite(t_target_SI) || t_target_SI <= 0) {
      throw { message: "Invalid target time", devNote: { raw, unit, parsed, t_target_SI, error: "NaN, infinite, or ≤0" } };
    }
    
    // Update inputs with validated time
    const validatedInputs = { ...inputs, t: t_target_SI };
    
    let D_capillary: number | undefined;
    let D_orifice: number | undefined;
    const warnings: string[] = [];
    let capillary_error: string | undefined;
    let orifice_error: string | undefined;
    
    // Check if model is forced via modelSelection
    const forcedModel = validatedInputs.modelSelection;
    
    // 1) Compute D_cap via capillary model
    try {
      if (validatedInputs.process === 'blowdown') {
        D_capillary = capillaryDfromT_blowdown(validatedInputs);
      } else {
        D_capillary = capillaryDfromT_filling(validatedInputs);
      }
    } catch (error) {
      capillary_error = `Capillary model failed: ${(error as Error).message}`;
    }
    
    // 2) Compute D_orif via orifice model (try isothermal first, then robust root finding)
    let samplingData: SamplingData | undefined;
    let orifice_isothermal_failed = false;
    let isothermal_residual_marginal = false;
    
    try {
      // Try isothermal solver first if regime is isothermal or default
      if (validatedInputs.regime !== 'adiabatic') {
        try {
          const isothermalResult = solveOrifice_DfromT_isothermal(validatedInputs);
          D_orifice = isothermalResult.D_SI_m;
          
          // Check if flow is choked and monotonic for smart switching decision
          if (D_orifice) {
            const testDiag = calculateDiagnostics(validatedInputs, D_orifice);
            const isChoked = testDiag.choked as boolean;
            
            // Sample to check monotonicity
            try {
              const sampleResult = sample_tA(validatedInputs, 'orifice', 1e-12, 1e-8, 5);
              const isMonotonic = sampleResult.samples.length >= 2 && 
                sampleResult.samples.every((s, i, arr) => i === 0 || s.t_s < arr[i-1].t_s);
              
              if (isChoked && isMonotonic) {
                samplingData = {
                  samples: sampleResult.samples.map(s => ({
                    A: s.A_m2,
                    D_mm: s.D_m * 1000,
                    t_model: s.t_s
                  })),
                  monotonic: isMonotonic,
                  bracketInfo: {
                    A_lo: 1e-12,
                    A_hi: 1e-8,
                    t_A_lo: sampleResult.samples[0]?.t_s || 0,
                    t_A_hi: sampleResult.samples[sampleResult.samples.length - 1]?.t_s || 0,
                    expansions: 0
                  },
                  warnings: []
                };
              }
            } catch {}
          }
        } catch (error) {
          if (error instanceof ResidualError) {
            orifice_isothermal_failed = true;
            // Check if we should warn but not switch
            if (D_orifice) {
              const testDiag = calculateDiagnostics(inputs, D_orifice);
              const isChoked = testDiag.choked as boolean;
              
              if (isChoked) {
                isothermal_residual_marginal = true;
                warnings.push("Residual marginal; kept orifice model (isothermal).");
                // Keep the isothermal result despite residual failure
                D_orifice = (error as ResidualError).details?.D_SI_m;
              }
            }
          }
        }
      }
      
      // Fall back to iterative solver only if isothermal completely failed or regime is adiabatic
      if (!D_orifice || (orifice_isothermal_failed && !isothermal_residual_marginal)) {
        const result = solveOrificeDfromT(inputs);
        D_orifice = result.D;
        samplingData = result.sampling;
      }
    } catch (error) {
      if (error instanceof BracketError) {
        orifice_error = `Solver could not bracket the solution. Try increasing target time, widening A bounds, or set ε=1% (default).`;
      } else if (error instanceof IntegralError) {
        orifice_error = `Integral near target pressure is too stiff. Increase ε (e.g., 1–2%) or choose adiabatic=false (isothermal).`;
      } else if (typeof error === 'object' && error !== null && 'type' in error) {
        const compError = error as ComputationError;
        orifice_error = `Orifice model ${compError.type} error: ${compError.message}`;
        if (compError.suggestions && compError.suggestions.length > 0) {
          orifice_error += `. Suggestions: ${compError.suggestions.join('; ')}.`;
        }
      } else {
        orifice_error = `Orifice model failed: ${(error as Error).message}`;
      }
    }
    
    // 3) Validate model assumptions and choose the best
    let verdict: ComputeOutputs['verdict'] = 'inconclusive';
    let D: number | undefined;
    let rationale = '';
    
    // Check validity of each model with smart de-prioritization
    let cap_valid = false;
    let ori_valid = false;
    let cap_diagnostics: Record<string, number | string | boolean> = {};
    let ori_diagnostics: Record<string, number | string | boolean> = {};
    let capillary_deprioritized = false;
    
    if (D_capillary) {
      cap_diagnostics = calculateDiagnostics(inputs, D_capillary);
      const Re = cap_diagnostics.Re as number;
      const LoverD = cap_diagnostics['L/D'] as number;
      
      // Smart de-prioritization: if L/D < 10 AND Re > 5000, de-prioritize capillary
      if (LoverD < 10 && Re > 5000) {
        capillary_deprioritized = true;
        cap_valid = false; // Force orifice selection
        warnings.push(`Capillary de-prioritized: L/D=${LoverD.toFixed(1)} < 10 and Re=${Math.round(Re)} > 5000. Orifice model automatically selected.`);
      } else {
        cap_valid = Re <= 2000 && LoverD >= 10;
      }
    }
    
    if (D_orifice) {
      ori_diagnostics = calculateDiagnostics(inputs, D_orifice);
      ori_valid = true; // Orifice model is more generally applicable
      
      // If isothermal residual was marginal but we kept it, note this
      if (isothermal_residual_marginal) {
        ori_diagnostics.isothermal_marginal = true;
      }
    }
    
    if (cap_valid && ori_valid && !capillary_deprioritized) {
      // Both valid and capillary not de-prioritized
      // If orifice has isothermal marginal residual, prefer it over capillary unless clear capillary advantage
      if (isothermal_residual_marginal) {
        verdict = 'orifice';
        D = D_orifice;
        rationale = `Orifice chosen (isothermal with marginal residual but choked flow detected). ${ori_diagnostics.choked ? 'Choked' : 'Subsonic'} flow.`;
      } else {
        // Use forward simulation to pick best
        let cap_residual = Infinity;
        let ori_residual = Infinity;
        
        try {
          const cap_forward = inputs.process === 'blowdown' 
            ? orificeTfromD_blowdown({ ...inputs, D: D_capillary })
            : orificeTfromD_filling({ ...inputs, D: D_capillary });
          cap_residual = Math.abs((cap_forward - inputs.t!) / inputs.t!);
        } catch {}
        
        try {
          const ori_forward = inputs.process === 'blowdown'
            ? orificeTfromD_blowdown({ ...inputs, D: D_orifice })
            : orificeTfromD_filling({ ...inputs, D: D_orifice });
          ori_residual = Math.abs((ori_forward - inputs.t!) / inputs.t!);
        } catch {}
        
        if (cap_residual < ori_residual) {
          verdict = 'capillary';
          D = D_capillary;
          rationale = `Both models valid. Capillary chosen (lower residual: ${(cap_residual * 100).toFixed(3)}% vs ${(ori_residual * 100).toFixed(3)}%). Re=${Math.round(cap_diagnostics.Re as number)}, L/D=${Math.round(cap_diagnostics['L/D'] as number)}.`;
        } else {
          verdict = 'orifice';
          D = D_orifice;
          rationale = `Both models valid. Orifice chosen (lower residual: ${(ori_residual * 100).toFixed(3)}% vs ${(cap_residual * 100).toFixed(3)}%). ${ori_diagnostics.choked ? 'Choked' : 'Subsonic'} flow.`;
        }
      }
    } else if (cap_valid && !ori_valid && !capillary_deprioritized) {
      // Only switch to capillary if physical assumptions clearly favor it
      const Re = cap_diagnostics.Re as number;
      const LoverD = cap_diagnostics['L/D'] as number;
      const isChoked = ori_diagnostics.choked as boolean;
      
      if (!isChoked && Re <= 2000 && LoverD >= 10) {
        verdict = 'capillary';
        D = D_capillary;
        rationale = `Auto-switch to capillary: assumptions favor capillary (non-choked, Re=${Math.round(Re)} ≤ 2000, L/D=${Math.round(LoverD)} ≥ 10).`;
      } else {
        verdict = 'orifice';
        D = D_orifice;
        rationale = `Kept orifice model despite validity issues. Physical assumptions don't clearly favor capillary switch.`;
      }
    } else if ((!cap_valid && ori_valid) || (capillary_deprioritized && ori_valid)) {
      verdict = 'orifice';
      D = D_orifice;
      if (capillary_deprioritized) {
        rationale = `Orifice model chosen (capillary de-prioritized due to L/D < 10 and Re > 5000). ${ori_diagnostics.choked ? 'Choked' : 'Subsonic'} flow.`;
      } else {
        rationale = `Orifice model chosen. Capillary invalid (Re=${cap_diagnostics.Re ? Math.round(cap_diagnostics.Re as number) : 'N/A'}, L/D=${cap_diagnostics['L/D'] ? Math.round(cap_diagnostics['L/D'] as number) : 'N/A'}). ${ori_diagnostics.choked ? 'Choked' : 'Subsonic'} flow.`;
      }
    } else if (D_capillary && D_orifice) {
      verdict = 'both';
      D = D_orifice; // Default to orifice when both invalid
      rationale = `Neither model fully valid. Both results shown for comparison. Consider checking input parameters.`;
      warnings.push(`Capillary: Re=${cap_diagnostics.Re ? Math.round(cap_diagnostics.Re as number) : 'N/A'} (need ≤2000), L/D=${cap_diagnostics['L/D'] ? Math.round(cap_diagnostics['L/D'] as number) : 'N/A'} (need ≥10)`);
    } else if (D_capillary) {
      verdict = 'capillary';
      D = D_capillary;
      rationale = `Only capillary model converged. ${cap_valid ? 'Valid' : 'Invalid'} assumptions.`;
    } else if (D_orifice) {
      verdict = 'orifice';
      D = D_orifice;
      rationale = `Only orifice model converged. ${ori_diagnostics.choked ? 'Choked' : 'Subsonic'} flow.`;
    }
    
    if (!D) {
      throw new Error('No valid solution found');
    }
    
    // Add model-specific errors to warnings
    if (capillary_error) warnings.push(capillary_error);
    if (orifice_error) warnings.push(orifice_error);
    
    const diagnostics = calculateDiagnostics(inputs, D);
    diagnostics.rationale = rationale;
    
    // Add bracket endpoint info to diagnostics if available
    if (samplingData) {
      diagnostics['t(A_lo)'] = samplingData.bracketInfo.t_A_lo;
      diagnostics['t(A_hi)'] = samplingData.bracketInfo.t_A_hi;
      diagnostics.expansions = samplingData.bracketInfo.expansions;
      
      // Add explicit bracket information for debugging
      diagnostics.bracket_A_lo_m2 = samplingData.bracketInfo.A_lo;
      diagnostics.bracket_A_hi_m2 = samplingData.bracketInfo.A_hi;
      diagnostics.bracket_t_lo_s = samplingData.bracketInfo.t_A_lo;
      diagnostics.bracket_t_hi_s = samplingData.bracketInfo.t_A_hi;
      diagnostics.bracket_expansions = samplingData.bracketInfo.expansions;
      
      // Add monotonicity warning if needed
      if (!samplingData.monotonic) {
        warnings.push('Sampling detected non-monotonic t(A) - results may be unreliable');
      }
      warnings.push(...samplingData.warnings);
    }
    
    // Add alternative results if both computed
    if (D_capillary && D_orifice && D_capillary !== D_orifice) {
      diagnostics.D_capillary = D_capillary;
      diagnostics.D_orifice = D_orifice;
    }
    
    // Isomorphic residual check: replay exact forward calculation
    let t_forward: number;
    let A_candidate = Math.PI * D * D / 4;
    
    try {
      // Use exact same physics as the original calculation
      if (validatedInputs.process === 'blowdown') {
        t_forward = orificeTfromD_blowdown({ ...validatedInputs, D });
      } else {
        t_forward = orificeTfromD_filling({ ...validatedInputs, D });
      }
      
      diagnostics.t_check = t_forward;
      
      // Calculate residual
      const residual = Math.abs(t_forward - validatedInputs.t!) / Math.max(validatedInputs.t!, 1e-9);
      const epsilon_verify = Math.max(validatedInputs.epsilon || 0.01, 0.01);
      
      if (residual > epsilon_verify) {
        // Try local refinement (±10% on A, 1-2 iterations)
        let bestA = A_candidate;
        let bestResidual = residual;
        let bestT = t_forward;
        
        const refinementSteps = [-0.1, 0.1, -0.05, 0.05]; // ±10%, ±5%
        
        for (let step of refinementSteps) {
          try {
            const testA = A_candidate * (1 + step);
            const testD = Math.sqrt(4 * testA / Math.PI);
            
            let testT: number;
            if (validatedInputs.process === 'blowdown') {
              testT = orificeTfromD_blowdown({ ...validatedInputs, D: testD });
            } else {
              testT = orificeTfromD_filling({ ...validatedInputs, D: testD });
            }
            
            const testResidual = Math.abs(testT - validatedInputs.t!) / Math.max(validatedInputs.t!, 1e-9);
            
            if (testResidual < bestResidual) {
              bestA = testA;
              bestResidual = testResidual;
              bestT = testT;
            }
          } catch (refineError) {
            // Skip this refinement step
            continue;
          }
        }
        
        // Update if refinement improved
        if (bestResidual < residual) {
          A_candidate = bestA;
          D = Math.sqrt(4 * A_candidate / Math.PI);
          t_forward = bestT;
          diagnostics.t_check = t_forward;
          console.info("🔧 Local refinement improved residual:", { 
            original: residual * 100, 
            refined: bestResidual * 100 
          });
        }
        
        // Final residual check after refinement
        const finalResidual = Math.abs(t_forward - validatedInputs.t!) / Math.max(validatedInputs.t!, 1e-9);
        
        if (finalResidual > epsilon_verify) {
          // Calculate correct choking information based on process
          let choking: any = {};
          if (validatedInputs.process === 'filling' && validatedInputs.Ps) {
            // Filling: use Pv/Ps (vessel pressure / supply pressure)
            const r_crit = criticalPressureRatio(validatedInputs.gas.gamma);
            const r = validatedInputs.P1 / validatedInputs.Ps; // Pv/Ps
            choking = { r_crit, choked: r < r_crit, r, ratio_type: 'Pv/Ps' };
          } else if (validatedInputs.process === 'blowdown') {
            // Blowdown: use P2/P1 (downstream/upstream)
            const r_crit = criticalPressureRatio(validatedInputs.gas.gamma);
            const r = validatedInputs.P2 / validatedInputs.P1; // P2/P1
            choking = { r_crit, choked: r < r_crit, r, ratio_type: 'P2/P1' };
          }

          // Build comprehensive devNote for residual rejection
          const devNote = {
            process: validatedInputs.process,
            model: verdict === 'orifice' ? 'orifice' : 'capillary',
            epsilon_used: epsilon_verify,
            residual: finalResidual,
            t_target_s: t_target_SI,
            t_forward: t_forward,
            A_candidate_SI_m2: A_candidate,
            D_candidate_SI_m: D,
            bounds_used: samplingData?.bracketInfo ? {
              A_lo: samplingData.bracketInfo.A_lo,
              A_hi: samplingData.bracketInfo.A_hi,
              D_lo: Math.sqrt(4 * samplingData.bracketInfo.A_lo / Math.PI),
              D_hi: Math.sqrt(4 * samplingData.bracketInfo.A_hi / Math.PI),
              expansions: samplingData.bracketInfo.expansions,
              bracketed: true
            } : {},
            choking,
            inputs_SI: {
              V_SI_m3: validatedInputs.V,
              T_K: validatedInputs.T,
              P1_Pa: validatedInputs.P1,
              P2_Pa: validatedInputs.P2,
              Ps_Pa: validatedInputs.Ps,
              L_SI_m: validatedInputs.L,
              gas: validatedInputs.gas,
              Cd: validatedInputs.Cd,
              regime: validatedInputs.regime
            },
            refinement_attempted: true,
            original_residual: residual,
            refined_residual: finalResidual
          };
          
          console.warn("🔴 Residual Check Failed (after refinement):", devNote);
          throw { message: "Result rejected by residual check", devNote };
        }
      }
    } catch (error) {
      if (error instanceof ResidualError) {
        throw error; // Re-throw residual errors
      }
      // Forward computation failed, but keep the result with warning
      warnings.push('Forward verification failed - result may be inaccurate');
      diagnostics.t_check = 'verification_failed';
    }
    
    const modelWarnings = generateWarnings(diagnostics, inputs);
    
    // Create explicit SI solver result
    const A_SI_m2 = D ? Math.PI * Math.pow(D, 2) / 4 : undefined;
    const t_SI_s = typeof diagnostics.t_check === 'number' ? diagnostics.t_check : undefined;
    
    const solverResultSI: SolverResultSI = {
      model: verdict === 'capillary' ? 'capillary' : 'orifice',
      A_SI_m2,
      D_SI_m: D,
      t_SI_s,
      diag: { ...diagnostics },
      warnings: [...warnings, ...modelWarnings]
    };
    
    return {
      D,
      verdict,
      diagnostics,
      warnings: [...warnings, ...modelWarnings],
      sampling: samplingData,
      solverResultSI,
    };
    
  } catch (error) {
    let computationError: ComputationError;
    
    if (error instanceof BracketError || error instanceof IntegralError || error instanceof ResidualError) {
      computationError = {
        type: error.type,
        message: error.message,
        details: error.details,
        suggestions: error.suggestions || []
      };
    } else if (typeof error === 'object' && error !== null && 'message' in error) {
      // Handle errors thrown with { message, devNote } format
      if ('devNote' in error) {
        computationError = {
          type: 'residual',
          message: error.message as string,
          details: error.devNote,
          suggestions: ['Check residual tolerance settings or try different model parameters']
        };
      } else {
        computationError = error as ComputationError;
      }
    } else {
      computationError = {
        type: 'model',
        message: (error as Error).message,
        suggestions: ['Check input parameters and model assumptions']
      };
    }
    
    return {
      verdict: 'inconclusive',
      diagnostics: { rationale: `Computation failed: ${computationError.message}` },
      warnings: [`Computation failed: ${computationError.message}`],
      error: computationError,
    };
  }
}

/**
 * Compute time from diameter
 * @param inputs Computation inputs
 * @returns Computation results
 */
export function computeTfromD(inputs: ComputeInputs): ComputeOutputs {
  try {
    let t_capillary: number | undefined;
    let t_orifice: number | undefined;
    const warnings: string[] = [];
    let capillary_error: string | undefined;
    let orifice_error: string | undefined;
    
    // 1) Compute t_cap via capillary model
    try {
      if (inputs.process === 'filling') {
        t_capillary = capillaryTfromD_filling(inputs);
      } else {
        t_capillary = capillaryTfromD_blowdown(inputs);
      }
    } catch (error) {
      capillary_error = `Capillary model failed: ${(error as Error).message}`;
    }
    
    // 2) Compute t_orif via orifice model
    try {
      if (inputs.process === 'blowdown') {
        t_orifice = orificeTfromD_blowdown(inputs);
      } else {
        t_orifice = orificeTfromD_filling(inputs);
      }
    } catch (error) {
      orifice_error = `Orifice model failed: ${(error as Error).message}`;
    }
    
    // 3) Validate model assumptions and choose the best
    let verdict: ComputeOutputs['verdict'] = 'inconclusive';
    let t: number | undefined;
    let rationale = '';
    
    // Check validity of each model with smart de-prioritization
    let cap_valid = false;
    let ori_valid = false;
    const diagnostics = calculateDiagnostics(inputs, inputs.D!);
    let capillary_deprioritized = false;
    
    if (t_capillary) {
      const Re = diagnostics.Re as number;
      const LoverD = diagnostics['L/D'] as number;
      
      // Smart de-prioritization: if L/D < 10 AND Re > 5000, de-prioritize capillary
      if (LoverD < 10 && Re > 5000) {
        capillary_deprioritized = true;
        cap_valid = false; // Force orifice selection
        warnings.push(`Capillary de-prioritized: L/D=${LoverD.toFixed(1)} < 10 and Re=${Math.round(Re)} > 5000. Orifice model automatically selected.`);
      } else {
        cap_valid = Re <= 2000 && LoverD >= 10;
      }
    }
    
    if (t_orifice) {
      ori_valid = true; // Orifice model is more generally applicable
    }
    
    // Check if model is forced via modelSelection
    const forcedModel = inputs.modelSelection;
    
    // Handle forced model selection first
    if (forcedModel) {
      if (forcedModel === 'capillary') {
        if (t_capillary !== undefined) {
          verdict = 'capillary';
          t = t_capillary;
          rationale = `Capillary model used (forced by user selection). Re=${Math.round(diagnostics.Re as number)}, L/D=${Math.round(diagnostics['L/D'] as number)}.`;
          
          // Still check validity for warnings
          if (!cap_valid || capillary_deprioritized) {
            warnings.push(`Warning: Capillary model may not be optimal for this case (Re=${Math.round(diagnostics.Re as number)}, L/D=${Math.round(diagnostics['L/D'] as number)})`);
          }
        } else {
          throw new Error(`Capillary model failed: ${capillary_error || 'No result computed'}`);
        }
      } else if (forcedModel === 'orifice') {
        if (t_orifice !== undefined) {
          verdict = 'orifice';
          t = t_orifice;
          rationale = `Orifice model used (forced by user selection). ${diagnostics.choked ? 'Choked' : 'Subsonic'} flow.`;
        } else {
          throw new Error(`Orifice model failed: ${orifice_error || 'No result computed'}`);
        }
      }
    } else if (cap_valid && ori_valid && !capillary_deprioritized) {
      // Both valid and capillary not de-prioritized - use forward simulation to pick best
      let cap_residual = Infinity;
      let ori_residual = Infinity;
      
      try {
        const cap_forward = inputs.process === 'blowdown' 
          ? capillaryDfromT_blowdown({ ...inputs, t: t_capillary })
          : capillaryDfromT_filling({ ...inputs, t: t_capillary });
        cap_residual = Math.abs((cap_forward - inputs.D!) / inputs.D!);
      } catch {}
      
      try {
        // Use iterative approach for orifice D from t
        let D_guess = 0.001;
        const tolerance = 1e-6;
        let iterations = 0;
        const maxIterations = 30;
        
        while (iterations < maxIterations) {
          const testInputs = { ...inputs, D: D_guess };
          let t_calc: number;
          
          if (inputs.process === 'blowdown') {
            t_calc = orificeTfromD_blowdown(testInputs);
          } else {
            t_calc = orificeTfromD_filling(testInputs);
          }
          
          const error = Math.abs((t_calc - t_orifice!) / t_orifice!);
          
          if (error < tolerance) {
            ori_residual = Math.abs((D_guess - inputs.D!) / inputs.D!);
            break;
          }
          
          D_guess *= Math.pow(t_orifice! / t_calc, 0.25);
          iterations++;
        }
      } catch {}
      
      if (cap_residual < ori_residual) {
        verdict = 'capillary';
        t = t_capillary;
        rationale = `Both models valid. Capillary chosen (lower residual: ${(cap_residual * 100).toFixed(3)}% vs ${(ori_residual * 100).toFixed(3)}%). Re=${Math.round(diagnostics.Re as number)}, L/D=${Math.round(diagnostics['L/D'] as number)}.`;
      } else {
        verdict = 'orifice';
        t = t_orifice;
        rationale = `Both models valid. Orifice chosen (lower residual: ${(ori_residual * 100).toFixed(3)}% vs ${(cap_residual * 100).toFixed(3)}%). ${diagnostics.choked ? 'Choked' : 'Subsonic'} flow.`;
      }
    } else if (cap_valid && !ori_valid && !capillary_deprioritized) {
      verdict = 'capillary';
      t = t_capillary;
      rationale = `Capillary model valid (Re=${Math.round(diagnostics.Re as number)}, L/D=${Math.round(diagnostics['L/D'] as number)}). Orifice model assumptions not met.`;
    } else if ((!cap_valid && ori_valid) || (capillary_deprioritized && ori_valid)) {
      verdict = 'orifice';
      t = t_orifice;
      if (capillary_deprioritized) {
        rationale = `Orifice model chosen (capillary de-prioritized due to L/D < 10 and Re > 5000). ${diagnostics.choked ? 'Choked' : 'Subsonic'} flow.`;
      } else {
        rationale = `Orifice model chosen. Capillary invalid (Re=${Math.round(diagnostics.Re as number)}, L/D=${Math.round(diagnostics['L/D'] as number)}). ${diagnostics.choked ? 'Choked' : 'Subsonic'} flow.`;
      }
    } else if (t_capillary && t_orifice) {
      verdict = 'both';
      t = t_orifice; // Default to orifice when both invalid
      rationale = `Neither model fully valid. Both results shown for comparison. Consider checking input parameters.`;
      warnings.push(`Capillary: Re=${Math.round(diagnostics.Re as number)} (need ≤2000), L/D=${Math.round(diagnostics['L/D'] as number)} (need ≥10)`);
    } else if (t_capillary) {
      verdict = 'capillary';
      t = t_capillary;
      rationale = `Only capillary model converged. ${cap_valid ? 'Valid' : 'Invalid'} assumptions.`;
    } else if (t_orifice) {
      verdict = 'orifice';
      t = t_orifice;
      rationale = `Only orifice model converged. ${diagnostics.choked ? 'Choked' : 'Subsonic'} flow.`;
    }
    
    if (!t) {
      throw new Error('No valid solution found');
    }
    
    // Add model-specific errors to warnings
    if (capillary_error) warnings.push(capillary_error);
    if (orifice_error) warnings.push(orifice_error);
    
    diagnostics.rationale = rationale;
    
    // Add alternative results if both computed
    if (t_capillary && t_orifice && t_capillary !== t_orifice) {
      diagnostics.t_capillary = t_capillary;
      diagnostics.t_orifice = t_orifice;
    }
    
    // Residual check: compute forward diameter with solved time
    let D_check: number;
    try {
      if (inputs.process === 'blowdown') {
        const capResult = capillaryDfromT_blowdown({ ...inputs, t });
        const oriResult = solveOrificeDfromT({ ...inputs, t });
        D_check = capResult || oriResult.D;
      } else {
        const capResult = capillaryDfromT_filling({ ...inputs, t });
        D_check = capResult;
      }
      
      const A_fromD = Math.PI * D_check * D_check / 4;
      const D_fromA = Math.sqrt(4 * A_fromD / Math.PI);
      
      diagnostics.D_check = D_fromA;
      
      // Adaptive tolerance for TfromD: filling mode is less stable numerically
      const baseTolerance = 0.02; // 2%  
      const tolerance = inputs.process === 'filling' ? baseTolerance * 2.5 : baseTolerance; // 5% for filling, 2% for blowdown
      const epsilon_used = Math.max(tolerance, 0.01);
      
      const residual = Math.abs(D_fromA - inputs.D!) / Math.max(inputs.D!, 1e-9);
      
      if (residual > tolerance) {
        // Calculate choking information
        let choking: any = {};
        if (inputs.process === 'filling' && inputs.Ps) {
          const r_crit = criticalPressureRatio(inputs.gas.gamma);
          const r = inputs.P1 / inputs.Ps;
          choking = { r_crit, choked: r <= r_crit, r };
        } else if (inputs.process === 'blowdown') {
          const r_crit = criticalPressureRatio(inputs.gas.gamma);
          const r = inputs.P2 / inputs.P1;
          choking = { r_crit, choked: r <= r_crit, r };
        }

        // Build exhaustive devNote for time-from-diameter residual check
        const devNote = {
          process: inputs.process,
          model: verdict === 'orifice' ? 'orifice' : 'capillary',
          epsilon_used,
          residual,
          t_target: t, // solved time
          t_forward: t, // same as target in TfromD case
          D_candidate_SI_m: inputs.D!,
          A_candidate_SI_m2: Math.PI * inputs.D! * inputs.D! / 4,
          bounds_used: {},
          choking,
          inputs_SI: {
            V_SI_m3: inputs.V,
            T_K: inputs.T,
            P1_Pa: inputs.P1,
            P2_Pa: inputs.P2,
            Ps_Pa: inputs.Ps,
            L_SI_m: inputs.L,
            gas: inputs.gas,
            Cd: inputs.Cd,
            regime: inputs.regime
          }
        };
        
        console.warn("🔴 Diameter Residual Check Failed:", devNote);
        throw { message: "Result rejected by residual check", devNote };
      } else if (residual > baseTolerance && inputs.process === 'filling') {
        // Log acceptable but elevated residual for filling mode
        console.info("⚠️ Elevated diameter residual accepted for filling mode:", { 
          residual: residual * 100, 
          tolerance: tolerance * 100 
        });
      }
    } catch (error) {
      if (error instanceof ResidualError) {
        throw error; // Re-throw residual errors
      }
      // Forward computation failed, but keep the result with warning
      warnings.push('Forward verification failed - result may be inaccurate');
      diagnostics.D_check = 'verification_failed';
    }
    
    const modelWarnings = generateWarnings(diagnostics, inputs);
    
    // Create explicit SI solver result
    const A_SI_m2 = typeof diagnostics.D_check === 'number' ? Math.PI * Math.pow(diagnostics.D_check as number, 2) / 4 : undefined;
    const D_SI_m = typeof diagnostics.D_check === 'number' ? diagnostics.D_check as number : undefined;
    
    const solverResultSI: SolverResultSI = {
      model: verdict === 'capillary' ? 'capillary' : 'orifice',
      A_SI_m2,
      D_SI_m,
      t_SI_s: t,
      diag: { ...diagnostics },
      warnings: [...warnings, ...modelWarnings]
    };
    
    return {
      t,
      verdict,
      diagnostics,
      warnings: [...warnings, ...modelWarnings],
      solverResultSI,
    };
    
  } catch (error) {
    let computationError: ComputationError;
    
    if (typeof error === 'object' && error !== null && 'message' in error) {
      // Handle errors thrown with { message, devNote } format
      if ('devNote' in error) {
        computationError = {
          type: 'residual',
          message: error.message as string,
          details: error.devNote,
          suggestions: ['Check residual tolerance settings or try different model parameters']
        };
      } else if ('type' in error) {
        computationError = error as ComputationError;
      } else {
        computationError = {
          type: 'model',
          message: error.message as string,
          suggestions: ['Check input parameters and model assumptions']
        };
      }
    } else {
      computationError = {
        type: 'model',
        message: (error as Error).message,
        suggestions: ['Check input parameters and model assumptions']
      };
    }
    
    return {
      verdict: 'inconclusive',
      diagnostics: { rationale: `Computation failed: ${computationError.message}` },
      warnings: [`Computation failed: ${computationError.message}`],
      error: computationError,
    };
  }
}

// ============= TIME FROM AREA HELPERS =============

/**
 * Capillary flow model - Time from diameter (blowdown)
 * @param inputs Computation inputs
 * @returns Computed time [s]
 */
function capillaryTfromD_blowdown(inputs: ComputeInputs): number {
  const { V, P1, P2, T, L, gas, D, epsilon = 0.01 } = inputs;
  const { mu } = gas;
  
  const Pf = P2 * (1 + epsilon);
  
  // Closed-form solution for capillary blowdown (derived from DfromT)
  const numerator = (P1 - P2) * (Pf + P2);
  const denominator = (P1 + P2) * (Pf - P2);
  
  if (numerator <= 0 || denominator <= 0) {
    throw new Error('Invalid pressure conditions for capillary blowdown');
  }
  
  const lnTerm = Math.log(numerator / denominator);
  const A = Math.PI * Math.pow(D!, 2) / 4;
  
  // t = (128 * mu * L * V * lnTerm) / (Pi * D^4 * P2)
  // t = (128 * mu * L * V * lnTerm) / (Pi * (4*A/Pi)^2 * P2)
  // t = (128 * mu * L * V * lnTerm) / (16 * A^2 / Pi * P2)
  // t = (128 * Pi * mu * L * V * lnTerm) / (16 * A^2 * P2)
  // t = (8 * Pi * mu * L * V * lnTerm) / (A^2 * P2)
  
  return (8 * Math.PI * mu * L * V * lnTerm) / (A * A * P2);
}

/**
 * Returns time [s] for current inputs and area A [m²] using orifice model
 * Direct formula implementation as expected by pipeline
 * @param SI Object with SI units and gas properties  
 * @param A_SI_m2 Cross-sectional area [m²]
 * @returns Time [s]
 */
export function timeOrificeFromAreaSI(SI:any, A_SI:number){
  const { V_SI_m3:V, P1_Pa:P1, P2_Pa:P2, T_K:T, gas:{R,gamma}, Cd=0.62, epsilon=0.01 } = SI;
  const I = orificeIsothermalIntegral(P1, P2, T, gamma, R, epsilon);  // même intégrale que l'inverse
  return (V / (R * T * Cd * A_SI)) * I.I;                               // Cd au dénominateur, UNE fois
}

/**
 * Legacy wrapper for backward compatibility
 * @param inputs Computation inputs (NOT mutated)
 * @param A_SI_m2 Cross-sectional area [m²]
 * @returns Time [s]
 */
export function timeOrificeFromAreaSI_legacy(inputs: ComputeInputs, A_SI_m2: number): number {
  // Create a copy of inputs with computed diameter from area
  const D = Math.sqrt(4 * A_SI_m2 / Math.PI);
  const inputsCopy: ComputeInputs = { ...inputs, D };
  
  if (inputs.process === 'blowdown') {
    return orificeTfromD_blowdown(inputsCopy);
  } else {
    return orificeTfromD_filling(inputsCopy);
  }
}

/**
 * Returns time [s] for current inputs and area A [m²] using capillary model
 * Direct formula implementation as expected by pipeline
 * @param SI Object with SI units and gas properties  
 * @param A_SI Cross-sectional area [m²]
 * @returns Time [s]
 */
export function timeCapillaryFromAreaSI(SI: any, A_SI: number): number {
  // Use the validated version and extract the time value
  const result = timeCapillaryFromAreaSI_validated(SI, A_SI);
  return result.t_SI_s;
}

/**
 * Legacy wrapper for backward compatibility
 * @param inputs Computation inputs (NOT mutated)
 * @param A_SI_m2 Cross-sectional area [m²]
 * @returns Time [s]
 */
export function timeCapillaryFromAreaSI_legacy(inputs: ComputeInputs, A_SI_m2: number): number {
  // Create a copy of inputs with computed diameter from area
  const D = Math.sqrt(4 * A_SI_m2 / Math.PI);
  const inputsCopy: ComputeInputs = { ...inputs, D };
  
  if (inputs.process === 'blowdown') {
    return capillaryTfromD_blowdown(inputsCopy);
  } else {
    return capillaryTfromD_filling(inputsCopy);
  }
}

// ============= TIME-AREA SAMPLER =============

export type TASample = { 
  A_m2: number; 
  D_m: number; 
  t_s: number; 
  choked: boolean; 
  phase: 'sonic'|'sub'|'mixed' 
};

export type TASampler = { 
  model: 'orifice'|'capillary'; 
  samples: TASample[]; 
  bracket?: { 
    A_lo: number; 
    A_hi: number; 
    t_lo: number; 
    t_hi: number; 
    expansions: number 
  } 
};

/**
 * Sample time vs area relationship for a given model
 * @param inputs Computation inputs (NOT mutated)
 * @param model Flow model to use
 * @param n Number of samples (default 5)
 * @param A_lo Lower area bound [m²] (default 1e-12)
 * @param A_hi Upper area bound [m²] (default 1e-8)
 * @returns TASampler with log-spaced samples
 */
export function sample_tA(
  inputs: ComputeInputs, 
  model: 'orifice'|'capillary', 
  n = 5, 
  A_lo = 1e-12, 
  A_hi = 1e-8
): TASampler {
  // Log-spaced grid on [A_lo, A_hi]
  const g = (i: number) => Math.exp(Math.log(A_lo) + (Math.log(A_hi) - Math.log(A_lo)) * (i / (n - 1)));
  const out: TASample[] = [];
  
  // Capture bracket information for orifice model
  let bracket: TASampler['bracket'] | undefined;
  
  if (model === 'orifice' && inputs.t) {
    // Try to determine what bracket would be used for this target time
    try {
      const t_target = inputs.t;
      let bracket_A_lo = A_lo;
      let bracket_A_hi = A_hi;
      let expansions = 0;
      
      // Simulate the bracketing process
      const objectiveFunction = (A: number): number => {
        try {
          const t_calc = timeOrificeFromAreaSI_legacy(inputs, A);
          return t_calc - t_target;
        } catch {
          return NaN;
        }
      };
      
      // Try to find a valid bracket within the sampling range
      const maxExpansions = 8; // Reduced for sampling
      while (expansions < maxExpansions) {
        try {
          const f_lo = objectiveFunction(bracket_A_lo);
          const f_hi = objectiveFunction(bracket_A_hi);
          
          if (!isNaN(f_lo) && !isNaN(f_hi) && f_lo * f_hi < 0) {
            // We have a valid bracket
            const t_lo = timeOrificeFromAreaSI_legacy(inputs, bracket_A_lo);
            const t_hi = timeOrificeFromAreaSI_legacy(inputs, bracket_A_hi);
            
            bracket = {
              A_lo: bracket_A_lo,
              A_hi: bracket_A_hi,
              t_lo,
              t_hi,
              expansions
            };
            break;
          }
          
          // Expand bracket
          if (isNaN(f_lo) || f_lo < 0) {
            bracket_A_lo /= 10;
          }
          if (isNaN(f_hi) || f_hi > 0) {
            bracket_A_hi *= 10;
          }
          
          expansions++;
        } catch {
          // If evaluation fails, try expanding
          bracket_A_lo /= 10;
          bracket_A_hi *= 10;
          expansions++;
        }
      }
    } catch {
      // Bracket detection failed, continue without bracket info
    }
  }
  
  for (let i = 0; i < n; i++) {
    const A = g(i);
    const D = Math.sqrt(4 * A / Math.PI);
    let t = NaN, choked = false, phase: 'sonic'|'sub'|'mixed' = 'sub';
    
    try {
      if (model === 'orifice') {
        t = timeOrificeFromAreaSI_legacy(inputs, A);
        
        // Get choked/phase info from diagnostics
        const inputsCopy = { ...inputs, D };
        const diagnostics = calculateDiagnostics(inputsCopy, D);
        choked = diagnostics.choked as boolean || false;
        
        // Determine phase based on flow conditions
        if (choked) {
          const { P1, P2, gas } = inputs;
          const rc = criticalRatio(gas.gamma);
          const Pstar = inputs.process === 'blowdown' ? P2 / rc : rc * (inputs.Ps || P1);
          
          if (inputs.process === 'blowdown') {
            phase = P1 > Pstar ? 'mixed' : 'sonic';
          } else {
            phase = P1 < Pstar ? 'mixed' : 'sonic';
          }
        } else {
          phase = 'sub';
        }
      } else {
        t = timeCapillaryFromAreaSI_legacy(inputs, A);
        // Capillary flow is typically subsonic/laminar
        choked = false;
        phase = 'sub';
      }
    } catch (error) {
      // Keep NaN for failed computations
      t = NaN;
    }
    
    out.push({ A_m2: A, D_m: D, t_s: t, choked, phase });
  }
  
  return { model, samples: out, bracket };
}