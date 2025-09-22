/**
 * Diagnostic calculations and warnings
 */

import { reynoldsNumber, gasDensity, criticalPressureRatio } from './math-utils';
import type { ComputeInputs } from './types';

/**
 * Calculate comprehensive diagnostics for flow analysis
 * @param inputs Computation inputs
 * @param D Computed diameter [m]
 * @returns Diagnostic information
 */
export function calculateDiagnostics(inputs: ComputeInputs, D: number): Record<string, number | string | boolean> {
  const { V, P1, P2, T, L, gas, Cd = 0.62, process, Ps } = inputs;
  const { R, gamma, mu } = gas;
  
  // Basic geometry
  const A = Math.PI * D * D / 4;
  const LoverD = L / D;
  
  // Densities
  const rho1 = gasDensity(P1, R, T);
  const rho2 = gasDensity(P2, R, T);
  
  // Critical pressure ratio
  const r_crit = criticalPressureRatio(gamma);
  
  // Determine pressure ratio and choking based on process
  let P_upstream: number, P_downstream: number, choked: boolean, r: number;
  
  if (process === 'filling' && Ps) {
    // Filling: supply to vessel (Ps → P_vessel)
    P_upstream = Ps;
    P_downstream = P1; // Initial vessel pressure determines choking
    r = P_downstream / P_upstream; // Pv/Ps
    choked = r < r_crit;
  } else {
    // Blowdown: vessel to atmosphere
    P_upstream = P1;
    P_downstream = P2;
    r = P_downstream / P_upstream; // P2/P1
    choked = r < r_crit;
  }
  
  // Flow velocities and Reynolds numbers
  let v_avg: number, Re: number;
  
  if (choked) {
    // Sonic conditions at throat
    const c_throat = Math.sqrt(gamma * R * T);
    v_avg = c_throat;
    const rho_throat = rho1 * Math.pow(r_crit, 1/gamma);
    Re = reynoldsNumber(rho_throat, v_avg, D, mu);
  } else {
    // Subsonic flow - use upstream conditions
    const rho_avg = (rho1 + rho2) / 2;
    const c_avg = Math.sqrt(gamma * R * T);
    v_avg = c_avg * Math.sqrt(2 * (1 - r) / gamma); // Approximate velocity
    Re = reynoldsNumber(rho_avg, v_avg, D, mu);
  }
  
  // Mach number
  const c = Math.sqrt(gamma * R * T);
  const Ma = v_avg / c;
  
  // Flow regimes
  const flowRegime = choked ? 'sonic' : 'subsonic';
  const viscousRegime = Re <= 2000 ? 'laminar' : Re <= 4000 ? 'transitional' : 'turbulent';
  
  // Model validity checks
  const capillaryValid = Re <= 2000 && LoverD >= 10;
  const orificeValid = true; // Orifice model is more generally applicable
  
  return {
    D_mm: D * 1000,
    A_mm2: A * 1e6,
    'L/D': LoverD,
    Re,
    Ma,
    r,
    r_crit,
    choked,
    P_upstream,
    P_downstream,
    rho1,
    rho2,
    v_avg,
    flowRegime,
    viscousRegime,
    capillaryValid,
    orificeValid,
    Cd
  };
}