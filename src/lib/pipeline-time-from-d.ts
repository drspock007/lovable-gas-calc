import { toSI_Length } from "@/lib/length-units";
import { areaFromDiameterSI } from "@/lib/geometry";
import { timeOrificeFromAreaSI, timeCapillaryFromAreaSI } from "@/lib/physics";

export type TimeFromDResult = { D_SI_m:number; A_SI_m2:number; t_SI_s:number; model:"orifice"|"capillary" };

export function computeTimeFromDiameter(ui:any): TimeFromDResult {
  const D_raw = Number(String(ui.diameter).replace(/\s/g,"").replace(",","."));
  const D_SI  = toSI_Length(D_raw, ui.diameterUnit);             // m (mm→m etc.)
  if (!Number.isFinite(D_SI) || D_SI<=0) throw new Error("Invalid diameter");

  const A_SI  = areaFromDiameterSI(D_SI);                         // πD²/4 (sans Cd)
  const model: "orifice"|"capillary" = ui.modelOverride ?? ui.model ?? "orifice";

  const t_SI = model === "orifice"
    ? timeOrificeFromAreaSI(ui.__SI__, A_SI)                      // même forward que D→t
    : timeCapillaryFromAreaSI(ui.__SI__, A_SI);

  return { D_SI_m:D_SI, A_SI_m2:A_SI, t_SI_s:t_SI, model };
}