/**
 * Mathematical utilities for physics calculations
 */

/**
 * Clamp value between bounds
 */
export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Positive value protection
 */
export function pos(x: number): number {
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
export function criticalRatio(g: number): number {
  return Math.pow(2 / (g + 1), g / (g - 1));
}

/**
 * Sonic velocity coefficient C*
 * @param g Heat capacity ratio [-]
 * @param R Specific gas constant [J/(kg·K)]
 * @param T Temperature [K]
 * @returns C* coefficient [kg/(m²·s·Pa)]
 */
export function Cstar(g: number, R: number, T: number): number {
  return Math.sqrt(g / (R * T)) * Math.pow(2 / (g + 1), (g + 1) / (2 * (g - 1)));
}

/**
 * Subsonic flow coefficient K
 * @param g Heat capacity ratio [-]
 * @param R Specific gas constant [J/(kg·K)]
 * @param T Temperature [K]
 * @returns K coefficient [kg/(m²·s·Pa)]
 */
export function K(g: number, R: number, T: number): number {
  return Math.sqrt(2 * g / (R * T * (g - 1)));
}

/**
 * Calculate sonic flow coefficient (legacy)
 * @param gamma Heat capacity ratio [-]
 * @param R Specific gas constant [J/(kg·K)]
 * @param T Temperature [K]
 * @returns Sonic flow coefficient [m/s]
 */
export function sonicFlowCoeff(gamma: number, R: number, T: number): number {
  return Math.sqrt(gamma / (R * T)) * Math.pow(2 / (gamma + 1), (gamma + 1) / (2 * (gamma - 1)));
}

/**
 * Calculate subsonic flow coefficient (legacy)
 * @param gamma Heat capacity ratio [-]
 * @param R Specific gas constant [J/(kg·K)]
 * @param T Temperature [K]
 * @returns Subsonic flow coefficient [m/s]
 */
export function subsonicFlowCoeff(gamma: number, R: number, T: number): number {
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
export function reynoldsNumber(rho: number, v: number, D: number, mu: number): number {
  return (rho * v * D) / mu;
}

/**
 * Calculate density from ideal gas law
 * @param P Pressure [Pa]
 * @param R Specific gas constant [J/(kg·K)]
 * @param T Temperature [K]
 * @returns Density [kg/m³]
 */
export function gasDensity(P: number, R: number, T: number): number {
  return P / (R * T);
}

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
export function adaptiveSimpson(
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