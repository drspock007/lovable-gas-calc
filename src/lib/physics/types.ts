/**
 * Shared types and interfaces for physics calculations
 */

/**
 * Gas properties at 20°C (293.15 K)
 */
export interface GasProps {
  /** Gas name */
  name: string;
  /** Molar mass [kg/mol] */
  M: number;
  /** Specific gas constant [J/(kg·K)] */
  R: number;
  /** Heat capacity ratio Cp/Cv [-] */
  gamma: number;
  /** Dynamic viscosity [Pa·s] */
  mu: number;
}

/**
 * Computation input parameters
 */
export interface ComputeInputs {
  /** Process type: 'blowdown' (vessel empties) or 'filling' (vessel fills) */
  process: 'blowdown' | 'filling';
  /** What to solve for: diameter from time or time from diameter */
  solveFor: 'DfromT' | 'TfromD';
  /** Vessel volume [m³] */
  V: number;
  /** Initial pressure [Pa, absolute] */
  P1: number;
  /** Final pressure [Pa, absolute] */
  P2: number;
  /** Temperature [K] */
  T: number;
  /** Capillary/orifice length [m] */
  L: number;
  /** Gas properties */
  gas: GasProps;
  /** Discharge coefficient [-], default 0.62 for sharp orifice */
  Cd?: number;
  /** Convergence tolerance [-], default 0.01 (1%) */
  epsilon?: number;
  /** Thermodynamic regime: 'isothermal' or 'adiabatic' */
  regime?: 'isothermal' | 'adiabatic';
  /** Supply pressure for filling [Pa, absolute] */
  Ps?: number;
  /** Diameter [m] (when solving for time) */
  D?: number;
  /** Time [s] (when solving for diameter) */
  t?: number;
  /** Atmospheric pressure [Pa] for diagnostics */
  Patm_SI?: number;
  /** Model selection override */
  modelSelection?: 'orifice' | 'capillary';
}

/**
 * Detailed error information for actionable feedback
 */
export interface ComputationError {
  type: 'convergence' | 'bracketing' | 'numerical' | 'input' | 'model' | 'integral' | 'residual';
  message: string;
  details?: Record<string, any>;
  suggestions?: string[];
}

/**
 * Solver results with explicit SI units
 */
export type SolverResultSI = {
  model: 'capillary' | 'orifice';
  A_SI_m2?: number; // or undefined if solving t
  D_SI_m?: number; // sqrt(4A/pi)
  t_SI_s?: number; // time from forward simulation check
  I_total?: number; // integral constant used (dimensionless)
  diag: Record<string, number | string | boolean>;
  warnings: string[];
};

/**
 * Computation results
 */
export interface ComputeOutputs {
  /** Computed diameter [m] */
  D?: number;
  /** Computed time [s] */
  t?: number;
  /** Flow regime verdict */
  verdict: 'capillary' | 'orifice' | 'both' | 'inconclusive';
  /** Detailed diagnostics */
  diagnostics: Record<string, number | string | boolean>;
  /** Warning messages */
  warnings: string[];
  /** Detailed error information if computation fails */
  error?: ComputationError;
  /** Sampling data for debug display */
  sampling?: SamplingData;
  /** Explicit SI results */
  solverResultSI?: SolverResultSI;
}

/**
 * Sampling data for debug diagnostics
 */
export interface SamplingData {
  samples: Array<{
    A: number;
    D_mm: number;
    t_model: number;
  }>;
  bracketInfo: {
    A_lo: number;
    A_hi: number;
    t_A_lo: number;
    t_A_hi: number;
    expansions: number;
  };
  monotonic: boolean;
  warnings: string[];
}