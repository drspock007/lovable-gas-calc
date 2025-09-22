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

// Re-export key functions that may be imported directly
export { 
  orificeTfromD_blowdown,
  orificeTfromD_filling,
  timeOrificeFromAreaSI_legacy as timeOrificeFromAreaSI,
  sample_tA
} from './physics/index';

// Legacy function that still needs to exist
export function timeCapillaryFromAreaSI(SI: any, A_SI: number): number {
  // Use the validated version and extract the time value
  const result = require('./physics-capillary').timeCapillaryFromAreaSI_validated(SI, A_SI);
  return result.t_SI_s;
}

// Legacy wrapper function
export function timeCapillaryFromAreaSI_legacy(inputs: any, A_SI_m2: number): number {
  // Create a copy of inputs with computed diameter from area
  const D = Math.sqrt(4 * A_SI_m2 / Math.PI);
  const inputsCopy = { ...inputs, D };
  
  if (inputs.process === 'blowdown') {
    // Import dynamically to avoid circular deps
    const { capillaryTfromD_blowdown } = require('./physics/capillary');
    return capillaryTfromD_blowdown(inputsCopy);
  } else {
    const { capillaryTfromD_filling } = require('./physics/capillary');
    return capillaryTfromD_filling(inputsCopy);
  }
}

// Legacy solver with retry - just alias to the main solver
export const solveOrificeDfromTWithRetry = require('./physics/orifice-solvers').solveOrificeDfromT;

// Legacy wrapper for tests that use old SI format
export function timeOrificeFromAreaSI_old(SI: any, A_SI_m2: number): number {
  return require('./legacy-wrappers').timeOrificeFromAreaSI(SI, A_SI_m2);
}