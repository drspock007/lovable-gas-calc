/**
 * Standardized wrappers for key physics functions
 * Provides clean interfaces with exact naming as requested
 */

import { buildSI, buildAbsoluteSIFromUI } from '@/lib/build-si';
import { orificeTfromD_filling, orificeTfromD_blowdown } from '@/lib/physics/orifice';
import { solveOrificeDfromT } from '@/lib/physics/orifice-solvers';
import type { ComputeInputs } from '@/lib/physics/types';

// Re-export buildSI for standardized access
export { buildSI };

/**
 * Forward Filling orifice: calculate time from SI inputs and area
 * @param SI SI units object with P1_Pa, Pf_Pa, Ps_Pa, T_K, V_SI_m3, gas, etc.
 * @param A Area in m²
 * @returns Time in seconds
 */
export function timeOrificeFillingFromAreaSI(SI: any, A: number): number {
  const D = Math.sqrt(4 * A / Math.PI);
  
  const inputs: ComputeInputs = {
    process: 'filling',
    solveFor: 'TfromD',
    V: SI.V_SI_m3,
    P1: SI.P1_Pa,
    P2: SI.Pf_Pa || SI.P2_Pa, // Target pressure
    T: SI.T_K,
    L: SI.L_SI_m,
    gas: SI.gas,
    D,
    Cd: SI.Cd || 0.62,
    epsilon: SI.epsilon || 0.01,
    regime: SI.regime || 'isothermal',
    Ps: SI.Ps_Pa // Supply pressure required for filling
  };
  
  return orificeTfromD_filling(inputs);
}

/**
 * Inverse Filling D-from-t: calculate diameter from SI inputs and target time
 * Enhanced with robust parsing, intelligent bracketing, and boundary protection
 * @param SI SI units object with P1_Pa, Pf_Pa, Ps_Pa, T_K, V_SI_m3, gas, etc.
 * @param t_target Target time in seconds OR values object with time field
 * @returns Object with A_SI, D_SI, t_fwd, residual, debugNote
 */
