import { toSI_Length } from "@/lib/length-units";
import { areaFromDiameterSI } from "@/lib/geometry";
import { timeOrificeFromAreaSI, timeCapillaryFromAreaSI } from "@/lib/physics";

export type TimeFromDResult = {
  D_SI_m: number;
  A_SI_m2: number;
  t_SI_s: number;
  model: "orifice" | "capillary";
};

export function timeFromDiameterPipeline(ui: any): TimeFromDResult {
  // 1) Diamètre UI -> SI
  const D_raw = Number(String(ui.diameter).replace(/\s/g, "").replace(",", "."));
  const D_SI = toSI_Length(D_raw, ui.diameterUnit); // m
  if (!Number.isFinite(D_SI) || D_SI <= 0) throw new Error("Invalid diameter");

  // 2) Aire géométrique (aucun Cd dedans)
  const A_SI = areaFromDiameterSI(D_SI); // π D² / 4

  // 3) Choix du modèle et forward time avec le MÊME moteur que le résiduel
  const model: "orifice" | "capillary" = ui.model ?? "orifice";
  const t_SI =
    model === "orifice"
      ? timeOrificeFromAreaSI(ui.__SI__, A_SI)
      : timeCapillaryFromAreaSI(ui.__SI__, A_SI);

  return { D_SI_m: D_SI, A_SI_m2: A_SI, t_SI_s: t_SI, model };
}