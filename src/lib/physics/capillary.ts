/**
 * Capillary flow calculations
 */

import { clamp } from './math-utils';
import type { ComputeInputs } from './types';

/**
 * Capillary flow model - Diameter from time (blowdown)
 * @param inputs Computation inputs
 * @returns Computed diameter [m]
 */
export function capillaryDfromT_blowdown(inputs: ComputeInputs): number {
  const { V, P1, P2, T, L, gas, t, epsilon = 0.01 } = inputs;
  const { mu } = gas;
  
  const Pf = P2 * (1 + epsilon);
  
  // Closed-form solution for capillary blowdown
  const numerator = (P1 - P2) * (Pf + P2);
  const denominator = (P1 + P2) * (Pf - P2);
  
  if (numerator <= 0 || denominator <= 0) {
    throw new Error('Invalid pressure conditions for capillary blowdown');
  }
  
  const lnTerm = Math.log(numerator / denominator);
  const D4 = (128 * mu * L * V * lnTerm) / (Math.PI * t! * P2);
  
  return Math.pow(D4, 0.25);
}

/**
 * Capillary flow model - Diameter from time (filling)
 * @param inputs Computation inputs
 * @returns Computed diameter [m]
 */
export function capillaryDfromT_filling(inputs: ComputeInputs): number {
  const { V, P1, P2, T, L, gas, t, epsilon = 0.01, Ps } = inputs;
  const { mu } = gas;
  
  if (!Ps) throw new Error('Supply pressure Ps required for filling');
  
  // Enhanced validation for filling mode
  if (Ps <= P1) {
    throw new Error(`Supply pressure Ps (${Ps}) must be greater than initial pressure P1 (${P1})`);
  }
  if (Ps <= P2) {
    throw new Error(`Supply pressure Ps (${Ps}) must be greater than final pressure P2 (${P2})`);
  }
  if (!Number.isFinite(t) || t! <= 0) {
    throw new Error(`Invalid time for filling: ${t}`);
  }
  
  const Pf = P2 * (1 - epsilon);
  
  const numerator = (Ps - P1) * (Pf + Ps);
  const denominator = (Ps + P1) * (Ps - Pf);
  
  if (numerator <= 0) {
    throw new Error(`Numerator ≤ 0: (Ps-P1)*(Pf+Ps) = (${Ps}-${P1})*(${Pf}+${Ps}) = ${numerator}`);
  }
  if (denominator <= 0) {
    throw new Error(`Denominator ≤ 0: (Ps+P1)*(Ps-Pf) = (${Ps}+${P1})*(${Ps}-${Pf}) = ${denominator}`);
  }
  
  const lnTerm = Math.log(numerator / denominator);
  if (!Number.isFinite(lnTerm)) {
    throw new Error(`Invalid logarithm: ln(${numerator}/${denominator}) = ${lnTerm}`);
  }
  
  const D4 = (128 * mu * L * V * lnTerm) / (Math.PI * t! * Ps);
  
  if (D4 <= 0) {
    throw new Error(`D^4 calculation invalid: ${D4}`);
  }
  
  return Math.pow(D4, 0.25);
}

/**
 * Capillary flow model - Time from diameter (filling)
 * @param inputs Computation inputs
 * @returns Computed time [s]
 */
export function capillaryTfromD_filling(inputs: ComputeInputs): number {
  const { V, P1, P2, T, L, gas, D, epsilon = 0.01, Ps } = inputs;
  const { mu } = gas;
  
  if (!Ps) throw new Error('Supply pressure Ps required for filling');
  
  const Pf = P2 * (1 - epsilon);
  
  const numerator = (Ps - P1) * (Pf + Ps);
  const denominator = (Ps + P1) * (Ps - Pf);
  
  if (numerator <= 0 || denominator <= 0) {
    throw new Error('Invalid pressure conditions for capillary filling');
  }
  
  const lnTerm = Math.log(numerator / denominator);
  const D4 = Math.pow(D!, 4);
  
  return (128 * mu * L * V * lnTerm) / (Math.PI * D4 * Ps);
}