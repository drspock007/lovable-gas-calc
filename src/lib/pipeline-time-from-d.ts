import { parseDecimalLoose } from "@/lib/num-parse";
import { toSI_Length } from "@/lib/length-units";
import { areaFromDiameterSI } from "@/lib/geometry";
import { timeOrificeFromAreaSI, timeCapillaryFromAreaSI } from "@/lib/physics";

export type TimeFromDResult = { D_SI_m:number; A_SI_m2:number; t_SI_s:number; model:"orifice"|"capillary" };

export function computeTimeFromDiameter(ui: any): TimeFromDResult {
  const D_raw = parseDecimalLoose(ui.diameter);       // "0.005" -> 0.005
  const D_SI  = toSI_Length(D_raw, ui.diameterUnit);  // mm -> m

  // 🩺 Debug visible dans la console ET dans le panneau Dev
  if (ui?.debug) {
    console.info("[TimeFromD] raw:", ui.diameter,
      "unit:", ui.diameterUnit,
      "parsed:", D_raw,
      "D_SI(m):", D_SI);
  }

  // Ne rejette que si NaN ou ≤0 (mais après log)
  if (!Number.isFinite(D_SI) || D_SI <= 0) {
    throw new Error("Invalid diameter");
  }

  const A_SI = areaFromDiameterSI(D_SI);              // π D² / 4 (sans Cd)
  const model = ui.modelOverride ?? ui.model ?? "orifice";
  const t_SI = model === "orifice"
    ? timeOrificeFromAreaSI(ui.__SI__, A_SI)
    : timeCapillaryFromAreaSI(ui.__SI__, A_SI);

  return { D_SI_m: D_SI, A_SI_m2: A_SI, t_SI_s: t_SI, model };
}