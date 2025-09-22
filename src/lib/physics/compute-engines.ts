/**
 * Main computation engines for diameter and time calculations
 */

import { capillaryDfromT_blowdown, capillaryDfromT_filling, capillaryTfromD_filling } from './capillary';
import { solveOrifice_DfromT_isothermal, orificeTfromD_blowdown, orificeTfromD_filling } from './orifice';
import { solveOrificeDfromT } from './orifice-solvers';
import { calculateDiagnostics } from './diagnostics';
import { sample_tA } from './sampling';
import { timeCapillaryFromAreaSI_validated } from '../physics-capillary';
import { criticalPressureRatio, clamp } from './math-utils';
import { BracketError, IntegralError, ResidualError } from './errors';
import { parseDecimalLoose } from '../num-parse';
import { toSI_Time, type TimeUnit } from '../units';
import { formatTimeDisplay } from '../time-format';
import type { ComputeInputs, ComputeOutputs, SamplingData, ComputationError, SolverResultSI } from './types';

/**
 * Validate and normalize inputs
 */
function validateInputs(inputs: ComputeInputs): ComputeInputs {
  // Input validation with enhanced error messages
  if (!inputs.V || inputs.V <= 0) {
    throw new Error(`Invalid volume: ${inputs.V}. Must be positive.`);
  }
  if (!inputs.P1 || inputs.P1 <= 0) {
    throw new Error(`Invalid initial pressure P1: ${inputs.P1}. Must be positive (absolute pressure in Pa).`);
  }
  if (!inputs.P2 || inputs.P2 <= 0) {
    throw new Error(`Invalid final pressure P2: ${inputs.P2}. Must be positive (absolute pressure in Pa).`);
  }
  if (!inputs.T || inputs.T <= 0) {
    throw new Error(`Invalid temperature: ${inputs.T}. Must be positive (absolute temperature in K).`);
  }
  if (!inputs.L || inputs.L <= 0) {
    throw new Error(`Invalid length L: ${inputs.L}. Must be positive.`);
  }
  if (!inputs.gas) {
    throw new Error('Gas properties are required');
  }

  // Process-specific validation
  if (inputs.process === 'filling') {
    if (!inputs.Ps || inputs.Ps <= 0) {
      throw new Error(`Invalid supply pressure Ps: ${inputs.Ps}. Required for filling process (absolute pressure in Pa).`);
    }
    if (inputs.Ps <= Math.max(inputs.P1, inputs.P2)) {
      throw new Error(`Supply pressure Ps (${inputs.Ps}) must be greater than both P1 (${inputs.P1}) and P2 (${inputs.P2}).`);
    }
    if (inputs.P1 >= inputs.P2) {
      throw new Error(`For filling: P1 (${inputs.P1}) must be less than P2 (${inputs.P2}).`);
    }
  } else {
    // Blowdown
    if (inputs.P1 <= inputs.P2) {
      throw new Error(`For blowdown: P1 (${inputs.P1}) must be greater than P2 (${inputs.P2}).`);
    }
  }

  // Solve-for specific validation
  if (inputs.solveFor === 'TfromD') {
    if (!inputs.D || inputs.D <= 0) {
      throw new Error(`Invalid diameter: ${inputs.D}. Must be positive for time calculation.`);
    }
  } else {
    if (!inputs.t || inputs.t <= 0) {
      throw new Error(`Invalid time: ${inputs.t}. Must be positive for diameter calculation.`);
    }
  }

  return {
    ...inputs,
    Cd: inputs.Cd ?? 0.62,
    epsilon: clamp(inputs.epsilon ?? 0.01, 1e-3, 0.1),
    regime: inputs.regime ?? 'isothermal'
  };
}

/**
 * Generate warnings based on model validity
 */
function generateWarnings(diagnostics: Record<string, number | string | boolean>, inputs: ComputeInputs): string[] {
  const warnings: string[] = [];
  const Re = diagnostics.Re as number;
  const LoverD = diagnostics['L/D'] as number;
  
  // Capillary flow validity checks
  if (Re > 2000) {
    warnings.push(`Reynolds number ${Re.toFixed(0)} > 2000: turbulent flow, capillary model may be invalid`);
  }
  
  if (LoverD < 10) {
    warnings.push(`L/D ratio ${LoverD.toFixed(1)} < 10: entrance effects significant, capillary model may be invalid`);
  }
  
  // Pressure ratio checks
  if (inputs.process === 'blowdown' && inputs.P1 / inputs.P2 > 10) {
    warnings.push('High pressure ratio: consider compressibility effects');
  }
  
  if (inputs.process === 'filling' && inputs.Ps && inputs.Ps / inputs.P1 > 10) {
    warnings.push('High pressure ratio: consider compressibility effects');
  }
  
  return warnings;
}

