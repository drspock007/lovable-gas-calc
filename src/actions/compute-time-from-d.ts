/**
 * Compute time from diameter action
 * Uses unified SI conversion and pipeline approach
 */

import { buildSI } from "@/lib/build-si";
import { computeTimeFromDiameter } from "@/lib/pipeline-time-from-d";

/**
 * Compute time from diameter using pipeline approach
 * @param ui UI input values
 * @returns Result with time, diameter, area, model, and validation check
 */
export async function computeTimeFromD(ui: any) {
  const SI = buildSI(ui);
  
  // Garde Filling AVANT le forward Time-from-D (orifice)
  if (ui.process === "filling") {
    if (!(SI.Ps_Pa > SI.Pf_Pa && SI.Pf_Pa > SI.P1_Pa && SI.P1_Pa > 0)) {
      throw { 
        message: "Invalid filling inequalities (require Ps_abs > Pf_abs > P1_abs > 0)",
        devNote: { 
          process: "filling", 
          inputs_SI: { Ps_Pa: SI.Ps_Pa, Pf_Pa: SI.Pf_Pa, P1_Pa: SI.P1_Pa } 
        } 
      };
    }
  }
  
  const res = computeTimeFromDiameter({ 
    ...ui, 
    __SI__: SI, 
    model: ui.modelSelection ?? ui.model, 
    debug: ui.debug,
    expandFactor: ui.expandFactor,
    retryContext: ui.retryContext
  });
  
  // Optional: residual (replay t(A*)) for transparency  
  const t_check = res.t_SI_s; // same engine, so equal here
  
  return { ...res, t_check, SI };
}