/**
 * Physics calculations - modular exports
 */

// Types
export type {
  GasProps,
  ComputeInputs,
  ComputeOutputs,
  ComputationError,
  SolverResultSI,
  SamplingData
} from './types';

// Gas properties
export { GASES } from './gas-properties';

// Error classes
export { BracketError, IntegralError, ResidualError } from './errors';

// Math utilities
export {
  clamp,
  pos,
  criticalPressureRatio,
  criticalRatio,
  Cstar,
  K,
  sonicFlowCoeff,
  subsonicFlowCoeff,
  reynoldsNumber,
  gasDensity,
  adaptiveSimpson
} from './math-utils';

// Orifice calculations
export {
  subcriticalIntegralBlowdown,
  subcriticalIntegralFilling,
  orificeTfromD_blowdown,
  orificeTfromD_filling,
  orificeIsothermalIntegral,
  timeOrificeFromAreaSI_legacy,
  solveOrifice_DfromT_isothermal
} from './orifice';

// Capillary calculations  
export {
  capillaryDfromT_blowdown,
  capillaryDfromT_filling,
  capillaryTfromD_filling
} from './capillary';

// Solvers
export { solveOrificeDfromT } from './orifice-solvers';

// Diagnostics
export { calculateDiagnostics } from './diagnostics';

// Sampling
export { sample_tA } from './sampling';

// Main compute engines
export { computeDfromT, computeTfromD } from './compute-engines';

// Legacy compatibility - re-export from original file temporarily
export * from '../physics';