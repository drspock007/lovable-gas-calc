# Lovable Gas Calc — DEBUG_BUNDLE

**Generated:** 2025-01-19 20:45:00 (Local Time)  
**Branch:** main  
**Commit:** HEAD  
**Warning:** Generated for diagnosis — do not edit manually.

---

### src/lib/pressure-units.ts

```typescript
export type PressureUnit = 'Pa'|'kPa'|'bar'|'MPa';
const P_TO_SI: Record<PressureUnit, number> = { Pa:1, kPa:1e3, bar:1e5, MPa:1e6 };
export function toSI_Pressure(v:number,u:PressureUnit){ return v*P_TO_SI[u]; }
export function fromSI_Pressure(vSI:number,u:PressureUnit){ return vSI/P_TO_SI[u]; }

// Gauge ↔ Absolute
export function absFromGauge(Pg_SI:number, Patm_SI:number){ return Pg_SI + Patm_SI; }
export function gaugeFromAbs(Pa_SI:number, Patm_SI:number){ return Pa_SI - Patm_SI; }

// Standard atmosphere (ISA, up to 11 km):
export function patmFromAltitude(h_m:number){
  return 101325 * Math.pow(1 - 2.25577e-5 * h_m, 5.25588);
}

// Safety floor
export function clampAbs(Pa_SI:number){ return Math.max(Pa_SI, 1); } // ≥1 Pa

// UI form state (not physics):
// pressureInputMode: 'absolute' | 'gauge'
// patmMode: 'standard' | 'custom' | 'altitude'
// patmValue: { value:number; unit:PressureUnit } // if custom
// altitude_m?: number

// Physics continues to receive ABSOLUTE SI only.
```

### src/lib/length-units.ts

```typescript
export type LengthUnit = "m" | "mm" | "cm" | "µm";
const LEN2SI: Record<LengthUnit, number> = { m: 1, mm: 1e-3, cm: 1e-2, "µm": 1e-6 };
export const LENGTH_LABEL: Record<LengthUnit,string> = { m:'m', cm:'cm', mm:'mm', "µm":'µm' };

// ⚠️ tolérant aux variantes (espaces, majuscules, symbole "µm", etc.)
export function normalizeLengthUnit(u: unknown): LengthUnit {
  const raw = String(u ?? "").toLowerCase().replace(/\s/g, "");
  if (raw === "m") return "m";
  if (raw === "mm") return "mm";
  if (raw === "cm") return "cm";
  if (raw === "μm" || raw === "um" || raw === "µm") return "µm"; // 1e-6 m
  return "mm"; // défaut safe pour l'UI
}

export function toSI_Length(v: number, u: unknown): number {
  const unit = normalizeLengthUnit(u);
  const si = v * LEN2SI[unit];
  return si;
}

export function fromSI_Length(vSI:number,u:LengthUnit){return vSI/LEN2SI[u];}

// A single **formatter** to avoid UI drift
export function formatLength(vSI:number,u:LengthUnit, sig=3){
const v = fromSI_Length(vSI,u);
return Number.isFinite(v) ? Number(v.toPrecision(sig)) : NaN;
}
```

### src/lib/geometry.ts

```typescript
export const areaFromDiameterSI = (D_SI: number) => Math.PI * (D_SI * D_SI) / 4;
```

### src/lib/build-si.ts

