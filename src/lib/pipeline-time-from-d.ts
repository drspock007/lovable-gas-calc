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

  if (!Number.isFinite(D_SI) || D_SI <= 0) {
    const note = { diameterRaw: raw, diameterUnit: unit, parsed, D_SI };
    if (ui?.debug) console.warn("[TimeFromD ERROR]", note);
    const err: any = new Error("Invalid diameter");
    (err.devNote = note);
    throw err;
  }

  const A_SI = areaFromDiameterSI(D_SI);
  const model = ui.modelOverride ?? ui.model ?? "orifice";
  const t_SI = model === "orifice"
    ? timeOrificeFromAreaSI(ui.__SI__, A_SI)
    : timeCapillaryFromAreaSI(ui.__SI__, A_SI);

  return {
    D_SI_m: D_SI,
    A_SI_m2: A_SI,
    t_SI_s: t_SI,
    model,
    debugNote: { diameterRaw: raw, diameterUnit: unit, parsed, D_SI_m: D_SI, A_SI_m2: A_SI, model, t_SI_s: t_SI }
  };
}