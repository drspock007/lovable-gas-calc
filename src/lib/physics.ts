/**
 * Gas Transfer Physics Calculations for Rigid Vessels
 * All units in SI: pressures in Pa (absolute), volumes in m³, temperatures in K, etc.
 * @fileoverview Complete implementation of capillary and orifice flow models
 */

import { brent } from './rootfind';

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
  
  const Pf = P2 * (1 - epsilon);
  
  const numerator = (Ps - P1) * (Pf + Ps);
  const denominator = (Ps + P1) * (Pf - Ps);
  
  if (numerator <= 0 || denominator <= 0) {
    throw new Error('Invalid pressure conditions for capillary filling');
  }
  
  const lnTerm = Math.log(numerator / denominator);
  const D4 = (128 * mu * L * V * lnTerm) / (Math.PI * t! * Ps);
  
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
function solveOrificeDfromT(inputs: ComputeInputs): number {
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
        A_hi *= 10;
      }
      
      expansions++;
    } catch (error) {
      // If evaluation fails, try expanding
      A_lo /= 10;
      A_hi *= 10;
      expansions++;
    }
  }
  
  if (expansions >= maxExpansions) {
    throw new BracketError(
      `Solver could not bracket the solution after ${maxExpansions} expansions`,
      { A_lo, A_hi, expansions, t_target }
    );
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
  
  return D;
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
  
  // Try cached bracket first, then expand
  const cachedBracket = loadBracketFromCache(inputs.process, gasName);
  let A_lo: number, A_hi: number;
  
  if (cachedBracket) {
    [A_lo, A_hi] = cachedBracket;
    // Apply expansion factor to cached bracket
    A_lo = A_lo / Math.pow(expandFactor, 2);
    A_hi = A_hi * Math.pow(expandFactor, 2);
  } else {
    // Expanded initial bracket
    A_lo = 1e-12 / Math.pow(expandFactor, 2); // Divide A_lo by expandFactor^2
    A_hi = 1e-2 * Math.pow(expandFactor, 2);  // Multiply A_hi by expandFactor^2
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
        A_hi *= 10;
      }
      
      expansions++;
    } catch (error) {
      // If evaluation fails, try expanding
      A_lo /= 10;
      A_hi *= 10;
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
    let D_capillary: number | undefined;
    let D_orifice: number | undefined;
    const warnings: string[] = [];
    let capillary_error: string | undefined;
    let orifice_error: string | undefined;
    
    // 1) Compute D_cap via capillary model
    try {
      if (inputs.process === 'blowdown') {
        D_capillary = capillaryDfromT_blowdown(inputs);
      } else {
        D_capillary = capillaryDfromT_filling(inputs);
      }
    } catch (error) {
      capillary_error = `Capillary model failed: ${(error as Error).message}`;
    }
    
    // 2) Compute D_orif via orifice model (robust root finding)
    try {
      D_orifice = solveOrificeDfromT(inputs);
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
    }
    
    if (cap_valid && ori_valid && !capillary_deprioritized) {
      // Both valid and capillary not de-prioritized - use forward simulation to pick best
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
    } else if (cap_valid && !ori_valid && !capillary_deprioritized) {
      verdict = 'capillary';
      D = D_capillary;
      rationale = `Capillary model valid (Re=${Math.round(cap_diagnostics.Re as number)}, L/D=${Math.round(cap_diagnostics['L/D'] as number)}). Orifice model assumptions not met.`;
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
    
    // Add alternative results if both computed
    if (D_capillary && D_orifice && D_capillary !== D_orifice) {
      diagnostics.D_capillary = D_capillary;
      diagnostics.D_orifice = D_orifice;
    }
    
    // Residual check: compute forward time with solved diameter
    let t_check: number;
    try {
      if (inputs.process === 'blowdown') {
        t_check = orificeTfromD_blowdown({ ...inputs, D });
      } else {
        t_check = orificeTfromD_filling({ ...inputs, D });
      }
      
      diagnostics.t_check = t_check;
      
      // Check if residual is within 2% tolerance
      const residualError = Math.abs(t_check - inputs.t!) / inputs.t!;
      if (residualError > 0.02) {
        throw new ResidualError(
          `Result rejected by residual check (${(residualError * 100).toFixed(1)}% error)`,
          t_check,
          inputs.t!,
          { residualError, verdict, D }
        );
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
    
    return {
      D,
      verdict,
      diagnostics,
      warnings: [...warnings, ...modelWarnings],
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
    } else if (typeof error === 'object' && error !== null && 'type' in error) {
      computationError = error as ComputationError;
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
        capillary_error = 'Capillary blowdown time calculation not implemented';
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
    
    if (cap_valid && ori_valid && !capillary_deprioritized) {
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
        D_check = capillaryDfromT_blowdown({ ...inputs, t }) || solveOrificeDfromT({ ...inputs, t });
      } else {
        D_check = capillaryDfromT_filling({ ...inputs, t }) || solveOrificeDfromT({ ...inputs, t });
      }
      
      // Convert to area and back to check consistency
      const A_check = Math.PI * Math.pow(D_check, 2) / 4;
      const D_fromA = Math.sqrt(4 * A_check / Math.PI);
      diagnostics.D_check = D_fromA;
      
      // For TfromD, we check diameter consistency (conceptually similar to time check)
      const residualError = Math.abs(D_fromA - inputs.D!) / inputs.D!;
      if (residualError > 0.02) {
        throw new ResidualError(
          `Result rejected by residual check (${(residualError * 100).toFixed(1)}% error)`,
          t, // Use solved time as t_check for consistency
          inputs.D!, // But check against target diameter
          { residualError, verdict, t, D_check: D_fromA }
        );
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
    
    return {
      t,
      verdict,
      diagnostics,
      warnings: [...warnings, ...modelWarnings],
    };
    
  } catch (error) {
    let computationError: ComputationError;
    
    if (typeof error === 'object' && error !== null && 'type' in error) {
      computationError = error as ComputationError;
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