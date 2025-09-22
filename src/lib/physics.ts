/**
 * Gas Transfer Physics Calculations - Legacy Compatibility Layer
 * @deprecated This file now re-exports from the modular physics/ directory
 * @fileoverview Backward compatibility re-exports for existing imports
 */

// Re-export everything from the new modular structure
export * from './physics/index';

// Ensure main compute functions are available
export { computeDfromT, computeTfromD } from './physics/compute-engines';

// Legacy function compatibility
export { timeCapillaryFromAreaSI_validated } from './physics-capillary';

// Legacy types that need to be available
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

// Import all needed functions statically
import { timeCapillaryFromAreaSI_validated } from './physics-capillary';
import { capillaryDfromT_blowdown, capillaryDfromT_filling } from './physics/capillary';
import { solveOrificeDfromT } from './physics/orifice-solvers';
import { timeOrificeFromAreaSI } from './legacy-wrappers';

// Re-export key functions for easy access
export { 
  orificeTfromD_blowdown,
  orificeTfromD_filling,
  timeOrificeFromAreaSI_legacy as timeOrificeFromAreaSI,
  sample_tA
} from './physics/index';

// Export standardized wrappers
export { 
  timeOrificeFillingFromAreaSI,
  diameterFromTime_Filling,
  timeOrificeBlowdownFromAreaSI,
  diameterFromTime_Blowdown
} from './physics-wrappers';

// Legacy function that still needs to exist
export function timeCapillaryFromAreaSI(SI: any, A_SI: number): number {
  // Use the validated version and extract the time value
  const result = timeCapillaryFromAreaSI_validated(SI, A_SI);
  return result.t_SI_s;
}

// Legacy wrapper function for backward compatibility with old test formats
export function timeCapillaryFromAreaSI_legacy(inputs: any, A_SI_m2: number): number {
  // Create a copy of inputs with computed diameter from area
  const D = Math.sqrt(4 * A_SI_m2 / Math.PI);
  const inputsCopy = { ...inputs, D };
  
  if (inputs.process === 'blowdown') {
    return capillaryDfromT_blowdown(inputsCopy);
  } else {
    return capillaryDfromT_filling(inputsCopy);
  }
}

// Legacy solver with retry - just alias to the main solver
export const solveOrificeDfromTWithRetry = solveOrificeDfromT;

// Legacy wrapper for tests that use old SI format
export function timeOrificeFromAreaSI_old(SI: any, A_SI_m2: number): number {
  return timeOrificeFromAreaSI(SI, A_SI_m2);
}