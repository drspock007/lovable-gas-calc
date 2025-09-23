/**
 * Orifice inverse solvers with precise diagnostics
 */

import { brent } from '../rootfind';
import { clamp, criticalPressureRatio } from './math-utils';
import { BracketError } from './errors';
import { orificeTfromD_blowdown, orificeTfromD_filling } from './orifice';
import { timeOrificeFillingFromAreaSI, timeOrificeBlowdownFromAreaSI } from '../physics-wrappers';
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
 * @param SI SI conversion object for forward verification
 * @returns Computed diameter [m]
 */
export function solveOrificeDfromT(inputs: ComputeInputs, SI?: any): { D: number; sampling?: SamplingData } {
  const t_target = inputs.t!;
  const gasName = inputs.gas.name || 'unknown';
  const epsilon_used = Math.max(inputs.epsilon || 0.01, 0.01);
  
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
  
  // Test inclusion and auto-expand based on root function f(A) = t(A) - t_target
  let expansions = 0;
  const maxExpansions = 4; // Max 4 expansions as requested
  
  while (expansions < maxExpansions) {
    try {
      // 1) Calculate t_lo = t(A_lo) and t_hi = t(A_hi) with forward of correct process
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
      
      // 2) Normalize orientation: if (t_lo < t_hi) then swap to ensure t_lo >= t_hi (t(A) decreases with A)
      if (t_lo < t_hi) {
        [A_lo, A_hi] = [A_hi, A_lo];
        [t_lo, t_hi] = [t_hi, t_lo];
        console.log(`🔄 Bracket orientation normalized: swapped bounds to ensure t_lo(${t_lo.toFixed(2)}s) >= t_hi(${t_hi.toFixed(2)}s)`);
      }
      
      // 3) Construct root function: f_lo = t_lo - t_target_s; f_hi = t_hi - t_target_s
      const f_lo = t_lo - t_target;
      const f_hi = t_hi - t_target;
      
      // 4) Test inclusion: inside = (f_lo >= 0 && f_hi <= 0)
      const inside = (f_lo >= 0 && f_hi <= 0);
      
      if (!inside) {
        // Auto-expand bounds (A_lo/=10, A_hi*=10) and recalculate
        A_lo /= 10; // Smaller A -> larger time -> larger f
        A_hi = Math.min(A_hi * 10, A_hi_max); // Larger A -> smaller time -> smaller f, respect physical limit
        expansions++;
        console.log(`Expansion ${expansions}: f not bracketed (f_lo=${f_lo.toFixed(3)}, f_hi=${f_hi.toFixed(3)}), expanding to A=[${A_lo.toExponential(3)}, ${A_hi.toExponential(3)}]`);
      } else {
        // Root function is properly bracketed
        console.log(`✅ Root function bracketed: f_lo=${f_lo.toFixed(3)} >= 0, f_hi=${f_hi.toFixed(3)} <= 0, proceeding with solving`);
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
      
      // Construct final root function values for error reporting
      const f_lo = t_lo - t_target;
      const f_hi = t_hi - t_target;
      
      throw { 
        message: "Target time out of bracket", 
        devNote: { 
          reason: "Target time out of bracket",
          t_target_s: t_target, 
          t_lo, 
          t_hi, 
          f_lo,
          f_hi,
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
  
  // Use Brent's method on f(A) = t(A) - t_target with custom convergence criteria
  let iterations = 0;
  let candidate_source: "mid" | "lo" | "hi" = "mid";
  
  // Custom Brent implementation to track convergence details
  let a = A_lo, b = A_hi;
  let fa = objectiveFunction(a), fb = objectiveFunction(b);
  
  if (Math.sign(fa) === Math.sign(fb)) {
    throw new BracketError(
      'Root function not properly bracketed after all expansions',
      { A_lo, A_hi, fa, fb, t_target }
    );
  }
  
  let c = a, fc = fa, d = 0, e = 0;
  const tolerance = 1e-12;
  const maxIterations = 200;
  
  while (iterations < maxIterations) {
    iterations++;
    
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b; b = c; c = a;
      fa = fb; fb = fc; fc = fa;
    }
    
    const tol = 2 * tolerance * Math.abs(b) + tolerance;
    const m = (c - b) / 2;
    
    // Check convergence: |f(A*)|/max(t_target_s,1e-9) ≤ max(ε,0.01)
    const residual_criterion = Math.abs(fb) / Math.max(t_target, 1e-9);
    if (residual_criterion <= epsilon_used || Math.abs(m) <= tol) {
      // Determine candidate source
      const boundaryTolerance = 1e-8;
      if (Math.abs(b - A_lo) < boundaryTolerance) {
        candidate_source = "lo";
      } else if (Math.abs(b - A_hi) < boundaryTolerance) {
        candidate_source = "hi";
      } else {
        candidate_source = "mid";
      }
      
      // Check if terminated at boundary without proper convergence
      if ((candidate_source === "lo" || candidate_source === "hi") && residual_criterion > epsilon_used) {
        // Calculate bracket endpoint values for error reporting
        const t_lo_final = timeFunction(A_lo);
        const t_hi_final = timeFunction(A_hi);
        const f_lo_final = t_lo_final - t_target;
        const f_hi_final = t_hi_final - t_target;
        
        throw { 
          message: "Hit bracket bound (no root inside)", 
          devNote: { 
            reason: "Hit bracket bound (no root inside)",
            A_lo_m2: A_lo, 
            A_hi_m2: A_hi, 
            t_lo_s: t_lo_final, 
            t_hi_s: t_hi_final, 
            f_lo: f_lo_final, 
            f_hi: f_hi_final, 
            t_target_s: t_target,
            A_final_m2: b,
            iterations,
            residual_criterion,
            candidate_source,
            epsilon_used
          } 
        };
      }
      
      // Successful convergence
      const A_solution = b;
      
      // Use the SAME forward as the solver for verification
      let t_fwd: number;
      if (SI) {
        // Use exact same forward as solver (preferred when SI available)
        if (inputs.process === 'filling') {
          t_fwd = timeOrificeFillingFromAreaSI(SI, A_solution);
        } else {
          t_fwd = timeOrificeBlowdownFromAreaSI(SI, A_solution);
        }
      } else {
        // Fallback to internal time function
        t_fwd = timeFunction(A_solution);
      }
      
      const residual = Math.abs(t_fwd - t_target) / Math.max(t_target, 1e-9);
      
      // Final verification with detailed debug info
      if (residual > epsilon_used) {
        // Calculate correct choking information based on process
        let r_crit: number, choked: boolean;
        if (inputs.process === 'filling' && inputs.Ps) {
          r_crit = criticalPressureRatio(inputs.gas.gamma);
          const r = inputs.P1 / inputs.Ps; // Pv/Ps
          choked = r < r_crit;
        } else if (inputs.process === 'blowdown') {
          r_crit = criticalPressureRatio(inputs.gas.gamma);
          const r = inputs.P2 / inputs.P1; // Pdown/Pup
          choked = r < r_crit;
        } else {
          r_crit = 0;
          choked = false;
        }
        
        throw { 
          message: "Result rejected by residual check", 
          devNote: { 
            process: inputs.process,
            model: "orifice",
            t_target_s: t_target, 
            t_fwd, 
            residual, 
            epsilon_used,
            bounds: { A_lo: A_lo, A_hi: A_hi },
            A_star: A_solution,
            r_crit,
            choked
          } 
        };
      }

      // Save successful bracket for future use
      saveBracketToCache(A_lo, A_hi, inputs.process, gasName);
      
      const D = Math.sqrt(4 * A_solution / Math.PI);
      
      // Store debug info in sampling data
      samplingData.debugNote = {
        t_target_s: t_target,
        iterations,
        residual_time: residual,
        A_final_m2: A_solution,
        candidate_source
      };
      
      return { D, sampling: samplingData };
    }
    
    // Brent's method continuation
    if (Math.abs(e) >= tol && Math.abs(fa) > Math.abs(fb)) {
      const s = fb / fa;
      let p, q;
      
      if (a === c) {
        // Linear interpolation
        p = 2 * m * s;
        q = 1 - s;
      } else {
        // Inverse quadratic interpolation
        q = fa / fc;
        const r = fb / fc;
        p = s * (2 * m * q * (q - r) - (b - a) * (r - 1));
        q = (q - 1) * (r - 1) * (s - 1);
      }
      
      if (p > 0) q = -q;
      p = Math.abs(p);
      
      if (2 * p < Math.min(3 * m * q - Math.abs(tol * q), Math.abs(e * q))) {
        e = d;
        d = p / q;
      } else {
        d = m;
        e = d;
      }
    } else {
      d = m;
      e = d;
    }
    
    a = b;
    fa = fb;
    
    if (Math.abs(d) > tol) {
      b += d;
    } else {
      b += Math.sign(m) * tol;
    }
    
    fb = objectiveFunction(b);
    
    if (Math.sign(fb) === Math.sign(fc)) {
      c = a;
      fc = fa;
      d = e = b - a;
    }
  }
  
  // Failed to converge
  throw new BracketError(
    `Root finding failed to converge after ${maxIterations} iterations`,
    { A_lo, A_hi, method: 'Brent', t_target, iterations }
  );
}