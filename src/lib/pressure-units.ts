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