import { parseDecimalLoose } from "@/lib/num-parse";
import { toSI_Length } from "@/lib/length-units";
import { areaFromDiameterSI } from "@/lib/geometry";
import { timeOrificeFromAreaSI, timeCapillaryFromAreaSI } from "@/lib/physics";

export function computeTimeFromDiameter(ui: any) {
  const raw = ui?.diameter;
  const unit = ui?.diameterUnit;
  const parsed = parseDecimalLoose(raw);
  const D_SI = toSI_Length(parsed, unit);
  if (ui?.debug) console.info("[TimeFromD] raw:", raw, "unit:", unit, "parsed:", parsed, "D_SI:", D_SI);

  // Error handling
  if (!Number.isFinite(D_SI) || D_SI <= 0) {
    const debugNote = { 
      diameterRaw: raw, 
      diameterUnit: unit, 
      parsed, 
      D_SI_m: D_SI,
      error: "Invalid diameter: NaN or ≤0" 
    };
    if (ui?.debug) {
      console.warn("🔴 Time from Diameter - Invalid diameter:", debugNote);
    }
    throw { message: "Invalid diameter", devNote: debugNote };
  }

  const A_SI = areaFromDiameterSI(D_SI);
  const model = ui.modelOverride ?? ui.model ?? "orifice";
  const t_SI = model === "orifice"
    ? timeOrificeFromAreaSI(ui.__SI__, A_SI)
    : timeCapillaryFromAreaSI(ui.__SI__, A_SI);

  // Debug logging
  if (ui?.debug) {
    console.info("🔵 Time from Diameter - Pipeline:", {
      diameterRaw: raw,
      diameterUnit: unit,
      parsed,
      D_SI_m: D_SI,
      A_SI_m2: A_SI,
      model,
      t_SI_s: t_SI
    });
  }

  // Build debug note with all key data
  const debugNote = ui?.debug ? {
    diameterRaw: raw,
    diameterUnit: unit,
    parsed,
    D_SI_m: D_SI,
    A_SI_m2: A_SI,
    model,
    t_SI_s: t_SI,
    inputs_SI: ui.__SI__,
    success: true
  } : undefined;

  return {
    model,
    D_SI_m: D_SI,
    A_SI_m2: A_SI,
    t_SI_s: t_SI,
    debugNote
  };
}