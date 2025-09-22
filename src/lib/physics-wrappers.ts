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
 * @param SI SI units object with P1_Pa, Pf_Pa, Ps_Pa, T_K, V_SI_m3, gas, etc.
 * @param t_target Target time in seconds
 * @returns Diameter in meters
 */
export function diameterFromTime_Filling(SI: any, t_target: number): number {
  const inputs: ComputeInputs = {
    process: 'filling',
    solveFor: 'DfromT',
    V: SI.V_SI_m3,
    P1: SI.P1_Pa,
    P2: SI.Pf_Pa || SI.P2_Pa, // Target pressure
    T: SI.T_K,
    L: SI.L_SI_m,
    gas: SI.gas,
    Cd: SI.Cd || 0.62,
    epsilon: SI.epsilon || 0.01,
    regime: SI.regime || 'isothermal',
    Ps: SI.Ps_Pa, // Supply pressure required for filling
    t: t_target
  };
  
  const result = solveOrificeDfromT(inputs);
  return result.D;
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
  
  const result = solveOrificeDfromT(inputs);
  return result.D;
}