/**
 * Capillary flow model - Time from diameter (blowdown)
 */
function capillaryTfromD_blowdown(inputs: ComputeInputs): number {
  const { V, P1, P2, T, L, gas, D, epsilon = 0.01 } = inputs;
  const { mu } = gas;
  
  const Pf = P2 * (1 + epsilon);
  
  // Closed-form solution for capillary blowdown
  const numerator = (P1 - P2) * (Pf + P2);
  const denominator = (P1 + P2) * (Pf - P2);
  
  if (numerator <= 0 || denominator <= 0) {
    throw new Error('Invalid pressure conditions for capillary blowdown');
  }
  
  const lnTerm = Math.log(numerator / denominator);
  const D4 = Math.pow(D!, 4);
  
  return (128 * mu * L * V * lnTerm) / (Math.PI * D4 * P2);
}

/**
 * Main compute function for diameter from time
 */
export function computeDfromT(inputs: ComputeInputs): ComputeOutputs {
  // Capture inputs for enriched error reporting
  const inputs_SI = {
    V_SI_m3: inputs.V,
    T_K: inputs.T,
    P1_Pa: inputs.P1,
    P2_Pa: inputs.P2,
    Ps_Pa: inputs.Ps,
    L_SI_m: inputs.L,
    gas: {
      name: inputs.gas.name,
      R: inputs.gas.R,
      gamma: inputs.gas.gamma,
      mu: inputs.gas.mu
    },
    Cd: inputs.Cd || 0.62,
    regime: inputs.regime || 'default'
  };
  
  try {
    // Robust target time reading - compatible with current interface but extensible
    const raw = inputs?.t; // For now, read from 't' field since that's what ComputeInputs has
    const unit = "s"; // Default unit, could be extended later for UI inputs with unit selection
    const parsed = Number(String(raw).replace(",", ".").trim());
    const t_target_SI = toSI_Time(parsed, unit as TimeUnit);
    
    // Guard: prevent fallback on invalid time
    if (!Number.isFinite(t_target_SI) || t_target_SI <= 0) {
      throw { message: "Invalid target time", devNote: { raw, unit, parsed, t_target_SI, error: "NaN, infinite, or ≤0" } };
    }
    
    // Update inputs with validated time
    const validatedInputs = { ...inputs, t: t_target_SI };
    
    let D_capillary: number | undefined;
    let D_orifice: number | undefined;
    const warnings: string[] = [];
    let capillary_error: string | undefined;
    let orifice_error: string | undefined;
    
    // Check if model is forced via modelSelection
    const forcedModel = validatedInputs.modelSelection;
    
    // 1) Compute D_cap via capillary model
    try {
      if (validatedInputs.process === 'blowdown') {
        D_capillary = capillaryDfromT_blowdown(validatedInputs);
      } else {
        D_capillary = capillaryDfromT_filling(validatedInputs);
      }
    } catch (error) {
      capillary_error = `Capillary model failed: ${(error as Error).message}`;
      
      // Enrich capillary error with context for Filling mode
      if (validatedInputs.process === 'filling') {
        const enrichedError = error as any;
        if (enrichedError.devNote) {
          enrichedError.devNote = {
            ...enrichedError.devNote,
            process: 'filling',
            model: 'capillary',
            t_target_s: t_target_SI,
            epsilon: validatedInputs.epsilon || 0.01,
            inputs_SI,
            reason: enrichedError.message || "capillary solver failed"
          };
        }
        throw enrichedError;
      }
    }
    
    // 2) Compute D_orif via orifice model (try isothermal first, then robust root finding)
    let samplingData: SamplingData | undefined;
    let orifice_isothermal_failed = false;
    let isothermal_residual_marginal = false;
    
    try {
      // Try isothermal solver first if regime is isothermal or default
      if (validatedInputs.regime !== 'adiabatic') {
        try {
          const isothermalResult = solveOrifice_DfromT_isothermal(validatedInputs);
          D_orifice = isothermalResult.D_SI_m;
          
          // Check if flow is choked and monotonic for smart switching decision
          if (D_orifice) {
            const testDiag = calculateDiagnostics(validatedInputs, D_orifice);
            const isChoked = testDiag.choked as boolean;
            
            // Sample to check monotonicity
            try {
              const sampleResult = sample_tA(validatedInputs, 'orifice', 1e-12, 1e-8, 5);
              const isMonotonic = sampleResult.samples.length >= 2 && 
                sampleResult.samples.every((s, i, arr) => i === 0 || s.t_s < arr[i-1].t_s);
              
              if (isChoked && isMonotonic) {
                samplingData = {
                  samples: sampleResult.samples.map(s => ({
                    A: s.A_m2,
                    D_mm: s.D_m * 1000,
                    t_model: s.t_s
                  })),
                  monotonic: isMonotonic,
                  bracketInfo: {
                    A_lo: 1e-12,
                    A_hi: 1e-8,
                    t_A_lo: sampleResult.samples[0]?.t_s || 0,
                    t_A_hi: sampleResult.samples[sampleResult.samples.length - 1]?.t_s || 0,
                    expansions: 0
                  },
                  warnings: []
                };
              }
            } catch {}
          }
        } catch (error) {
          if (error instanceof ResidualError) {
            orifice_isothermal_failed = true;
            // Check if we should warn but not switch
            if (D_orifice) {
              const testDiag = calculateDiagnostics(inputs, D_orifice);
              const isChoked = testDiag.choked as boolean;
              
              if (isChoked) {
                isothermal_residual_marginal = true;
                warnings.push("Residual marginal; kept orifice model (isothermal).");
                // Keep the isothermal result despite residual failure
                D_orifice = (error as ResidualError).details?.D_SI_m;
              }
            }
          }
        }
      }
      
      // Fall back to iterative solver only if isothermal completely failed or regime is adiabatic
      if (!D_orifice || (orifice_isothermal_failed && !isothermal_residual_marginal)) {
        try {
          const result = solveOrificeDfromT(inputs);
          D_orifice = result.D;
          samplingData = result.sampling;
        } catch (solverError) {
          // Enrich orifice solver error with context for Filling mode
          if (validatedInputs.process === 'filling') {
            const enrichedError = solverError as any;
            const devNote = enrichedError.devNote || {};
            
            // Build comprehensive devNote for Filling DfromT failures
            enrichedError.devNote = {
              ...devNote,
              process: 'filling',
              model: 'orifice',
              t_target_s: t_target_SI,
              epsilon: validatedInputs.epsilon || 0.01,
              inputs_SI,
              bracket: {
                A_lo_m2: devNote.A_lo_m2,
                A_hi_m2: devNote.A_hi_m2,
                t_lo_s: devNote.t_lo,
                t_hi_s: devNote.t_hi,
                expansions: devNote.expansions || 0,
                bracket_expansions: samplingData?.bracketInfo?.expansions || 0
              },
              forward_check: {
                t_forward_s: devNote.t_forward_s,
                residual: devNote.residual,
                epsilon_used: devNote.epsilon_used,
                choked: undefined, // To be filled by diagnostics if available
                r_crit: undefined  // To be filled by diagnostics if available
              },
              reason: enrichedError.message || "orifice solver failed"
            };
            throw enrichedError;
          }
          throw solverError;
        }
      }
    } catch (error) {
      // Handle both isothermal and iterative solver errors
      if (error instanceof BracketError) {
        orifice_error = `Solver could not bracket the solution. Try increasing target time, widening A bounds, or set ε=1% (default).`;
      } else if (error instanceof IntegralError) {
        orifice_error = `Integral near target pressure is too stiff. Increase ε (e.g., 1–2%) or choose adiabatic=false (isothermal).`;
      } else if (typeof error === 'object' && error !== null && 'type' in error) {
        const compError = error as ComputationError;
        orifice_error = `Orifice model ${compError.type} error: ${compError.message}`;
        if (compError.suggestions && compError.suggestions.length > 0) {
          orifice_error += ` Suggestions: ${compError.suggestions.join(', ')}`;
        }
      } else {
        // For Filling mode, re-throw enriched errors
        if (validatedInputs.process === 'filling' && (error as any).devNote) {
          throw error;
        }
        orifice_error = `Orifice model failed: ${(error as Error).message}`;
      }
    }
    
    // 3) Validate model assumptions and choose the best
    let verdict: ComputeOutputs['verdict'] = 'inconclusive';
    let D: number | undefined;
    let rationale = '';
    
    // Check validity of each model with smart de-prioritization
    let cap_valid = false;
    let ori_valid = false;
    let cap_diagnostics: Record<string, number | string | boolean> = {};
    let ori_diagnostics: Record<string, number | string | boolean> = {};
    let capillary_deprioritized = false;
    
    if (D_capillary) {
      cap_diagnostics = calculateDiagnostics(inputs, D_capillary);
      const Re = cap_diagnostics.Re as number;
      const LoverD = cap_diagnostics['L/D'] as number;
      
      // Smart de-prioritization: if L/D < 10 AND Re > 5000, de-prioritize capillary
      if (LoverD < 10 && Re > 5000) {
        capillary_deprioritized = true;
        cap_valid = false; // Force orifice selection
        warnings.push(`Capillary de-prioritized: L/D=${LoverD.toFixed(1)} < 10 and Re=${Math.round(Re)} > 5000. Orifice model automatically selected.`);
      } else {
        cap_valid = Re <= 2000 && LoverD >= 10;
      }
    }
    
    if (D_orifice) {
      ori_diagnostics = calculateDiagnostics(inputs, D_orifice);
      ori_valid = true; // Orifice model is more generally applicable
      
      // If isothermal residual was marginal but we kept it, note this
      if (isothermal_residual_marginal) {
        ori_diagnostics.isothermal_marginal = true;
      }
    }
    
    if (cap_valid && ori_valid && !capillary_deprioritized) {
      // Both valid and capillary not de-prioritized
      // If orifice has isothermal marginal residual, prefer it over capillary unless clear capillary advantage
      if (isothermal_residual_marginal) {
        verdict = 'orifice';
        D = D_orifice;
        rationale = `Orifice chosen (isothermal with marginal residual but choked flow detected). ${ori_diagnostics.choked ? 'Choked' : 'Subsonic'} flow.`;
      } else {
        // Use forward simulation to pick best
        let cap_residual = Infinity;
        let ori_residual = Infinity;
        
        try {
          const cap_forward = inputs.process === 'blowdown' 
            ? orificeTfromD_blowdown({ ...inputs, D: D_capillary })
            : orificeTfromD_filling({ ...inputs, D: D_capillary });
          cap_residual = Math.abs((cap_forward - inputs.t!) / inputs.t!);
        } catch {}
        
        try {
          const ori_forward = inputs.process === 'blowdown'
            ? orificeTfromD_blowdown({ ...inputs, D: D_orifice })
            : orificeTfromD_filling({ ...inputs, D: D_orifice });
          ori_residual = Math.abs((ori_forward - inputs.t!) / inputs.t!);
        } catch {}
        
        if (cap_residual < ori_residual) {
          verdict = 'capillary';
          D = D_capillary;
          rationale = `Both models valid. Capillary chosen (lower residual: ${(cap_residual * 100).toFixed(3)}% vs ${(ori_residual * 100).toFixed(3)}%). Re=${Math.round(cap_diagnostics.Re as number)}, L/D=${Math.round(cap_diagnostics['L/D'] as number)}.`;
        } else {
          verdict = 'orifice';
          D = D_orifice;
          rationale = `Both models valid. Orifice chosen (lower residual: ${(ori_residual * 100).toFixed(3)}% vs ${(cap_residual * 100).toFixed(3)}%). ${ori_diagnostics.choked ? 'Choked' : 'Subsonic'} flow.`;
        }
      }
    } else if (cap_valid && !ori_valid && !capillary_deprioritized) {
      // Only switch to capillary if physical assumptions clearly favor it
      const Re = cap_diagnostics.Re as number;
      const LoverD = cap_diagnostics['L/D'] as number;
      const isChoked = ori_diagnostics.choked as boolean;
      
      if (!isChoked && Re <= 2000 && LoverD >= 10) {
        verdict = 'capillary';
        D = D_capillary;
        rationale = `Auto-switch to capillary: assumptions favor capillary (non-choked, Re=${Math.round(Re)} ≤ 2000, L/D=${Math.round(LoverD)} ≥ 10).`;
      } else {
        verdict = 'orifice';
        D = D_orifice;
        rationale = `Kept orifice model despite validity issues. Physical assumptions don't clearly favor capillary switch.`;
      }
    } else if ((!cap_valid && ori_valid) || (capillary_deprioritized && ori_valid)) {
      verdict = 'orifice';
      D = D_orifice;
      if (capillary_deprioritized) {
        rationale = `Orifice model chosen (capillary de-prioritized due to L/D < 10 and Re > 5000). ${ori_diagnostics.choked ? 'Choked' : 'Subsonic'} flow.`;
      } else {
        rationale = `Orifice model chosen. Capillary invalid (Re=${cap_diagnostics.Re ? Math.round(cap_diagnostics.Re as number) : 'N/A'}, L/D=${cap_diagnostics['L/D'] ? Math.round(cap_diagnostics['L/D'] as number) : 'N/A'}). ${ori_diagnostics.choked ? 'Choked' : 'Subsonic'} flow.`;
      }
    } else if (D_capillary && D_orifice) {
      verdict = 'both';
      D = D_orifice; // Default to orifice when both invalid
      rationale = `Neither model fully valid. Both results shown for comparison. Consider checking input parameters.`;
      warnings.push(`Capillary: Re=${cap_diagnostics.Re ? Math.round(cap_diagnostics.Re as number) : 'N/A'} (need ≤2000), L/D=${cap_diagnostics['L/D'] ? Math.round(cap_diagnostics['L/D'] as number) : 'N/A'} (need ≥10)`);
    } else if (D_capillary) {
      verdict = 'capillary';
      D = D_capillary;
      rationale = `Only capillary model converged. ${cap_valid ? 'Valid' : 'Invalid'} assumptions.`;
    } else if (D_orifice) {
      verdict = 'orifice';
      D = D_orifice;
      rationale = `Only orifice model converged. ${ori_diagnostics.choked ? 'Choked' : 'Subsonic'} flow.`;
    }
    
    if (!D) {
      // Build comprehensive error with all available context for Filling mode
      if (validatedInputs.process === 'filling') {
        const devNote = {
          process: 'filling',
          model: forcedModel || 'auto',
          t_target_s: t_target_SI,
          epsilon: validatedInputs.epsilon || 0.01,
          inputs_SI,
          bracket: samplingData ? {
            A_lo_m2: samplingData.bracketInfo.A_lo,
            A_hi_m2: samplingData.bracketInfo.A_hi,
            t_lo_s: samplingData.bracketInfo.t_A_lo,
            t_hi_s: samplingData.bracketInfo.t_A_hi,
            expansions: samplingData.bracketInfo.expansions,
            bracket_expansions: samplingData.bracketInfo.expansions
          } : undefined,
          forward_check: {
            t_forward_s: undefined,
            residual: undefined,
            epsilon_used: validatedInputs.epsilon || 0.01,
            choked: undefined,
            r_crit: undefined
          },
          capillary_error,
          orifice_error,
          reason: "No valid solution found"
        };
        throw { message: 'No valid solution found', devNote };
      }
      throw new Error('No valid solution found');
    }
    
    // Add model-specific errors to warnings
    if (capillary_error) warnings.push(capillary_error);
    if (orifice_error) warnings.push(orifice_error);
    
    const diagnostics = calculateDiagnostics(inputs, D);
    diagnostics.rationale = rationale;
    
    // Add bracket endpoint info to diagnostics if available
    if (samplingData) {
      diagnostics['t(A_lo)'] = samplingData.bracketInfo.t_A_lo;
      diagnostics['t(A_hi)'] = samplingData.bracketInfo.t_A_hi;
      diagnostics.expansions = samplingData.bracketInfo.expansions;
      
      // Add explicit bracket information for debugging
      diagnostics.bracket_A_lo_m2 = samplingData.bracketInfo.A_lo;
      diagnostics.bracket_A_hi_m2 = samplingData.bracketInfo.A_hi;
      diagnostics.bracket_t_lo_s = samplingData.bracketInfo.t_A_lo;
      diagnostics.bracket_t_hi_s = samplingData.bracketInfo.t_A_hi;
      diagnostics.bracket_expansions = samplingData.bracketInfo.expansions;
      
      // Add monotonicity warning if needed
      if (!samplingData.monotonic) {
        warnings.push('Sampling detected non-monotonic t(A) - results may be unreliable');
      }
      warnings.push(...samplingData.warnings);
    }
    
    // Add alternative results if both computed
    if (D_capillary && D_orifice && D_capillary !== D_orifice) {
      diagnostics.D_capillary = D_capillary;
      diagnostics.D_orifice = D_orifice;
    }
    
    // Isomorphic residual check: replay exact forward calculation
    let t_forward: number;
    let A_candidate = Math.PI * D * D / 4;
    
    try {
      // Use exact same physics as the original calculation
      if (validatedInputs.process === 'blowdown') {
        t_forward = orificeTfromD_blowdown({ ...validatedInputs, D });
      } else {
        t_forward = orificeTfromD_filling({ ...validatedInputs, D });
      }
      
      diagnostics.t_check = t_forward;
      
      // Calculate residual
      const residual = Math.abs(t_forward - validatedInputs.t!) / Math.max(validatedInputs.t!, 1e-9);
      const epsilon_verify = Math.max(validatedInputs.epsilon || 0.01, 0.01);
      
      if (residual > epsilon_verify) {
        // Try local refinement (±10% on A, 1-2 iterations)
        let bestA = A_candidate;
        let bestResidual = residual;
        let bestT = t_forward;
        
        const refinementSteps = [-0.1, 0.1, -0.05, 0.05]; // ±10%, ±5%
        
        for (let step of refinementSteps) {
          try {
            const testA = A_candidate * (1 + step);
            const testD = Math.sqrt(4 * testA / Math.PI);
            
            let testT: number;
            if (validatedInputs.process === 'blowdown') {
              testT = orificeTfromD_blowdown({ ...validatedInputs, D: testD });
            } else {
              testT = orificeTfromD_filling({ ...validatedInputs, D: testD });
            }
            
            const testResidual = Math.abs(testT - validatedInputs.t!) / Math.max(validatedInputs.t!, 1e-9);
            
            if (testResidual < bestResidual) {
              bestA = testA;
              bestResidual = testResidual;
              bestT = testT;
            }
          } catch (refineError) {
            // Skip this refinement step
            continue;
          }
        }
        
        // Update if refinement improved
        if (bestResidual < residual) {
          A_candidate = bestA;
          D = Math.sqrt(4 * A_candidate / Math.PI);
          t_forward = bestT;
          diagnostics.t_check = t_forward;
          console.info("🔧 Local refinement improved residual:", { 
            original: residual * 100, 
            refined: bestResidual * 100 
          });
        }
        
        // Final residual check after refinement
        const finalResidual = Math.abs(t_forward - validatedInputs.t!) / Math.max(validatedInputs.t!, 1e-9);
        
        if (finalResidual > epsilon_verify) {
          // Calculate correct choking information based on process
          let choking: any = {};
          if (validatedInputs.process === 'filling' && validatedInputs.Ps) {
            // Filling: use Pv/Ps (vessel pressure / supply pressure)
            const r_crit = criticalPressureRatio(validatedInputs.gas.gamma);
            const r = validatedInputs.P1 / validatedInputs.Ps; // Pv/Ps
            choking = { r_crit, choked: r < r_crit, r, ratio_type: 'Pv/Ps' };
          } else if (validatedInputs.process === 'blowdown') {
            // Blowdown: use downstream/upstream
            const r_crit = criticalPressureRatio(validatedInputs.gas.gamma);
            const r = validatedInputs.P2 / validatedInputs.P1; // Pdown/Pup
            choking = { r_crit, choked: r < r_crit, r, ratio_type: 'Pdown/Pup' };
          }
          
          console.warn(`⚠️ High residual after refinement: ${(finalResidual*100).toFixed(2)}% > ${(epsilon_verify*100).toFixed(1)}%`, {
            t_computed: t_forward,
            t_target: validatedInputs.t,
            residual: finalResidual,
            choking,
            D,
            verdict
          });
          
          warnings.push(`Final residual ${(finalResidual*100).toFixed(2)}% > ${(epsilon_verify*100).toFixed(1)}% tolerance`);
        }
      }
      
    } catch (verificationError) {
      console.error("❌ Forward verification failed:", verificationError);
      diagnostics.t_check = 'verification_failed';
    }
    
    const modelWarnings = generateWarnings(diagnostics, inputs);
    
    // Create explicit SI solver result
    const A_SI_m2 = D ? Math.PI * Math.pow(D, 2) / 4 : undefined;
    const t_SI_s = typeof diagnostics.t_check === 'number' ? diagnostics.t_check : undefined;
    
    const solverResultSI: SolverResultSI = {
      model: verdict === 'capillary' ? 'capillary' : 'orifice',
      A_SI_m2,
      D_SI_m: D,
      t_SI_s,
      diag: { ...diagnostics },
      warnings: [...warnings, ...modelWarnings]
    };
    
    return {
      D,
      verdict,
      diagnostics,
      warnings: [...warnings, ...modelWarnings],
      sampling: samplingData,
      solverResultSI,
    };
    
  } catch (error) {
    let computationError: ComputationError;
    
    if (error instanceof BracketError || error instanceof IntegralError || error instanceof ResidualError) {
      computationError = {
        type: error.type,
        message: error.message,
        details: error.details,
        suggestions: error.suggestions || []
      };
    } else if (typeof error === 'object' && error !== null && 'message' in error) {
      // Handle errors thrown with { message, devNote } format
      if ('devNote' in error) {
        computationError = {
          type: 'residual',
          message: error.message as string,
          details: error.devNote,
          suggestions: ['Check residual tolerance settings or try different model parameters']
        };
      } else {
        computationError = error as ComputationError;
      }
    } else {
      computationError = {
        type: 'model',
        message: (error as Error).message,
        suggestions: ['Check input parameters and model assumptions']
      };
    }
    
    return {
      verdict: 'inconclusive',
      diagnostics: { rationale: `Computation failed: ${computationError.message}` },
      warnings: [`Computation failed: ${computationError.message}`],
      error: computationError,
    };
  }
}

