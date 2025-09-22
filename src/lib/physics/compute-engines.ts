/**
 * Main computation engines for diameter and time calculations
 */

import { capillaryDfromT_blowdown, capillaryDfromT_filling } from './capillary';
import { solveOrifice_DfromT_isothermal } from './orifice';
import { solveOrificeDfromT } from './orifice-solvers';
import { calculateDiagnostics } from './diagnostics';
import { sample_tA } from './sampling';
import { orificeTfromD_blowdown, orificeTfromD_filling } from './orifice';
import { timeCapillaryFromAreaSI_validated } from '../physics-capillary';
import { criticalPressureRatio, clamp } from './math-utils';
import { BracketError, IntegralError, ResidualError } from './errors';
import type { ComputeInputs, ComputeOutputs, SamplingData, ComputationError } from './types';

/**
 * Main compute function for diameter from time
 */
export function computeDfromT(inputs: ComputeInputs): ComputeOutputs {
  const { process, modelSelection } = inputs;

  let D: number | undefined;
  let diagnostics: Record<string, number | string | boolean> = {};
  let warnings: string[] = [];
  let error: ComputationError | undefined;
  let sampling: SamplingData | undefined;
  let solverResultSI: any;

  try {
    if (modelSelection === 'capillary') {
      // Capillary model
      if (process === 'blowdown') {
        D = capillaryDfromT_blowdown(inputs);
      } else {
        D = capillaryDfromT_filling(inputs);
      }
      diagnostics = calculateDiagnostics(inputs, D);
    } else if (modelSelection === 'orifice') {
      // Orifice model with robust solver
      const result = solveOrificeDfromT(inputs);
      D = result.D;
      sampling = result.sampling;
      diagnostics = calculateDiagnostics(inputs, D);
    } else {
      // Automatic model selection
      const orificeResult = solveOrificeDfromT(inputs);
      const D_orifice = orificeResult.D;
      const orificeDiagnostics = calculateDiagnostics(inputs, D_orifice);

      if (orificeDiagnostics.capillaryValid) {
        // Use capillary model if orifice suggests it
        if (process === 'blowdown') {
          D = capillaryDfromT_blowdown(inputs);
        } else {
          D = capillaryDfromT_filling(inputs);
        }
        diagnostics = calculateDiagnostics(inputs, D);
      } else {
        // Otherwise use orifice result
        D = D_orifice;
        diagnostics = orificeDiagnostics;
        sampling = orificeResult.sampling;
      }
    }
  } catch (e: any) {
    if (e.type === 'bracketing' || e.type === 'integral' || e.type === 'residual') {
      // Known error types with suggestions
      error = {
        type: e.type,
        message: e.message,
        details: e.details,
        suggestions: e.suggestions
      };
    } else if (e.devNote?.reason) {
      // Re-throw precise diagnostic errors immediately
      throw e;
    } else {
      // Generic error
      error = {
        type: 'numerical',
        message: e.message || 'An unexpected error occurred',
        details: { stack: e.stack },
        suggestions: ['Check input parameters', 'Try a different model']
      };
    }
  }

  const verdict = (diagnostics as any).capillaryValid ? 'capillary' : 'orifice';

  return {
    D,
    verdict,
    diagnostics,
    warnings,
    error,
    sampling,
    solverResultSI
  };
}

/**
 * Main compute function for time from diameter
 */
export function computeTfromD(inputs: ComputeInputs): ComputeOutputs {
  const { V, P1, P2, T, L, gas, D, process, epsilon = 0.01, modelSelection } = inputs;

  let t: number | undefined;
  let diagnostics: Record<string, number | string | boolean> = {};
  let warnings: string[] = [];
  let error: ComputationError | undefined;
  let solverResultSI: any;

  try {
    if (modelSelection === 'capillary') {
      // Capillary model
      const SI = {
        V_SI_m3: V,
        P1_Pa: P1,
        P2_Pa: P2,
        T_K: T,
        gas: gas,
        epsilon: epsilon,
        L_SI_m: L,
        L_m: L,
        D_SI_m: D,
        D_m: D,
        Ps_Pa: inputs.Ps
      };

      const validatedResult = timeCapillaryFromAreaSI_validated(SI, Math.PI * Math.pow(D!, 2) / 4);
      t = validatedResult.t_SI_s;
      warnings = validatedResult.warnings;
      diagnostics = calculateDiagnostics(inputs, D!);
    } else if (modelSelection === 'orifice') {
      // Orifice model
      if (process === 'blowdown') {
        t = orificeTfromD_blowdown(inputs);
      } else {
        t = orificeTfromD_filling(inputs);
      }
      diagnostics = calculateDiagnostics(inputs, D!);
    } else {
      // Automatic model selection
      const Re = (diagnostics as any)?.Re || 0; // Use existing Re if available
      const LoverD = (diagnostics as any)?.['L/D'] || 0;

      if (Re <= 2000 && LoverD >= 10) {
        // Use capillary model if applicable
        const SI = {
          V_SI_m3: V,
          P1_Pa: P1,
          P2_Pa: P2,
          T_K: T,
          gas: gas,
          epsilon: epsilon,
          L_SI_m: L,
          L_m: L,
          D_SI_m: D,
          D_m: D,
          Ps_Pa: inputs.Ps
        };

        const validatedResult = timeCapillaryFromAreaSI_validated(SI, Math.PI * Math.pow(D!, 2) / 4);
        t = validatedResult.t_SI_s;
        warnings = validatedResult.warnings;
        diagnostics = calculateDiagnostics(inputs, D!);
      } else {
        // Otherwise use orifice model
        if (process === 'blowdown') {
          t = orificeTfromD_blowdown(inputs);
        } else {
          t = orificeTfromD_filling(inputs);
        }
        diagnostics = calculateDiagnostics(inputs, D!);
      }
    }
  } catch (e: any) {
    if (e.type === 'bracketing' || e.type === 'integral' || e.type === 'residual') {
      // Known error types with suggestions
      error = {
        type: e.type,
        message: e.message,
        details: e.details,
        suggestions: e.suggestions
      };
    } else {
      // Generic error
      error = {
        type: 'numerical',
        message: e.message || 'An unexpected error occurred',
        details: { stack: e.stack },
        suggestions: ['Check input parameters', 'Try a different model']
      };
    }
  }

  const verdict = (diagnostics as any).capillaryValid ? 'capillary' : 'orifice';

  return {
    t,
    verdict,
    diagnostics,
    warnings,
    error,
    solverResultSI
  };
}
