/**
 * Legacy wrapper function for timeOrificeFromAreaSI
 * Handles legacy SI format inputs used in some tests
 */

import { orificeTfromD_blowdown, orificeTfromD_filling } from './physics/orifice';
import type { ComputeInputs } from './physics/types';

/**
 * Legacy function for backward compatibility with old test formats
 * @param SI Legacy SI object format
 * @param A_SI_m2 Area in m²
 * @returns Time in seconds
 */
export function timeOrificeFromAreaSI(SI: any, A_SI_m2: number): number {
  // Convert legacy SI format to ComputeInputs
  const D = Math.sqrt(4 * A_SI_m2 / Math.PI);
  
  const inputs: ComputeInputs = {
    process: SI.process || 'blowdown',
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
    regime: SI.regime || 'isothermal',
    Ps: SI.Ps_Pa
  };
  
  if (inputs.process === 'blowdown') {
    return orificeTfromD_blowdown(inputs);
  } else {
    return orificeTfromD_filling(inputs);
  }
}