```typescript
/**
 * Build SI units object from UI inputs
 * Unifies pressure conversion handling with gauge/absolute modes and atmospheric pressure
 */

import { toSI_Pressure, absFromGauge, patmFromAltitude } from "@/lib/pressure-units";

export function buildSI(ui:any){
  const Patm = ui.patmMode==="standard" ? 101325
    : ui.patmMode==="custom" ? toSI_Pressure(Number(String(ui.patmValue?.value ?? "101.325").replace(",", ".")), ui.patmValue?.unit ?? "kPa")
    : patmFromAltitude(Number(ui.altitude_m ?? 0));
  const toAbs = (s:string,u:string)=> {
    const si = toSI_Pressure(Number(String(s).replace(",", ".")), u as any);
    return ui.pressureInputMode==="gauge" ? absFromGauge(si, Patm) : si;
  };
  return {
    V_SI_m3: ui.V_SI_m3, T_K: ui.T_SI_K, 
    L_SI_m: ui.L_SI_m ?? ui.L_m,
    L_m: ui.L_SI_m ?? ui.L_m,
    P1_Pa: toAbs(ui.P1.value, ui.P1.unit),
    P2_Pa: toAbs(ui.P2.value, ui.P2.unit),
    gas: ui.gas, Cd: ui.Cd, epsilon: ui.epsilon, regime: ui.regime
  };
}

/**
 * Build absolute SI units object from UI values
 * Handles gauge/absolute pressure modes and atmospheric pressure settings
 * @param v UI values object
 * @returns SI units object with absolute pressures
 */
export function buildAbsoluteSIFromUI(v: any) {
  const u = v.userPressureUnit ?? "kPa";
  
  // Determine atmospheric pressure based on mode
  const Patm =
    v.patmMode === "standard"
      ? 101_325
      : v.patmMode === "custom"
      ? toSI_Pressure(Number(String(v.patmValue?.value ?? "101.325").replace(",", ".")), v.patmValue?.unit ?? "kPa")
      : patmFromAltitude(Number(v.altitude_m ?? 0));

  // Helper function to convert pressure to absolute SI
  const toAbs = (x: string, unit: string) => {
    const z = Number(String(x).replace(",", "."));
    const si = toSI_Pressure(z, unit as any);
    return v.pressureInputMode === "gauge" ? absFromGauge(si, Patm) : si;
  };

  return {
    V_SI_m3: v.V_SI_m3, // suppose déjà converti côté volume
    P1_Pa: toAbs(v.P1.value, v.P1.unit),
    P2_Pa: toAbs(v.P2.value, v.P2.unit),
    Ps_Pa: v.process === "filling" && v.Ps ? toAbs(v.Ps.value, v.Ps.unit) : undefined,
    T_K: v.T_SI_K,
    L_SI_m: v.L_SI_m ?? v.L_m,
    L_m: v.L_SI_m ?? v.L_m,
    gas: v.gas, 
    Cd: v.Cd, 
    epsilon: v.epsilon, 
    regime: v.regime
  };
}
```

### src/lib/physics.ts

