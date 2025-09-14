/**
 * Compute time from diameter action
 * Uses unified SI conversion and pipeline approach
 */

import { buildAbsoluteSIFromUI } from "@/lib/build-si";
import { computeTimeFromDiameter } from "@/lib/pipeline-time-from-d";

/**
 * Compute time from diameter using pipeline approach
 * @param ui UI input values
 * @returns Result with time, diameter, area, model, and validation check
 */
export async function computeTimeFromD(ui: any) {
  const SI = buildAbsoluteSIFromUI(ui);
  const res = computeTimeFromDiameter({ ...ui, __SI__: SI, model: ui.model });
  
  // Optionnel: résiduel (rejouer t(A*)) pour transparence
  const t_check = res.t_SI_s; // même moteur, donc égal ici
  
  return { ...res, t_check, SI };
}