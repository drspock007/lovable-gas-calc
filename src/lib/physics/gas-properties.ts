/**
 * Gas properties and constants
 */

import type { GasProps } from './types';

/** Universal gas constant [J/(mol·K)] */
const R_UNIVERSAL = 8.314462618;

/**
 * Built-in gas properties at 20°C (293.15 K)
 */
export const GASES: Record<string, GasProps> = {
  air: {
    name: 'Air',
    M: 0.028964, // kg/mol
    R: R_UNIVERSAL / 0.028964, // 287.0 J/(kg·K)
    gamma: 1.4,
    mu: 1.825e-5, // Pa·s at 20°C
  },
  N2: {
    name: 'Nitrogen',
    M: 0.028014,
    R: R_UNIVERSAL / 0.028014, // 296.8 J/(kg·K)
    gamma: 1.4,
    mu: 1.780e-5,
  },
  O2: {
    name: 'Oxygen',
    M: 0.031998,
    R: R_UNIVERSAL / 0.031998, // 259.8 J/(kg·K)
    gamma: 1.4,
    mu: 2.055e-5,
  },
  CH4: {
    name: 'Methane',
    M: 0.016042,
    R: R_UNIVERSAL / 0.016042, // 518.3 J/(kg·K)
    gamma: 1.32,
    mu: 1.127e-5,
  },
  CO2: {
    name: 'Carbon Dioxide',
    M: 0.044010,
    R: R_UNIVERSAL / 0.044010, // 188.9 J/(kg·K)
    gamma: 1.30,
    mu: 1.480e-5,
  },
  He: {
    name: 'Helium',
    M: 0.004003,
    R: R_UNIVERSAL / 0.004003, // 2077.0 J/(kg·K)
    gamma: 1.67,
    mu: 1.990e-5,
  },
};