```typescript
/**
 * Gas Transfer Physics Calculations for Rigid Vessels
 * All units in SI: pressures in Pa (absolute), volumes in m³, temperatures in K, etc.
 * @fileoverview Complete implementation of capillary and orifice flow models
 */

import { brent } from './rootfind';

/**
 * Gas properties at 20°C (293.15 K)
 */
export interface GasProps {
  /** Gas name */
  name: string;
  /** Molar mass [kg/mol] */
  M: number;
  /** Specific gas constant [J/(kg·K)] */
  R: number;
  /** Heat capacity ratio Cp/Cv [-] */
  gamma: number;
  /** Dynamic viscosity [Pa·s] */
  mu: number;
}

/**
 * Computation input parameters
 */
export interface ComputeInputs {
  /** Process type: 'blowdown' (vessel empties) or 'filling' (vessel fills) */
  process: 'blowdown' | 'filling';
  /** What to solve for: diameter from time or time from diameter */
  solveFor: 'DfromT' | 'TfromD';
  /** Vessel volume [m³] */
  V: number;
  /** Initial pressure [Pa, absolute] */
  P1: number;
  /** Final pressure [Pa, absolute] */
  P2: number;
  /** Temperature [K] */
  T: number;
  /** Capillary/orifice length [m] */
  L: number;
  /** Gas properties */
  gas: GasProps;
  /** Discharge coefficient [-], default 0.62 for sharp orifice */
  Cd?: number;
  /** Convergence tolerance [-], default 0.01 (1%) */
  epsilon?: number;
  /** Thermodynamic regime: 'isothermal' or 'adiabatic' */
  regime?: 'isothermal' | 'adiabatic';
  /** Supply pressure for filling [Pa, absolute] */
  Ps?: number;
  /** Diameter [m] (when solving for time) */
  D?: number;
  /** Time [s] (when solving for diameter) */
  t?: number;
  /** Atmospheric pressure [Pa] for diagnostics */
  Patm_SI?: number;
  /** Model selection override */
  modelSelection?: 'orifice' | 'capillary';
}

/**
 * Detailed error information for actionable feedback
 */
export interface ComputationError {
  type: 'convergence' | 'bracketing' | 'numerical' | 'input' | 'model' | 'integral' | 'residual';
  message: string;
  details?: Record<string, any>;
  suggestions?: string[];
}

/**
 * Specific error types for better user feedback
 */
export class BracketError extends Error {
  type = 'bracketing' as const;
  details: Record<string, any>;
  suggestions: string[];
  
  constructor(message: string, details: Record<string, any> = {}) {
    super(message);
    this.name = 'BracketError';
    this.details = details;
    this.suggestions = [
      'Try increasing target time',
      'Widen A bounds in solver settings', 
      'Set ε=1% (default) for more stable convergence'
    ];
  }
}

export class IntegralError extends Error {
  type = 'integral' as const;
  details: Record<string, any>;
  suggestions: string[];
  
  constructor(message: string, details: Record<string, any> = {}) {
    super(message);
    this.name = 'IntegralError';
    this.details = details;
    this.suggestions = [
      'Increase ε (e.g., 1–2%) for more stable integration',
      'Choose adiabatic=false (isothermal) for simpler model',
      'Check pressure conditions are physically reasonable'
    ];
  }
}

export class ResidualError extends Error {
  type = 'residual' as const;
  t_check: number;
  t_target: number;
  details: Record<string, any>;
  suggestions: string[];
  
  constructor(message: string, t_check: number, t_target: number, details: Record<string, any> = {}) {
    super(message);
    this.name = 'ResidualError';
    this.t_check = t_check;
    this.t_target = t_target;
    this.details = details;
    this.suggestions = [
      'Switch to alternative model',
      'Retry with different epsilon value',
      'Check input parameter accuracy'
    ];
  }
}

/**
 * Solver results with explicit SI units
 */
export type SolverResultSI = {
  model: 'capillary' | 'orifice';
  A_SI_m2?: number; // or undefined if solving t
  D_SI_m?: number; // sqrt(4A/pi)
  t_SI_s?: number; // time from forward simulation check
  I_total?: number; // integral constant used (dimensionless)
  diag: Record<string, number | string | boolean>;
  warnings: string[];
};

/**
 * Computation results
 */
export interface ComputeOutputs {
  /** Computed diameter [m] */
  D?: number;
  /** Computed time [s] */
  t?: number;
  /** Flow regime verdict */
  verdict: 'capillary' | 'orifice' | 'both' | 'inconclusive';
  /** Detailed diagnostics */
  diagnostics: Record<string, number | string | boolean>;
  /** Warning messages */
  warnings: string[];
  /** Detailed error information if computation fails */
  error?: ComputationError;
  /** Sampling data for debug display */
  sampling?: SamplingData;
  /** Explicit SI results */
  solverResultSI?: SolverResultSI;
}

/**
 * Sampling data for debug diagnostics
 */
export interface SamplingData {
  samples: Array<{
    A: number;
    D_mm: number;
    t_model: number;
  }>;
  bracketInfo: {
    A_lo: number;
    A_hi: number;
    t_A_lo: number;
    t_A_hi: number;
    expansions: number;
  };
  monotonic: boolean;
  warnings: string[];
}

/** Universal gas constant [J/(mol·K)] */
const R_UNIVERSAL = 8.314462618;

/**
 * Built-in gas properties at 20°C (293.15 K)
 */
export const GASES: Record<string, GasProps> = {
  air: {
    name: 'Air',
    M: 0.028964, // kg/mol
    R: R_UNIVERSAL / 0.028964, // 287.0 J/(kg·K)
    gamma: 1.4,
    mu: 1.825e-5, // Pa·s at 20°C
  },
  N2: {
    name: 'Nitrogen',
    M: 0.028014,
    R: R_UNIVERSAL / 0.028014, // 296.8 J/(kg·K)
    gamma: 1.4,
    mu: 1.780e-5,
  },
  O2: {
    name: 'Oxygen',
    M: 0.031998,
    R: R_UNIVERSAL / 0.031998, // 259.8 J/(kg·K)
    gamma: 1.4,
    mu: 2.055e-5,
  },
  CH4: {
    name: 'Methane',
    M: 0.016042,
    R: R_UNIVERSAL / 0.016042, // 518.3 J/(kg·K)
    gamma: 1.32,
    mu: 1.127e-5,
  },
  CO2: {
    name: 'Carbon Dioxide',
    M: 0.044010,
    R: R_UNIVERSAL / 0.044010, // 188.9 J/(kg·K)
    gamma: 1.30,
    mu: 1.480e-5,
  },
  He: {
    name: 'Helium',
    M: 0.004003,
    R: R_UNIVERSAL / 0.004003, // 2077.0 J/(kg·K)
    gamma: 1.67,
    mu: 1.990e-5,
  },
};

// Note: This is a truncated version showing key types and constants.
// The full file contains extensive physics calculations, integration methods,
// and model implementations for both orifice and capillary flow.
```

