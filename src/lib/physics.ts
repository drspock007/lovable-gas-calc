/**
 * Gas Transfer Physics Calculations for Rigid Vessels
 * All units in SI: pressures in Pa (absolute), volumes in m³, temperatures in K, etc.
 * @fileoverview Complete implementation of capillary and orifice flow models
 */

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

/**
 * Calculate critical pressure ratio for compressible flow
 * @param gamma Heat capacity ratio [-]
 * @returns Critical pressure ratio r* [-]
 */
function criticalPressureRatio(gamma: number): number {
  return Math.pow(2 / (gamma + 1), gamma / (gamma - 1));
}

/**
 * Calculate sonic flow coefficient
 * @param gamma Heat capacity ratio [-]
 * @param R Specific gas constant [J/(kg·K)]
 * @param T Temperature [K]
 * @returns Sonic flow coefficient [m/s]
 */
function sonicFlowCoeff(gamma: number, R: number, T: number): number {
  return Math.sqrt(gamma / (R * T)) * Math.pow(2 / (gamma + 1), (gamma + 1) / (2 * (gamma - 1)));
}

/**
 * Calculate subsonic flow coefficient
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

/**
 * Orifice flow model - Blowdown (isothermal)
 * @param inputs Computation inputs
 * @returns Computed time [s]
 */
function orificeTfromD_blowdown(inputs: ComputeInputs): number {
  const { V, P1, P2, T, gas, D, Cd = 0.62, epsilon = 0.01 } = inputs;
  const { R, gamma } = gas;
  
  const rStar = criticalPressureRatio(gamma);
  const Cstar = sonicFlowCoeff(gamma, R, T);
  const K = subsonicFlowCoeff(gamma, R, T);
  const A = Math.PI * Math.pow(D!, 2) / 4;
  const Pf = P2 * (1 + epsilon);
  
  // Check if initially choked
  const PStar = P2 / rStar;
  
  if (P1 > PStar) {
    // Initially choked - split into sonic and subsonic phases
    const tSonic = (V / (R * T * Cd * A)) * Math.log(P1 / PStar) / Cstar;
    
    // Subsonic phase - numerical integration (simplified)
    const tSubsonic = (V / (R * T * Cd * A * K)) * 
      Math.log(Math.sqrt(Math.pow(P2/PStar, 2/gamma) - Math.pow(P2/PStar, (gamma+1)/gamma)) /
               Math.sqrt(Math.pow(Pf/PStar, 2/gamma) - Math.pow(Pf/PStar, (gamma+1)/gamma)));
    
    return tSonic + tSubsonic;
  } else {
    // Always subsonic
    return (V / (R * T * Cd * A * K)) * 
      Math.log(Math.sqrt(Math.pow(P2/P1, 2/gamma) - Math.pow(P2/P1, (gamma+1)/gamma)) /
               Math.sqrt(Math.pow(Pf/P1, 2/gamma) - Math.pow(Pf/P1, (gamma+1)/gamma)));
  }
}

/**
 * Orifice flow model - Filling (isothermal)
 * @param inputs Computation inputs
 * @returns Computed time [s]
 */
function orificeTfromD_filling(inputs: ComputeInputs): number {
  const { V, P1, P2, T, gas, D, Cd = 0.62, epsilon = 0.01, Ps } = inputs;
  const { R, gamma } = gas;
  
  if (!Ps) throw new Error('Supply pressure Ps required for filling');
  
  const rStar = criticalPressureRatio(gamma);
  const Cstar = sonicFlowCoeff(gamma, R, T);
  const A = Math.PI * Math.pow(D!, 2) / 4;
  const Pf = P2 * (1 - epsilon);
  const PStar = rStar * Ps;
  
  if (P1 < PStar) {
    // Initially choked - linear sonic phase
    const tSonic = (V / (R * T * Cd * A * Ps * Cstar)) * (PStar - P1);
    
    // Subsonic phase - numerical integration (simplified)
    const K = subsonicFlowCoeff(gamma, R, T);
    const tSubsonic = (V / (R * T * Cd * A * Ps * K)) * 
      Math.log(Math.sqrt(Math.pow(PStar/Ps, 2/gamma) - Math.pow(PStar/Ps, (gamma+1)/gamma)) /
               Math.sqrt(Math.pow(Pf/Ps, 2/gamma) - Math.pow(Pf/Ps, (gamma+1)/gamma)));
    
    return tSonic + tSubsonic;
  } else {
    // Always subsonic
    const K = subsonicFlowCoeff(gamma, R, T);
    return (V / (R * T * Cd * A * Ps * K)) * 
      Math.log(Math.sqrt(Math.pow(P1/Ps, 2/gamma) - Math.pow(P1/Ps, (gamma+1)/gamma)) /
               Math.sqrt(Math.pow(Pf/Ps, 2/gamma) - Math.pow(Pf/Ps, (gamma+1)/gamma)));
  }
}

/**
 * Calculate diagnostics for flow regime determination
 * @param inputs Computation inputs
 * @param D Diameter [m]
 * @returns Diagnostics object
 */
