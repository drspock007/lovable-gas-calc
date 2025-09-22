/**
 * Orifice inverse solvers with precise diagnostics
 */

import { brent } from '../rootfind';
import { clamp, criticalPressureRatio } from './math-utils';
import { BracketError } from './errors';
import { orificeTfromD_blowdown, orificeTfromD_filling } from './orifice';
import type { ComputeInputs, SamplingData } from './types';

/**
 * Bracket persistence for optimization
 */
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
export function solveOrificeDfromT(inputs: ComputeInputs): { D: number; sampling?: SamplingData } {
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
    A_hi = 1e-2;  // Large area (D ≈ 112.8 mm) - will be constrained below
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
      // 1) Calculate times at bracket endpoints with precise error diagnostics
      let t_lo = timeFunction(A_lo);
      let t_hi = timeFunction(A_hi);
      
      // Check for non-finite bracket times (Diagnostic #1)
      if (!Number.isFinite(t_lo) || !Number.isFinite(t_hi)) {
        throw { 
          message: "Non-finite bracket times", 
          devNote: { 
            reason: "non-finite bracket times",
            t_lo,
            t_hi,
            A_lo_m2: A_lo,
            A_hi_m2: A_hi,
            process: inputs.process,
            bracket_expansions: expansions
          } 
        };
      }
      
      // 2) Normalize orientation: ensure t_lo >= t_hi (monotone decreasing)
      if (t_lo < t_hi) {
        // Swap the bounds to ensure proper monotonicity
        [A_lo, A_hi] = [A_hi, A_lo];
        [t_lo, t_hi] = [t_hi, t_lo];
        console.log(`🔄 Bracket orientation fixed: swapped bounds to ensure t_lo(${t_lo.toFixed(2)}s) >= t_hi(${t_hi.toFixed(2)}s)`);
      }
      
      // 3) Test inclusion: t_hi <= t_target <= t_lo (monotone decreasing)
      const inside = (t_hi <= t_target && t_target <= t_lo);
      
      if (!inside) {
        // Auto-expand bounds (logged for devNote)
        A_lo /= 10; // Smaller A -> larger time
        A_hi = Math.min(A_hi * 10, A_hi_max); // Larger A -> smaller time, respect physical limit
        expansions++;
        console.log(`Expansion ${expansions}: t_target=${t_target}s not in [${t_hi}s, ${t_lo}s], expanding to A=[${A_lo.toExponential(3)}, ${A_hi.toExponential(3)}]`);
      } else {
        // Target time is properly included in bracket
        console.log(`✅ Target time ${t_target}s is included in [${t_hi}s, ${t_lo}s], proceeding with solving`);
        break;
      }
    } catch (error) {
      // Re-throw precise diagnostic errors immediately
      if ((error as any).devNote?.reason) {
        throw error;
      }
      
      // If evaluation fails, try expanding
      A_lo /= 10;
      A_hi = Math.min(A_hi * 10, A_hi_max);
      expansions++;
      console.log(`Expansion ${expansions}: evaluation failed, expanding to A=[${A_lo.toExponential(3)}, ${A_hi.toExponential(3)}]`);
    }
  }
  
  if (expansions >= maxExpansions) {
    // Final inclusion test for precise diagnostic (Diagnostic #2)
    try {
      let t_lo = timeFunction(A_lo);
      let t_hi = timeFunction(A_hi);
      
      // Ensure correct order for error reporting
      if (t_lo < t_hi) {
        [A_lo, A_hi] = [A_hi, A_lo];
        [t_lo, t_hi] = [t_hi, t_lo];
      }
      
      throw { 
        message: "Target time out of bracket", 
        devNote: { 
          reason: "Target time out of bracket",
          t_target_s: t_target, 
          t_lo, 
          t_hi, 
          A_lo_m2: A_lo, 
          A_hi_m2: A_hi,
          bracket_expansions: expansions
        } 
      };
    } catch (evalError) {
      // Check if it's our precise diagnostic error
      if ((evalError as any).devNote?.reason) {
        throw evalError;
      }
      
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
  
  // Use Brent's method for robust root finding with f(A) = t(A) - t_target_SI
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
  
  // CRITICAL: Never take the bound as solution
  // Check if algorithm terminated at a boundary without satisfying residual
  const boundaryTolerance = 1e-8;
  const isAtLowerBound = Math.abs(A_solution - A_lo) < boundaryTolerance;
  const isAtUpperBound = Math.abs(A_solution - A_hi) < boundaryTolerance;
  
  if (isAtLowerBound || isAtUpperBound) {
    // Verify residual before rejecting
    const t_computed = timeFunction(A_solution);
    const residual_time = Math.abs(t_computed - t_target) / Math.max(t_target, 1e-9);
    const epsilon_threshold = Math.max(inputs.epsilon || 0.01, 0.01);
    
    if (residual_time > epsilon_threshold) {
      // Hit boundary without satisfying residual (Diagnostic #3)
      throw { 
        message: "Hit bracket bound (no root inside)", 
        devNote: { 
          reason: "Hit bracket bound (no root inside)",
          A_lo_m2: A_lo, 
          A_hi_m2: A_hi, 
          t_lo_s: samplingData.bracketInfo.t_A_lo, 
          t_hi_s: samplingData.bracketInfo.t_A_hi, 
          t_target_s: t_target,
          boundary_hit: isAtLowerBound ? 'lower' : 'upper',
          A_solution_m2: A_solution,
          residual_time,
          epsilon_threshold
        } 
      };
    }
  }

  // Final forward verification (Diagnostic #4) - same model/path for Filling
  const t_forward = timeFunction(A_solution);
  const residual = Math.abs(t_forward - t_target) / Math.max(t_target, 1e-9);
  const epsilon_used = Math.max(inputs.epsilon || 0.01, 0.01);
  
  if (residual > epsilon_used) {
    // Calculate correct choking information based on process
    let choking: any = {};
    if (inputs.process === 'filling' && inputs.Ps) {
      // Filling: use Pv/Ps (vessel pressure / supply pressure)
      const r_crit = criticalPressureRatio(inputs.gas.gamma);
      const r = inputs.P1 / inputs.Ps; // Pv/Ps
      choking = { r_crit, choked: r < r_crit, r };
    } else if (inputs.process === 'blowdown') {
      // Blowdown: use downstream/upstream
      const r_crit = criticalPressureRatio(inputs.gas.gamma);
      const r = inputs.P2 / inputs.P1; // Pdown/Pup
      choking = { r_crit, choked: r < r_crit, r };
    }
    
    throw { 
      message: "Result rejected by residual check", 
      devNote: { 
        reason: "Result rejected by residual check",
        t_forward_s: t_forward, 
        t_target_s: t_target, 
        residual, 
        epsilon_used,
        bounds_used: { A_lo_m2: A_lo, A_hi_m2: A_hi },
        choking
      } 
    };
  }

  // Save successful bracket for future use
  saveBracketToCache(A_lo, A_hi, inputs.process, gasName);
  
  const D = Math.sqrt(4 * A_solution / Math.PI);
  
  return { D, sampling: samplingData };
}