import { z } from "zod";
import { toSI_Pressure, absFromGauge, patmFromAltitude } from "@/lib/pressure-units";

const pressureField = z.object({
  value: z.string().min(1),      // keep raw string; parse later
  unit: z.enum(["Pa","kPa","bar","MPa"])
});

export const formSchema = z.object({
  pressureInputMode: z.enum(["absolute","gauge"]),
  patmMode: z.enum(["standard","custom","altitude"]).default("standard"),
  patmValue: pressureField.optional(),  // if custom
  altitude_m: z.number().optional(),

  process: z.enum(["blowdown","filling"]),
  P1: pressureField,
  P2: pressureField,
  Ps: pressureField.optional(), // for filling
  
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
  // Parse helper (allow , as decimal)
  const parse = (s: string) => {
    const n = Number(s.replace(/\s/g,"").replace(",","."));
    return Number.isFinite(n) ? n : NaN;
  };

  const u = data.P1.unit;
  const Patm_SI =
    data.patmMode === "standard" ? 101325 :
    data.patmMode === "custom"   ? toSI_Pressure(parse(data.patmValue?.value ?? "101.325"), data.patmValue?.unit ?? "kPa") :
                                   patmFromAltitude(data.altitude_m ?? 0);

  const toAbsSI = (valStr: string, unit: any) => {
    const v = toSI_Pressure(parse(valStr), unit);
    if (!Number.isFinite(v)) return NaN;
    return data.pressureInputMode === "gauge" ? absFromGauge(v, Patm_SI) : v;
  };

  const P1_abs = toAbsSI(data.P1.value, data.P1.unit);
  const P2_abs = toAbsSI(data.P2.value, data.P2.unit);
  const Ps_abs = data.Ps ? toAbsSI(data.Ps.value, data.Ps.unit) : undefined;

  // Field-level constraints:
  // Gauge mode: allow P2_g >= 0 (to atmosphere). Allow negative down to vacuum.
  if (data.pressureInputMode === "gauge") {
    const P1_g = toSI_Pressure(parse(data.P1.value), data.P1.unit);
    const P2_g = toSI_Pressure(parse(data.P2.value), data.P2.unit);
    
    if (!Number.isFinite(P1_g)) {
      ctx.addIssue({ code:"custom", path:["P1","value"], message:"Invalid gauge pressure" });
    } else if (P1_g < -Patm_SI + 200) {
      ctx.addIssue({ code:"custom", path:["P1","value"], message:"P1 gauge below vacuum limit" });
    }
    
    if (!Number.isFinite(P2_g)) {
      ctx.addIssue({ code:"custom", path:["P2","value"], message:"Invalid gauge pressure" });
    } else if (P2_g < -Patm_SI + 200) {
      ctx.addIssue({ code:"custom", path:["P2","value"], message:"P2 gauge below vacuum limit" });
    }
    // IMPORTANT: DO NOT require P2_g > 0 — zero is valid (atmosphere).
    
    if (data.Ps) {
      const Ps_g = toSI_Pressure(parse(data.Ps.value), data.Ps.unit);
      if (!Number.isFinite(Ps_g)) {
        ctx.addIssue({ code:"custom", path:["Ps","value"], message:"Invalid gauge pressure" });
      } else if (Ps_g < -Patm_SI + 200) {
        ctx.addIssue({ code:"custom", path:["Ps","value"], message:"Ps gauge below vacuum limit" });
      }
    }
  } else {
    // Absolute mode
    if (!Number.isFinite(P1_abs) || P1_abs <= 1) {
      ctx.addIssue({ code:"custom", path:["P1","value"], message:"Absolute pressure must be > 0" });
    }
    if (!Number.isFinite(P2_abs) || P2_abs <= 1) {
      ctx.addIssue({ code:"custom", path:["P2","value"], message:"Absolute pressure must be > 0" });
    }
    if (data.Ps && (!Number.isFinite(Ps_abs!) || Ps_abs! <= 1)) {
      ctx.addIssue({ code:"custom", path:["Ps","value"], message:"Absolute pressure must be > 0" });
    }
  }

  // Cross-field physics guard (on ABSOLUTE):
  if (Number.isFinite(P1_abs) && Number.isFinite(P2_abs)) {
    if (data.process === "blowdown" && !(P1_abs > P2_abs)) {
      ctx.addIssue({ 
        code:"custom", 
        path:["P1","value"], 
        message:`For blowdown, P1 must be greater than P2 (absolute). P1=${(P1_abs/1000).toFixed(1)} kPa ≤ P2=${(P2_abs/1000).toFixed(1)} kPa` 
      });
    }
    if (data.process === "filling" && Ps_abs !== undefined) {
      if (!(P2_abs > P1_abs)) {
        ctx.addIssue({ 
          code:"custom", 
          path:["P2","value"], 
          message:`For filling, P2 must be greater than P1 (absolute). P2=${(P2_abs/1000).toFixed(1)} kPa ≤ P1=${(P1_abs/1000).toFixed(1)} kPa` 
        });
      }
      if (!(Ps_abs > P2_abs)) {
        ctx.addIssue({ 
          code:"custom", 
          path:["Ps","value"], 
          message:`For filling, Ps must exceed P2 (absolute). Ps=${(Ps_abs/1000).toFixed(1)} kPa ≤ P2=${(P2_abs/1000).toFixed(1)} kPa` 
        });
      }
    }
  }

  // Additional field validations
  const V_val = parse(data.V.value);
  if (!Number.isFinite(V_val) || V_val <= 0) {
    ctx.addIssue({ code:"custom", path:["V","value"], message:"Volume must be positive" });
  }

  const T_val = parse(data.T.value);
  if (!Number.isFinite(T_val)) {
    ctx.addIssue({ code:"custom", path:["T","value"], message:"Invalid temperature" });
  } else {
    // Convert to Kelvin for validation
    const T_K = data.T.unit === "celsius" ? T_val + 273.15 :
                data.T.unit === "fahrenheit" ? (T_val - 32) * 5/9 + 273.15 :
                T_val;
    if (T_K <= 0) {
      ctx.addIssue({ code:"custom", path:["T","value"], message:"Temperature must be above absolute zero" });
    }
  }

  const L_val = parse(data.L.value);
  if (!Number.isFinite(L_val) || L_val <= 0) {
    ctx.addIssue({ code:"custom", path:["L","value"], message:"Length must be positive" });
  }

  if (data.D) {
    const D_val = parse(data.D.value);
    if (!Number.isFinite(D_val) || D_val <= 0) {
      ctx.addIssue({ code:"custom", path:["D","value"], message:"Diameter must be positive" });
    }
  }

  if (data.t) {
    const t_val = parse(data.t.value);
    if (!Number.isFinite(t_val) || t_val <= 0) {
      ctx.addIssue({ code:"custom", path:["t","value"], message:"Time must be positive" });
    }
  }

  // Custom atmospheric pressure validation
  if (data.patmMode === "custom" && data.patmValue) {
    const patm_val = parse(data.patmValue.value);
    if (!Number.isFinite(patm_val) || patm_val <= 0) {
      ctx.addIssue({ code:"custom", path:["patmValue","value"], message:"Atmospheric pressure must be positive" });
    }
  }

  // Altitude validation
  if (data.patmMode === "altitude" && data.altitude_m !== undefined) {
    if (!Number.isFinite(data.altitude_m) || data.altitude_m < 0 || data.altitude_m > 11000) {
      ctx.addIssue({ code:"custom", path:["altitude_m"], message:"Altitude must be between 0 and 11000 m (ISA limit)" });
    }
  }
});

export type FormData = z.infer<typeof formSchema>;