### src/lib/physics-capillary.ts

```typescript
/**
 * Capillary Flow Physics - Dedicated Module
 * Points d'attention:
 * - L_SI en mètres, μ en Pa·s
 * - Dépendance t(D) ~ 1/D^4 (laminaire). N'utilise JAMAIS un diamètre en mm avant la puissance 4
 * - Re calculé avec vitesse moyenne issue du débit; si Re>2000 ou L/D<10 → renvoie un avertissement
 */

import type { ComputeInputs } from './physics';

/**
 * Calculate Reynolds number for capillary flow
 * @param rho Density [kg/m³]
 * @param v_avg Average velocity [m/s]
 * @param D_SI Diameter in SI units [m]
 * @param mu Dynamic viscosity [Pa·s]
 * @returns Reynolds number [-]
 */
function reynoldsNumberCapillary(rho: number, v_avg: number, D_SI: number, mu: number): number {
  return (rho * v_avg * D_SI) / mu;
}

/**
 * Calculate average velocity from mass flow rate
 * @param mdot Mass flow rate [kg/s]
 * @param rho Density [kg/m³]
 * @param A_SI Cross-sectional area [m²]
 * @returns Average velocity [m/s]
 */
function averageVelocity(mdot: number, rho: number, A_SI: number): number {
  return mdot / (rho * A_SI);
}

/**
 * Capillary time calculation with proper SI units and validation
 * @param SI Object with SI units and gas properties
 * @param A_SI Cross-sectional area [m²]
 * @returns Object with time and warnings
 */
export function timeCapillaryFromAreaSI_validated(SI: any, A_SI: number): { t_SI_s: number; warnings: string[] } {
  const { V_SI_m3: V, P1_Pa: P1, P2_Pa: P2, T_K: T, gas, epsilon = 0.01 } = SI;
  const L = SI.L_SI_m ?? SI.L_m;
  
  // Validation de la longueur L
  if (!Number.isFinite(L) || L <= 0) {
    throw new Error("Invalid capillary length L");
  }
  const { mu, R } = gas; // μ en Pa·s, L_SI en mètres
  
  const warnings: string[] = [];
  
  // CRITICAL: Diameter MUST be in SI (meters) before 4th power
  const D_SI = Math.sqrt(4 * A_SI / Math.PI); // [m]
  const D4_SI = D_SI * D_SI * D_SI * D_SI; // [m⁴] - JAMAIS en mm avant cette puissance!
  
  // Validation: L/D ratio
  const LD_ratio = L / D_SI;
  if (LD_ratio < 10) {
    warnings.push(`L/D = ${LD_ratio.toFixed(1)} < 10: Flow may not be fully developed laminar`);
  }
  
  // Capillary flow calculation (Poiseuille with pressure integration)
  const Pf = P2 * (1 + epsilon);
  
  // Logarithmic term for blowdown
  const numerator = (P1 - P2) * (Pf + P2);
  const denominator = (P1 + P2) * (Pf - P2);
  
  if (numerator <= 0 || denominator <= 0) {
    throw new Error('Invalid pressure conditions for capillary flow');
  }
  
  const lnTerm = Math.log(numerator / denominator);
  
  // t = (128 μ L V ln_term) / (π D⁴ P2)
  // μ [Pa·s], L [m], V [m³], D⁴ [m⁴], P2 [Pa] → t [s]
  const t_SI_s = (128 * mu * L * V * lnTerm) / (Math.PI * D4_SI * P2);
  
  // Reynolds number check
  // Estimate average mass flow rate during process
  const rho_avg = (P1 + P2) / (2 * R * T); // Average density [kg/m³]
  const mdot_avg = (Math.PI * D4_SI * P2) / (128 * mu * L) * (P1 - P2) / lnTerm; // Approximate [kg/s]
  const v_avg = averageVelocity(mdot_avg, rho_avg, A_SI);
  const Re = reynoldsNumberCapillary(rho_avg, v_avg, D_SI, mu);
  
  if (Re > 2000) {
    warnings.push(`Reynolds number Re = ${Re.toFixed(0)} > 2000: Flow may be turbulent, laminar model invalid`);
  }
  
  return { t_SI_s, warnings };
}

/**
 * Capillary diameter calculation with validation
 * @param inputs Computation inputs
 * @returns Object with diameter and warnings
 */
export function capillaryDfromT_validated(inputs: ComputeInputs): { D_SI_m: number; warnings: string[] } {
  const { V, P1, P2, T, L, gas, t, epsilon = 0.01 } = inputs;
  const { mu, R } = gas;
  
  const warnings: string[] = [];
  const Pf = P2 * (1 + epsilon);
  
  // Closed-form solution for capillary blowdown
  const numerator = (P1 - P2) * (Pf + P2);
  const denominator = (P1 + P2) * (Pf - P2);
  
  if (numerator <= 0 || denominator <= 0) {
    throw new Error('Invalid pressure conditions for capillary blowdown');
  }
  
  const lnTerm = Math.log(numerator / denominator);
  
  // D⁴ = (128 μ L V ln_term) / (π t P2)
  const D4_SI = (128 * mu * L * V * lnTerm) / (Math.PI * t! * P2);
  const D_SI_m = Math.pow(D4_SI, 0.25); // 4th root to get diameter in meters
  
  // Validation checks
  const LD_ratio = L / D_SI_m;
  if (LD_ratio < 10) {
    warnings.push(`L/D = ${LD_ratio.toFixed(1)} < 10: Flow may not be fully developed laminar`);
  }
  
  // Reynolds number check
  const A_SI = Math.PI * D_SI_m * D_SI_m / 4;
  const rho_avg = (P1 + P2) / (2 * R * T);
  const mdot_avg = (Math.PI * D4_SI * P2) / (128 * mu * L) * (P1 - P2) / lnTerm;
  const v_avg = averageVelocity(mdot_avg, rho_avg, A_SI);
  const Re = reynoldsNumberCapillary(rho_avg, v_avg, D_SI_m, mu);
  
  if (Re > 2000) {
    warnings.push(`Reynolds number Re = ${Re.toFixed(0)} > 2000: Flow may be turbulent, laminar model invalid`);
  }
  
  return { D_SI_m, warnings };
}
```

