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

// Import for legacy wrapper
import { orificeTfromD_blowdown, orificeTfromD_filling } from './orifice';
import { solveOrificeDfromT } from './orifice-solvers';

// Legacy wrapper that converts old SI format to new ComputeInputs format
export function timeOrificeFromAreaSI_legacy(SI: any, A_SI_m2: number): number {
  const D = Math.sqrt(4 * A_SI_m2 / Math.PI);
  
  const inputs = {
    process: SI.process || 'blowdown',
    solveFor: 'TfromD' as const,
    V: SI.V_SI_m3,
    P1: SI.P1_Pa,
    P2: SI.P2_Pa,
    T: SI.T_K,
    L: SI.L_SI_m,
    gas: SI.gas,
    D,
    Cd: SI.Cd || 0.62,
    epsilon: SI.epsilon || 0.01,
    regime: SI.regime || 'isothermal',
    Ps: SI.Ps_Pa
  };
  
  if (inputs.process === 'blowdown') {
    return orificeTfromD_blowdown(inputs);
  } else {
    return orificeTfromD_filling(inputs);
  }
}

// For backward compatibility, also export from physics-capillary
export { timeCapillaryFromAreaSI_validated } from '../physics-capillary';

// Legacy function compatibility wrapper
export function solveOrificeDfromTWithRetry(SI: any, t_target: number) {
  const inputs = {
    process: SI.process || 'filling',
    solveFor: 'DfromT' as const,
    V: SI.V_SI_m3,
    P1: SI.P1_Pa,
    P2: SI.P2_Pa || SI.Pf_Pa,
    T: SI.T_K,
    L: SI.L_SI_m,
    gas: SI.gas,
    t_target,
    Cd: SI.Cd || 0.62,
    epsilon: SI.epsilon || 0.01,
    regime: SI.regime || 'isothermal',
    Ps: SI.Ps_Pa
  };
  
  return solveOrificeDfromT(inputs, SI);
}