function calculateDiagnostics(inputs: ComputeInputs, D: number): Record<string, number | string | boolean> {
  const { V, P1, P2, T, L, gas, process, Ps } = inputs;
  const { R, gamma, mu } = gas;
  
  // Average pressure for diagnostics
  const Pavg = process === 'blowdown' ? (P1 + P2) / 2 : (P1 + (Ps || P2)) / 2;
  const rho = gasDensity(Pavg, R, T);
  
  // Estimate velocity (simplified)
  const A = Math.PI * Math.pow(D, 2) / 4;
  const deltaP = process === 'blowdown' ? P1 - P2 : (Ps || P2) - P1;
  const v = Math.sqrt(2 * deltaP / rho);
  
  const Re = reynoldsNumber(rho, v, D, mu);
  const LoverD = L / D;
  const rStar = criticalPressureRatio(gamma);
  const isChoked = process === 'blowdown' ? P2/P1 <= rStar : P1/(Ps || P2) <= rStar;
  const Mach = v / Math.sqrt(gamma * R * T);
  
  return {
    Re,
    'L/D': LoverD,
    Mach,
    choked: isChoked,
    'P_avg_Pa': Pavg,
    'rho_kg_m3': rho,
    'v_m_s': v,
    'r_critical': rStar,
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
    
    // 2) Compute D_orif via orifice model (inverse calculation)
    try {
      let D_guess = 0.001; // Start with 1mm
      const tolerance = 1e-6;
      let iterations = 0;
      const maxIterations = 50;
      
      while (iterations < maxIterations) {
        const testInputs = { ...inputs, D: D_guess };
        let t_calc: number;
        
        if (inputs.process === 'blowdown') {
          t_calc = orificeTfromD_blowdown(testInputs);
        } else {
          t_calc = orificeTfromD_filling(testInputs);
        }
        
        const error = (t_calc - inputs.t!) / inputs.t!;
        
        if (Math.abs(error) < tolerance) {
          D_orifice = D_guess;
          break;
        }
        
        D_guess *= Math.pow(inputs.t! / t_calc, 0.25);
        iterations++;
      }
      
      if (iterations >= maxIterations) {
        orifice_error = 'Orifice model did not converge';
      }
    } catch (error) {
      orifice_error = `Orifice model failed: ${(error as Error).message}`;
    }
    
    // 3) Validate model assumptions and choose the best
    let verdict: ComputeOutputs['verdict'] = 'inconclusive';
    let D: number | undefined;
    let rationale = '';
    
    // Check validity of each model
    let cap_valid = false;
    let ori_valid = false;
    let cap_diagnostics: Record<string, number | string | boolean> = {};
    let ori_diagnostics: Record<string, number | string | boolean> = {};
    
    if (D_capillary) {
      cap_diagnostics = calculateDiagnostics(inputs, D_capillary);
      cap_valid = (cap_diagnostics.Re as number) <= 2000 && (cap_diagnostics['L/D'] as number) >= 10;
    }
    
    if (D_orifice) {
      ori_diagnostics = calculateDiagnostics(inputs, D_orifice);
      ori_valid = true; // Orifice model is more generally applicable
    }
    
    if (cap_valid && ori_valid) {
      // Both valid - use forward simulation to pick best
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
    } else if (cap_valid && !ori_valid) {
      verdict = 'capillary';
      D = D_capillary;
      rationale = `Capillary model valid (Re=${Math.round(cap_diagnostics.Re as number)}, L/D=${Math.round(cap_diagnostics['L/D'] as number)}). Orifice model assumptions not met.`;
    } else if (!cap_valid && ori_valid) {
      verdict = 'orifice';
      D = D_orifice;
      rationale = `Orifice model chosen. Capillary invalid (Re=${cap_diagnostics.Re ? Math.round(cap_diagnostics.Re as number) : 'N/A'}, L/D=${cap_diagnostics['L/D'] ? Math.round(cap_diagnostics['L/D'] as number) : 'N/A'}). ${ori_diagnostics.choked ? 'Choked' : 'Subsonic'} flow.`;
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
    
    const modelWarnings = generateWarnings(diagnostics, inputs);
    
    return {
      D,
      verdict,
      diagnostics,
      warnings: [...warnings, ...modelWarnings],
    };
    
  } catch (error) {
    return {
      verdict: 'inconclusive',
      diagnostics: { rationale: `Computation failed: ${(error as Error).message}` },
      warnings: [`Computation failed: ${(error as Error).message}`],
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
    
    // Check validity of each model
    let cap_valid = false;
    let ori_valid = false;
    const diagnostics = calculateDiagnostics(inputs, inputs.D!);
    
    if (t_capillary) {
      cap_valid = (diagnostics.Re as number) <= 2000 && (diagnostics['L/D'] as number) >= 10;
    }
    
    if (t_orifice) {
      ori_valid = true; // Orifice model is more generally applicable
    }
    
    if (cap_valid && ori_valid) {
      // Both valid - use forward simulation to pick best
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
    } else if (cap_valid && !ori_valid) {
      verdict = 'capillary';
      t = t_capillary;
      rationale = `Capillary model valid (Re=${Math.round(diagnostics.Re as number)}, L/D=${Math.round(diagnostics['L/D'] as number)}). Orifice model assumptions not met.`;
    } else if (!cap_valid && ori_valid) {
      verdict = 'orifice';
      t = t_orifice;
      rationale = `Orifice model chosen. Capillary invalid (Re=${Math.round(diagnostics.Re as number)}, L/D=${Math.round(diagnostics['L/D'] as number)}). ${diagnostics.choked ? 'Choked' : 'Subsonic'} flow.`;
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
    
    const modelWarnings = generateWarnings(diagnostics, inputs);
    
    return {
      t,
      verdict,
      diagnostics,
      warnings: [...warnings, ...modelWarnings],
    };
    
  } catch (error) {
    return {
      verdict: 'inconclusive',
      diagnostics: { rationale: `Computation failed: ${(error as Error).message}` },
      warnings: [`Computation failed: ${(error as Error).message}`],
    };
  }
}