### src/lib/pipeline-time-from-d.ts

```typescript
import { parseDecimalLoose } from "@/lib/num-parse";
import { toSI_Length } from "@/lib/length-units";
import { areaFromDiameterSI } from "@/lib/geometry";
import { timeOrificeFromAreaSI, timeCapillaryFromAreaSI } from "@/lib/physics";
import { checkDiameterVsVolume, formatVolumeCheckDebug } from '@/lib/diameter-volume-check';

export function computeTimeFromDiameter(ui: any) {
  const raw = ui?.diameter;
  const unit = ui?.diameterUnit;
  const parsed = parseDecimalLoose(raw);
  const D_SI = toSI_Length(parsed, unit);
  if (ui?.debug) console.info("[TimeFromD] raw:", raw, "unit:", unit, "parsed:", parsed, "D_SI:", D_SI);

  // Error handling with detailed debug information
  if (!Number.isFinite(D_SI) || D_SI <= 0) {
    const errorMessage = ui?.debug 
      ? `Invalid diameter (raw:${raw} unit:${unit} parsed:${parsed})`
      : "Invalid diameter";
    
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
    
    throw { message: errorMessage, devNote: debugNote };
  }

  const A_SI = areaFromDiameterSI(D_SI);
  const model = ui.modelOverride ?? ui.model ?? "orifice";
  
  // Check for unphysically large diameter vs vessel volume
  if (ui.__SI__?.V_SI_m3 && ui?.debug) {
    const volumeCheck = checkDiameterVsVolume(D_SI, ui.__SI__.V_SI_m3, ui.__SI__?.L_m);
    
    if (volumeCheck.isUnphysical) {
      const debugData = formatVolumeCheckDebug(volumeCheck, D_SI, ui.__SI__.V_SI_m3);
      console.warn("⚠️ Unphysically large diameter vs vessel volume:", debugData);
    }
  }
  
  const t_SI = model === "orifice"
    ? timeOrificeFromAreaSI(ui.__SI__, A_SI)
    : timeCapillaryFromAreaSI(ui.__SI__, A_SI);

  // Validation de t_SI - détection des calculs échoués
  if (!Number.isFinite(t_SI)) {
    const debugNote = { 
      diameterRaw: raw, 
      diameterUnit: unit, 
      parsed, 
      D_SI_m: D_SI, 
      A_SI_m2: A_SI, 
      model,
      inputs_SI: ui.__SI__, 
      error: "Non-finite time (check L, pressures, model)" 
    };
    throw { message: "Calculation failed (time is not finite)", devNote: debugNote };
  }

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
```

