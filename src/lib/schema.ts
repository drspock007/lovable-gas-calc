import { z } from "zod";
import { toSI_Pressure, absFromGauge, patmFromAltitude } from "@/lib/pressure-units";

const pressureField = z.object({
  value: z.string().min(1),          // on garde la chaîne brute
  unit: z.enum(["Pa","kPa","bar","MPa"])
});

export const formSchema = z.object({
  pressureInputMode: z.enum(["absolute","gauge"]),
  patmMode: z.enum(["standard","custom","altitude"]).default("standard"),
  patmValue: pressureField.optional(),
  altitude_m: z.union([z.number(), z.string()]).optional(),

  process: z.enum(["blowdown","filling"]),
  P1: pressureField,
  P2: pressureField,
  Ps: pressureField.optional(),
  // ... autres champs
  
  // Other common fields
  V: z.object({
    value: z.string().min(1),
    unit: z.enum(["m3","L","liter","ft3","mm3"])
  }),
  T: z.object({
    value: z.string().min(1),
    unit: z.enum(["kelvin","celsius","fahrenheit"])
  }),
  L: z.object({
    value: z.string().min(1),
    unit: z.enum(["m","mm","inch"])
  }),
  D: z.object({
    value: z.string().min(1),
    unit: z.enum(["m","mm","inch"])
  }).optional(),
  t: z.object({
    value: z.string().min(1),
    unit: z.enum(["second","minute","hour"])
  }).optional(),
  
  gasType: z.string(),
  regime: z.enum(["isothermal","adiabatic"]).default("isothermal"),
  Cd: z.number().min(0.1).max(1.0).default(0.62),
  epsilon: z.number().min(0.001).max(0.1).default(0.01),
  
}).superRefine((data, ctx) => {
  const parse = (s: string) => {
    const n = Number((s ?? "").toString().replace(/\s/g,"").replace(",","."));
    return Number.isFinite(n) ? n : NaN;
  };

  const Patm_SI =
    data.patmMode === "standard" ? 101_325 :
    data.patmMode === "custom"   ? toSI_Pressure(parse(data.patmValue?.value ?? "101.325"), (data.patmValue?.unit ?? "kPa") as any) :
                                   patmFromAltitude(parse(data.altitude_m as any ?? "0"));

  const toAbsSI = (valStr: string, unit: string) => {
    const v = toSI_Pressure(parse(valStr), unit as any);
    return data.pressureInputMode === "gauge" ? absFromGauge(v, Patm_SI) : v;
  };

  const P1_abs = toAbsSI(data.P1.value, data.P1.unit);
  const P2_abs = toAbsSI(data.P2.value, data.P2.unit);

  // Mode gauge : P2_g peut être 0 (atmosphère) et même négatif jusqu'au vide
  if (data.pressureInputMode === "gauge") {
    const P2_g_SI = toSI_Pressure(parse(data.P2.value), data.P2.unit as any);
    if (!Number.isFinite(P2_g_SI)) {
      ctx.addIssue({ code:"custom", path:["P2","value"], message:"Invalid gauge pressure" });
    }
    // Interdit juste en dessous du vide (≈ -Patm)
    if (P2_g_SI < -Patm_SI + 1) {
      ctx.addIssue({ code:"custom", path:["P2","value"], message:"Gauge below vacuum" });
    }
    // *** NE PAS exiger > 0 : 0 g est valide ***
  } else {
    if (!(P2_abs > 1)) {
      ctx.addIssue({ code:"custom", path:["P2","value"], message:"Absolute pressure must be > 0" });
    }
  }

  // Gardes physiques sur l'ABSOLU
  if (data.process === "blowdown") {
    if (!(P1_abs > 1 && P2_abs > 1 && P1_abs > P2_abs)) {
      ctx.addIssue({ code:"custom", path:["P1","value"], message:"For blowdown, P1 must exceed P2 (absolute)" });
    }
  } else {
    // Filling : Ps requis
    if (!data.Ps?.value) {
      ctx.addIssue({ code:"custom", path:["Ps","value"], message:"Supply pressure required in filling mode" });
      return;
    }
    const Ps_abs = toAbsSI(data.Ps.value, data.Ps.unit);
    if (!(Ps_abs > 1 && P1_abs > 1 && P2_abs > 1 && Ps_abs > P1_abs && P2_abs > P1_abs)) {
      ctx.addIssue({ code:"custom", path:["Ps","value"], message:"For filling, Ps>P1 and P2>P1 (absolute)" });
    }
  }
});

export type FormData = z.infer<typeof formSchema>;