export function diameterFromTime_Filling(SI: any, t_target: number | any): any {
  // 1) Parse robuste du temps cible
  let t_target_s: number;
  let t_raw: any, t_unit: string;
  
  if (typeof t_target === 'number') {
    // Direct number input (legacy)
    t_target_s = t_target;
    t_raw = t_target;
    t_unit = "s";
  } else {
    // Parse from values object
    t_raw = t_target?.time?.value ?? t_target?.t?.value ?? t_target?.time ?? t_target;
    t_unit = t_target?.time?.unit ?? t_target?.t?.unit ?? "s";
    
    // Convert to SI using basic conversion (assuming s, min, h)
    const numValue = Number(String(t_raw ?? "0").replace(",", "."));
    switch (t_unit) {
      case "min": t_target_s = numValue * 60; break;
      case "h": t_target_s = numValue * 3600; break;
      case "ms": t_target_s = numValue / 1000; break;
      default: t_target_s = numValue; // assume seconds
    }
  }
  
  if (!Number.isFinite(t_target_s) || t_target_s <= 0) {
    throw { 
      message: "Invalid target time", 
      devNote: { t_raw, t_unit, t_target_s, error: "Non-finite or ≤0" } 
    };
  }

  // 2) Bracket intelligent avec contraintes physiques
  const D_eq = Math.pow(6 * SI.V_SI_m3 / Math.PI, 1/3); // Equivalent diameter
  const k = 2; // Safety factor
  let A_lo = 1e-12; // Very small area
  let A_hi = Math.PI / 4 * Math.pow(k * D_eq, 2); // Physical constraint
  
  let expansions = 0;
  const maxExpansions = 4;
  
  while (expansions < maxExpansions) {
    try {
      // Calculate times at bracket endpoints
      const t_lo = timeOrificeFillingFromAreaSI(SI, A_lo);
      const t_hi = timeOrificeFillingFromAreaSI(SI, A_hi);
      
      // Check for non-finite times
      if (!Number.isFinite(t_lo) || !Number.isFinite(t_hi)) {
        throw { 
          message: "Non-finite bracket times", 
          devNote: { 
            reason: "non-finite bracket times",
            t_lo, t_hi, A_lo, A_hi, expansions
          } 
        };
      }
      
      // Ensure correct monotonic order: t_lo >= t_hi (time decreases with area)
      if (t_lo < t_hi) {
        [A_lo, A_hi] = [A_hi, A_lo];
        console.log(`🔄 Swapped bounds: A_lo=${A_lo.toExponential(3)}, A_hi=${A_hi.toExponential(3)}`);
      }
      
      // Recalculate after potential swap
      const t_lo_final = timeOrificeFillingFromAreaSI(SI, A_lo);
      const t_hi_final = timeOrificeFillingFromAreaSI(SI, A_hi);
      
      // Check inclusion: t_hi <= t_target <= t_lo (monotone decreasing)
      const inside = (t_hi_final <= t_target_s && t_target_s <= t_lo_final);
      
      if (!inside) {
        // Auto-expand bounds
        A_lo /= 10; // Smaller A -> larger time
        A_hi = Math.min(A_hi * 10, Math.PI / 4 * Math.pow((k + expansions) * D_eq, 2));
        expansions++;
        console.log(`🔍 Expansion ${expansions}: t_target=${t_target_s}s not in [${t_hi_final}s, ${t_lo_final}s]`);
      } else {
        console.log(`✅ Target time ${t_target_s}s included in bracket [${t_hi_final}s, ${t_lo_final}s]`);
        break;
      }
    } catch (error) {
      // If evaluation fails, expand and retry
      A_lo /= 10;
      A_hi = Math.min(A_hi * 10, Math.PI / 4 * Math.pow((k + expansions) * D_eq, 2));
      expansions++;
      console.log(`⚠️ Bracket evaluation failed, expansion ${expansions}`);
    }
  }
  
  if (expansions >= maxExpansions) {
    // Final check for precise diagnostic
    const t_lo_final = timeOrificeFillingFromAreaSI(SI, A_lo);
    const t_hi_final = timeOrificeFillingFromAreaSI(SI, A_hi);
    
    throw { 
      message: "Target time out of bracket", 
      devNote: { 
        reason: "Target time out of bracket",
        t_target_s, 
        t_lo: t_lo_final, 
        t_hi: t_hi_final, 
        A_lo, 
        A_hi, 
        expansions 
      } 
    };
  }

  // 3) Recherche par bissection avec protection des bornes
  let iterations = 0;
  const maxIterations = 100;
  const epsilon_threshold = Math.max(SI.epsilon || 0.01, 0.01);
  
  while (iterations < maxIterations) {
    const A_mid = Math.sqrt(A_lo * A_hi); // Geometric mean for log-spaced search
    const t_mid = timeOrificeFillingFromAreaSI(SI, A_mid);
    
    // Check convergence
    const residual_time = Math.abs(t_mid - t_target_s) / Math.max(t_target_s, 1e-9);
    if (residual_time <= epsilon_threshold) {
      // Check if we're at a boundary (boundary protection)
      const boundaryTolerance = 1e-8;
      const isAtLowerBound = Math.abs(A_mid - A_lo) < boundaryTolerance;
      const isAtUpperBound = Math.abs(A_mid - A_hi) < boundaryTolerance;
      
      if (isAtLowerBound || isAtUpperBound) {
        throw { 
          message: "Hit bracket bound", 
          devNote: { 
            reason: "Hit bracket bound (no root inside)",
            A_lo, A_hi, 
            t_lo: timeOrificeFillingFromAreaSI(SI, A_lo), 
            t_hi: timeOrificeFillingFromAreaSI(SI, A_hi), 
            t_target_s,
            boundary_hit: isAtLowerBound ? 'lower' : 'upper',
            A_solution: A_mid,
            residual_time
          } 
        };
      }
      
      // 4) Vérification forward avec même fonction Filling
      const t_fwd = timeOrificeFillingFromAreaSI(SI, A_mid);
      const residual = Math.abs(t_fwd - t_target_s) / Math.max(t_target_s, 1e-9);
      
      if (residual > epsilon_threshold) {
        throw { 
          message: "Result rejected by residual check", 
          devNote: { 
            reason: "Result rejected by residual check",
            residual, 
            t_fwd, 
            t_target_s, 
            bounds: { A_lo, A_hi },
            epsilon_used: epsilon_threshold
          } 
        };
      }
      
      // 5) Success - return complete result
      const D_SI = Math.sqrt(4 * A_mid / Math.PI);
      const debugNote = {
        t_target_s,
        t_raw,
        t_unit,
        A_lo,
        A_hi,
        t_lo: timeOrificeFillingFromAreaSI(SI, A_lo),
        t_hi: timeOrificeFillingFromAreaSI(SI, A_hi),
        iterations,
        expansions,
        A_solution: A_mid,
        D_solution_mm: D_SI * 1000
      };
      
      return {
        A_SI: A_mid,
        D_SI,
        t_fwd,
        residual,
        debugNote
      };
    }
    
    // Update bracket based on monotonic decreasing function
    if (t_mid > t_target_s) {
      A_lo = A_mid; // Need larger area (smaller time)
    } else {
      A_hi = A_mid; // Need smaller area (larger time)
    }
    
    iterations++;
  }
  
  throw new Error(`Solver failed to converge after ${maxIterations} iterations`);
}

/**
 * Forward Blowdown orifice: calculate time from SI inputs and area
 * @param SI SI units object with P1_Pa, P2_Pa, T_K, V_SI_m3, gas, etc.
 * @param A Area in m²
 * @returns Time in seconds
 */
export function timeOrificeBlowdownFromAreaSI(SI: any, A: number): number {
  const D = Math.sqrt(4 * A / Math.PI);
  
  const inputs: ComputeInputs = {
    process: 'blowdown',
    solveFor: 'TfromD',
    V: SI.V_SI_m3,
    P1: SI.P1_Pa,
    P2: SI.P2_Pa,
    T: SI.T_K,
    L: SI.L_SI_m,
    gas: SI.gas,
    D,
    Cd: SI.Cd || 0.62,
    epsilon: SI.epsilon || 0.01,
    regime: SI.regime || 'isothermal'
  };
  
  return orificeTfromD_blowdown(inputs);
}

/**
 * Inverse Blowdown D-from-t: calculate diameter from SI inputs and target time
 * @param SI SI units object with P1_Pa, P2_Pa, T_K, V_SI_m3, gas, etc.
 * @param t_target Target time in seconds
 * @returns Diameter in meters
 */
export function diameterFromTime_Blowdown(SI: any, t_target: number): number {
  const inputs: ComputeInputs = {
    process: 'blowdown',
    solveFor: 'DfromT',
    V: SI.V_SI_m3,
    P1: SI.P1_Pa,
    P2: SI.P2_Pa,
    T: SI.T_K,
    L: SI.L_SI_m,
    gas: SI.gas,
    Cd: SI.Cd || 0.62,
    epsilon: SI.epsilon || 0.01,
    regime: SI.regime || 'isothermal',
    t: t_target
  };
  
  const result = solveOrificeDfromT(inputs, SI);
  return result.D;
}