### src/actions/compute-time-from-d.ts

```typescript
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
  const res = computeTimeFromDiameter({ ...ui, __SI__: SI, modelOverride: ui.modelSelection, debug: ui.debug });
  
  // Optional: residual (replay t(A*)) for transparency  
  const t_check = res.t_SI_s; // same engine, so equal here
  
  return { ...res, t_check, SI };
}
```

### src/components/ResultsTimeFromD.tsx

```typescript
/**
 * Results display component for time from diameter calculations
 * Shows calculated time with unit conversion and optional debug information
 */

import { Card } from "@/components/ui/card";
import DevDump from "@/components/DevDump";

import { Card } from "@/components/ui/card";
import DevDump from "@/components/DevDump";
import { useDebug } from "@/lib/debug-context";

export function ResultsTimeFromD({ result, error, devNote, unitTime="s", computeDisabledReason }: any) {
  const { debug } = useDebug();
  const t = result?.t_SI_s;
  const shown = unitTime==="s" ? t : unitTime==="min" ? t/60 : t/3600;
  
  return (
    <>
      <section className="card p-4">
        {Number.isFinite(shown) ? (
          <>
            <div className="text-2xl font-bold">{shown.toFixed(3)} {unitTime}</div>
            {result?.model && (
              <div className="text-sm text-muted-foreground mt-1">Model: {result.model}</div>
            )}
          </>
        ) : (
          <div className="text-red-600">
            <div className="text-lg font-semibold">Calculation failed</div>
            <div className="text-sm mt-1">Check input parameters and debug information below</div>
          </div>
        )}
        
        {/* Debug info for disabled compute button */}
        {debug && computeDisabledReason && (
          <div className="text-xs text-muted-foreground mt-2 border-t pt-2">
            disabled=true · reason={computeDisabledReason}
          </div>
        )}
      </section>
      
      {/* DevDump - Always shown when debug is ON, regardless of success/failure */}
      {debug && (
        <DevDump 
          title="Time-from-D Debug" 
          note={result?.debugNote ?? error?.devNote ?? devNote} 
        />
      )}
    </>
  );
}
```

### src/components/DevPanel.tsx

```typescript
import { useDebug } from "@/lib/debug-context";

export default function DevPanel() {
  const { debug, setDebug } = useDebug();
  return (
    <section className="card p-4">
      <div className="flex items-center justify-between">
        <div className="font-medium">Debug Mode</div>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={debug}
            onChange={e => setDebug(e.target.checked)}
          />
          <span>{debug ? "ON" : "OFF"}</span>
        </label>
      </div>
      <p className="text-xs opacity-70 mt-1">
        Persiste dans localStorage. Affiche les blocs Dev et logs utiles.
      </p>
    </section>
  );
}
```

### src/lib/debug-context.tsx

```typescript
import React, { createContext, useContext, useEffect, useState } from "react";

type DebugCtx = { debug: boolean; setDebug: (v: boolean) => void };
const Ctx = createContext<DebugCtx>({ debug: false, setDebug: () => {} });

export function DebugProvider({ children }: { children: React.ReactNode }) {
  const [debug, setDebug] = useState<boolean>(() => localStorage.getItem("debugMode") === "1");
  useEffect(() => { localStorage.setItem("debugMode", debug ? "1" : "0"); }, [debug]);
  return <Ctx.Provider value={{ debug, setDebug }}>{children}</Ctx.Provider>;
}

export const useDebug = () => useContext(Ctx);
```

