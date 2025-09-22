/**
 * Time-area sampling and monotonicity analysis
 */

import { orificeTfromD_blowdown, orificeTfromD_filling } from './orifice';
import { timeCapillaryFromAreaSI_validated } from '../physics-capillary';
import type { ComputeInputs } from './types';

export interface SamplePoint {
  A_m2: number;
  D_m: number;
  t_s: number;
  choked: boolean; // Required for compatibility
  subcritical?: boolean;
  phase: 'sonic'|'sub'|'mixed'; // Required for compatibility
}

export interface SamplingResult {
  samples: SamplePoint[];
  monotonic: boolean;
  warnings: string[];
  model: 'orifice'|'capillary'; // Required to match TASampler
  bracket?: { 
    A_lo: number; 
    A_hi: number; 
    t_lo: number; 
    t_hi: number; 
    expansions: number 
  };
}

/**
 * Sample t(A) relationship for debugging and analysis
 * @param inputs Computation inputs
 * @param model Model type ('orifice' or 'capillary')
 * @param A_min Minimum area [m²]
 * @param A_max Maximum area [m²] 
 * @param numSamples Number of samples
 * @returns Sampling data
 */
export function sample_tA(
  inputs: ComputeInputs, 
  model: 'orifice' | 'capillary',
  A_min: number, 
  A_max: number, 
  numSamples: number
): SamplingResult {
  const samples: SamplePoint[] = [];
  const warnings: string[] = [];
  
  // Generate log-spaced areas
  const logA_min = Math.log10(A_min);
  const logA_max = Math.log10(A_max);
  const deltaLog = (logA_max - logA_min) / (numSamples - 1);
  
  for (let i = 0; i < numSamples; i++) {
    const logA = logA_min + i * deltaLog;
    const A = Math.pow(10, logA);
    const D = Math.sqrt(4 * A / Math.PI);
    
    try {
      let t: number;
      
      if (model === 'orifice') {
        const testInputs = { ...inputs, D };
        if (inputs.process === 'blowdown') {
          t = orificeTfromD_blowdown(testInputs);
        } else {
          t = orificeTfromD_filling(testInputs);
        }
      } else {
        // Capillary model
        const SI = {
          V_SI_m3: inputs.V,
          P1_Pa: inputs.P1,
          P2_Pa: inputs.P2,
          T_K: inputs.T,
          gas: inputs.gas,
          epsilon: inputs.epsilon || 0.01,
          L_SI_m: inputs.L,
          L_m: inputs.L,
          Ps_Pa: inputs.Ps
        };
        
        const result = timeCapillaryFromAreaSI_validated(SI, A);
        t = result.t_SI_s;
      }
      
      samples.push({
        A_m2: A,
        D_m: D,
        t_s: t,
        choked: false, // Default to false, could be computed for orifice
        subcritical: model === 'capillary', // Capillary is always subcritical
        phase: 'sub' as const // Default phase
      });
      
    } catch (error) {
      warnings.push(`Sample at A=${A.toExponential(3)} failed: ${(error as Error).message}`);
    }
  }
  
  // Check monotonicity: t should decrease as A increases
  let monotonic = true;
  const tolerance = 1e-6;
  
  for (let i = 1; i < samples.length; i++) {
    const t_prev = samples[i-1].t_s;
    const t_curr = samples[i].t_s;
    
    if (t_curr >= t_prev * (1 - tolerance)) {
      monotonic = false;
      warnings.push(`Non-monotonic behavior detected between samples ${i-1} and ${i}`);
      break;
    }
  }
  
  // Check for significant time range
  if (samples.length >= 2) {
    const t_ratio = samples[0].t_s / samples[samples.length - 1].t_s;
    if (t_ratio < 2) {
      warnings.push('Small time variation across area range - may indicate numerical issues');
    }
  }
  
  return {
    samples,
    monotonic,
    warnings,
    model // Add the model to the result
  };
}