/**
 * Main compute function for time from diameter
 */
export function computeTfromD(inputs: ComputeInputs): ComputeOutputs {
  try {
    let t_capillary: number | undefined;
    let t_orifice: number | undefined;
    const warnings: string[] = [];
    let capillary_error: string | undefined;
    let orifice_error: string | undefined;
    
    // 1) Compute t_cap via capillary model
    try {
      if (inputs.process === 'filling') {
        t_capillary = capillaryTfromD_filling(inputs);
      } else {
        t_capillary = capillaryTfromD_blowdown(inputs);
      }
    } catch (error) {
      capillary_error = `Capillary model failed: ${(error as Error).message}`;
    }
    
    // 2) Compute t_orif via orifice model
    try {
      if (inputs.process === 'blowdown') {
        t_orifice = orificeTfromD_blowdown(inputs);
      } else {
        t_orifice = orificeTfromD_filling(inputs);
      }
    } catch (error) {
      orifice_error = `Orifice model failed: ${(error as Error).message}`;
    }
    
    // 3) Validate model assumptions and choose the best
    let verdict: ComputeOutputs['verdict'] = 'inconclusive';
    let t: number | undefined;
    let rationale = '';
    
    // Check validity of each model with smart de-prioritization
    let cap_valid = false;
    let ori_valid = false;
    const diagnostics = calculateDiagnostics(inputs, inputs.D!);
    let capillary_deprioritized = false;
    
    if (t_capillary) {
      const Re = diagnostics.Re as number;
      const LoverD = diagnostics['L/D'] as number;
      
      // Smart de-prioritization: if L/D < 10 AND Re > 5000, de-prioritize capillary
      if (LoverD < 10 && Re > 5000) {
        capillary_deprioritized = true;
        cap_valid = false; // Force orifice selection
        warnings.push(`Capillary de-prioritized: L/D=${LoverD.toFixed(1)} < 10 and Re=${Math.round(Re)} > 5000. Orifice model automatically selected.`);
      } else {
        cap_valid = Re <= 2000 && LoverD >= 10;
      }
    }
    
    if (t_orifice) {
      ori_valid = true; // Orifice model is more generally applicable
    }
    
    // Check if model is forced via modelSelection
    const forcedModel = inputs.modelSelection;
    
    // Handle forced model selection first
    if (forcedModel) {
      if (forcedModel === 'capillary') {
        if (t_capillary !== undefined) {
          verdict = 'capillary';
          t = t_capillary;
          rationale = `Capillary model used (forced by user selection). Re=${Math.round(diagnostics.Re as number)}, L/D=${Math.round(diagnostics['L/D'] as number)}.`;
          
          // Still check validity for warnings
          if (!cap_valid || capillary_deprioritized) {
            warnings.push(`Warning: Capillary model may not be optimal for this case (Re=${Math.round(diagnostics.Re as number)}, L/D=${Math.round(diagnostics['L/D'] as number)})`);
          }
        } else {
          throw new Error(`Capillary model failed: ${capillary_error || 'No result computed'}`);
        }
      } else if (forcedModel === 'orifice') {
        if (t_orifice !== undefined) {
          verdict = 'orifice';
          t = t_orifice;
          rationale = `Orifice model used (forced by user selection). ${diagnostics.choked ? 'Choked' : 'Subsonic'} flow.`;
        } else {
          throw new Error(`Orifice model failed: ${orifice_error || 'No result computed'}`);
        }
      }
    } else {
      // Auto-selection logic
      if (cap_valid && ori_valid && !capillary_deprioritized) {
        // Both valid - use the one with lower relative error
        const rel_error_cap = Math.abs(t_capillary! - t_orifice!) / Math.max(t_capillary!, t_orifice!);
        
        if (rel_error_cap < 0.05) { // <5% difference
          verdict = 'both';
          t = t_orifice; // Default to orifice when close
          rationale = `Both models agree within 5%. Re=${Math.round(diagnostics.Re as number)}, L/D=${Math.round(diagnostics['L/D'] as number)}.`;
        } else {
          // Pick based on physical assumptions
          const Re = diagnostics.Re as number;
          const LoverD = diagnostics['L/D'] as number;
          
          if (Re <= 1000 && LoverD >= 20) {
            verdict = 'capillary';
            t = t_capillary;
            rationale = `Capillary chosen (ideal conditions: Re=${Math.round(Re)} ≤ 1000, L/D=${Math.round(LoverD)} ≥ 20).`;
          } else {
            verdict = 'orifice';
            t = t_orifice;
            rationale = `Orifice chosen (general applicability). ${diagnostics.choked ? 'Choked' : 'Subsonic'} flow.`;
          }
        }
      } else if (cap_valid && !ori_valid && !capillary_deprioritized) {
        verdict = 'capillary';
        t = t_capillary;
        rationale = `Capillary model valid. Re=${Math.round(diagnostics.Re as number)}, L/D=${Math.round(diagnostics['L/D'] as number)}.`;
      } else if ((!cap_valid && ori_valid) || (capillary_deprioritized && ori_valid)) {
        verdict = 'orifice';
        t = t_orifice;
        if (capillary_deprioritized) {
          rationale = `Orifice chosen (capillary de-prioritized). ${diagnostics.choked ? 'Choked' : 'Subsonic'} flow.`;
        } else {
          rationale = `Orifice chosen (capillary invalid). ${diagnostics.choked ? 'Choked' : 'Subsonic'} flow.`;
        }
      } else if (t_capillary && t_orifice) {
        verdict = 'both';
        t = t_orifice; // Default to orifice when both invalid
        rationale = `Neither model fully valid. Results shown for comparison.`;
      } else if (t_capillary) {
        verdict = 'capillary';
        t = t_capillary;
        rationale = `Only capillary converged. ${cap_valid ? 'Valid' : 'Invalid'} assumptions.`;
      } else if (t_orifice) {
        verdict = 'orifice';
        t = t_orifice;
        rationale = `Only orifice converged. ${diagnostics.choked ? 'Choked' : 'Subsonic'} flow.`;
      }
    }
    
    if (!t) {
      throw new Error('No valid solution found');
    }
    
    // Add model-specific errors to warnings
    if (capillary_error) warnings.push(capillary_error);
    if (orifice_error) warnings.push(orifice_error);
    
    diagnostics.rationale = rationale;
    
    // Add alternative results if both computed
    if (t_capillary && t_orifice && t_capillary !== t_orifice) {
      diagnostics.t_capillary = t_capillary;
      diagnostics.t_orifice = t_orifice;
    }
    
    const modelWarnings = generateWarnings(diagnostics, inputs);
    
    // Create explicit SI solver result
    const A_SI_m2 = Math.PI * Math.pow(inputs.D!, 2) / 4;
    
    const solverResultSI: SolverResultSI = {
      model: verdict === 'capillary' ? 'capillary' : 'orifice',
      A_SI_m2,
      D_SI_m: inputs.D,
      t_SI_s: t,
      diag: { ...diagnostics },
      warnings: [...warnings, ...modelWarnings]
    };
    
    return {
      t,
      verdict,
      diagnostics,
      warnings: [...warnings, ...modelWarnings],
      solverResultSI,
    };
    
  } catch (error) {
    let computationError: ComputationError;
    
    if (error instanceof BracketError || error instanceof IntegralError || error instanceof ResidualError) {
      computationError = {
        type: error.type,
        message: error.message,
        details: error.details,
        suggestions: error.suggestions || []
      };
    } else {
      computationError = {
        type: 'model',
        message: (error as Error).message,
        suggestions: ['Check input parameters and model assumptions']
      };
    }
    
    return {
      verdict: 'inconclusive',
      diagnostics: { rationale: `Computation failed: ${computationError.message}` },
      warnings: [`Computation failed: ${computationError.message}`],
      error: computationError,
    };
  }
}