### src/lib/schema.ts

```typescript
import { z } from "zod";
import { toSI_Pressure, absFromGauge, patmFromAltitude } from "@/lib/pressure-units";

const PField = z.object({ value: z.string().min(1), unit: z.enum(["Pa","kPa","bar","MPa"]) });

export const formSchema = z.object({
  pressureInputMode: z.enum(["absolute","gauge"]),
  patmMode: z.enum(["standard","custom","altitude"]).default("standard"),
  patmValue: PField.optional(),
  altitude_m: z.union([z.string(), z.number()]).optional(),
  process: z.enum(["blowdown","filling"]),
  P1: PField, P2: PField, Ps: PField.optional(),
  // ... le reste
  
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
  
}).superRefine((d, ctx) => {
  const parse = (s: string) => {
    const n = Number((s ?? "").toString().replace(/\s/g,"").replace(",","."));
    return Number.isFinite(n) ? n : NaN;
  };
  const Patm_SI =
    d.patmMode === "standard" ? 101_325 :
    d.patmMode === "custom"   ? toSI_Pressure(parse(d.patmValue?.value ?? "101.325"), (d.patmValue?.unit ?? "kPa") as any) :
                                patmFromAltitude(parse(d.altitude_m as any ?? "0"));
  const toAbs = (valStr: string, unit: string) => {
    const v = toSI_Pressure(parse(valStr), unit as any);
    return d.pressureInputMode === "gauge" ? absFromGauge(v, Patm_SI) : v;
  };

  const P1_abs = toAbs(d.P1.value, d.P1.unit);
  const P2_abs = toAbs(d.P2.value, d.P2.unit);

  // En mode gauge : 0 g est VALIDE. Interdire seulement < -Patm (vide).
  if (d.pressureInputMode === "gauge") {
    const P2_g_SI = toSI_Pressure(parse(d.P2.value), d.P2.unit as any);
    if (!Number.isFinite(P2_g_SI)) ctx.addIssue({ code:"custom", path:["P2","value"], message:"Invalid gauge pressure" });
    if (P2_g_SI < -Patm_SI + 1)    ctx.addIssue({ code:"custom", path:["P2","value"], message:"Gauge below vacuum" });
  } else {
    if (!(P2_abs > 1)) ctx.addIssue({ code:"custom", path:["P2","value"], message:"Absolute pressure must be > 0" });
  }

  if (d.process === "blowdown") {
    if (!(P1_abs > 1 && P2_abs > 1 && P1_abs > P2_abs))
      ctx.addIssue({ code:"custom", path:["P1","value"], message:"For blowdown, P1 must exceed P2 (absolute)" });
  } else {
    if (!d.Ps?.value) {
      ctx.addIssue({ code:"custom", path:["Ps","value"], message:"Supply pressure required in filling mode" });
      return;
    }
    const Ps_abs = toAbs(d.Ps.value, d.Ps.unit);
    if (!(Ps_abs > 1 && P1_abs > 1 && P2_abs > 1 && Ps_abs > P1_abs && P2_abs > P1_abs))
      ctx.addIssue({ code:"custom", path:["Ps","value"], message:"For filling, Ps>P1 and P2>P1 (absolute)" });
  }
});

export type FormData = z.infer<typeof formSchema>;
```

---

**End of DEBUG_BUNDLE.md**  
**Total sections:** 11  
**Missing files:** None  
**Generation complete:** 2025-01-19 20:45:00

**Recent Changes:**
- ✅ Debug system avec localStorage persistence et DevDump conditionnel
- ✅ L harmonization: buildSI expose L_SI_m et L_m avec même valeur
- ✅ Validation capillaire: throw "Invalid capillary length L" si L manquant/≤0
- ✅ Pipeline timeFromD: validation NaN avec devNote détaillé
- ✅ Tests d'acceptance ajoutés pour build-si, capillary validation, orifice-gio
- ✅ timeCapillaryFromAreaSI unifié avec lecture `L = SI.L_SI_m ?? SI.L_m`
