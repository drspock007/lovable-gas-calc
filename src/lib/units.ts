/**
 * Unit conversion utilities for the Gas Transfer Calculator
 * All conversions are to SI base units
 */

// ============= VOLUME UNITS =============

export type VolumeUnit = 'm3' | 'L' | 'ft3' | 'mm3';

export const VOLUME_LABEL: Record<VolumeUnit, string> = {
  m3: 'm³',
  L: 'L',
  ft3: 'ft³',
  mm3: 'mm³',
};

export const VOLUME_UNITS: VolumeUnit[] = ['mm3', 'L', 'm3', 'ft3'];

const VOL_TO_SI: Record<VolumeUnit, number> = {
  m3: 1,
  L: 1e-3, // 1 L = 1e-3 m³
  ft3: 0.028316846592,
  mm3: 1e-9, // 1 mm³ = 1e-9 m³
};

export function toSI_Volume(value: number, unit: VolumeUnit): number {
  return value * VOL_TO_SI[unit];
}

export function fromSI_Volume(valueSI: number, unit: VolumeUnit): number {
  return valueSI / VOL_TO_SI[unit];
}

// ============= PRESSURE UNITS =============

export type PressureUnit = 'Pa' | 'bar' | 'psi' | 'atm' | 'kPa' | 'MPa' | 'torr' | 'mmHg';

export const PRESSURE_LABEL: Record<PressureUnit, string> = {
  Pa: 'Pa',
  bar: 'bar',
  psi: 'psi',
  atm: 'atm',
  kPa: 'kPa',
  MPa: 'MPa',
  torr: 'Torr',
  mmHg: 'mmHg',
};

const PRESSURE_TO_SI: Record<PressureUnit, number> = {
  Pa: 1,
  bar: 1e5,
  psi: 6894.757,
  atm: 101325,
  kPa: 1e3,
  MPa: 1e6,
  torr: 133.322,
  mmHg: 133.322,
};

export function toSI_Pressure(value: number, unit: PressureUnit): number {
  return value * PRESSURE_TO_SI[unit];
}

export function fromSI_Pressure(valueSI: number, unit: PressureUnit): number {
  return valueSI / PRESSURE_TO_SI[unit];
}

// ============= TEMPERATURE UNITS =============

export type TemperatureUnit = 'K' | 'C' | 'F' | 'R';

export const TEMPERATURE_LABEL: Record<TemperatureUnit, string> = {
  K: 'K',
  C: '°C',
  F: '°F',
  R: '°R',
};

export function toSI_Temperature(value: number, unit: TemperatureUnit): number {
  switch (unit) {
    case 'K': return value;
    case 'C': return value + 273.15;
    case 'F': return (value - 32) * 5/9 + 273.15;
    case 'R': return value * 5/9;
    default: return value;
  }
}

export function fromSI_Temperature(valueSI: number, unit: TemperatureUnit): number {
  switch (unit) {
    case 'K': return valueSI;
    case 'C': return valueSI - 273.15;
    case 'F': return (valueSI - 273.15) * 9/5 + 32;
    case 'R': return valueSI * 9/5;
    default: return valueSI;
  }
}

// ============= LENGTH UNITS =============

export type LengthUnit = 'm' | 'mm' | 'cm' | 'in' | 'ft';

export const LENGTH_LABEL: Record<LengthUnit, string> = {
  m: 'm',
  mm: 'mm',
  cm: 'cm',
  in: 'in',
  ft: 'ft',
};

const LENGTH_TO_SI: Record<LengthUnit, number> = {
  m: 1,
  mm: 1e-3,
  cm: 1e-2,
  in: 0.0254,
  ft: 0.3048,
};

export function toSI_Length(value: number, unit: LengthUnit): number {
  return value * LENGTH_TO_SI[unit];
}

export function fromSI_Length(valueSI: number, unit: LengthUnit): number {
  return valueSI / LENGTH_TO_SI[unit];
}

// ============= TIME UNITS =============

export type TimeUnit = 's' | 'min' | 'h' | 'ms';

export const TIME_LABEL: Record<TimeUnit, string> = {
  s: 's',
  min: 'min',
  h: 'h',
  ms: 'ms',
};

const TIME_TO_SI: Record<TimeUnit, number> = {
  s: 1,
  min: 60,
  h: 3600,
  ms: 1e-3,
};

export function toSI_Time(value: number, unit: TimeUnit): number {
  return value * TIME_TO_SI[unit];
}

export function fromSI_Time(valueSI: number, unit: TimeUnit): number {
  return valueSI / TIME_TO_SI[unit];
}

// ============= LEGACY FUNCTION COMPATIBILITY =============

// Legacy volume functions for backward compatibility
export function volumeToSI(value: number, unit: string): number {
  const conversions: Record<string, number> = {
    'm3': 1,
    'liter': 1e-3,
    'L': 1e-3,
    'ft3': 0.028316846592,
    'mm3': 1e-9,
    'gal': 0.003785411784,
    'ml': 1e-6,
  };
  return value * (conversions[unit] || 1);
}

export function volumeFromSI(value: number, unit: string): number {
  const conversions: Record<string, number> = {
    'm3': 1,
    'liter': 1e-3,
    'L': 1e-3,
    'ft3': 0.028316846592,
    'mm3': 1e-9,
    'gal': 0.003785411784,
    'ml': 1e-6,
  };
  return value / (conversions[unit] || 1);
}

// Legacy pressure functions for backward compatibility
export function pressureToSI(value: number, unit: string): number {
  const conversions: Record<string, number> = {
    'Pa': 1,
    'bar': 1e5,
    'psi': 6894.757,
    'atm': 101325,
    'kPa': 1e3,
    'MPa': 1e6,
    'torr': 133.322,
    'mmHg': 133.322,
  };
  return value * (conversions[unit] || 1);
}

export function pressureFromSI(value: number, unit: string): number {
  const conversions: Record<string, number> = {
    'Pa': 1,
    'bar': 1e5,
    'psi': 6894.757,
    'atm': 101325,
    'kPa': 1e3,
    'MPa': 1e6,
    'torr': 133.322,
    'mmHg': 133.322,
  };
  return value / (conversions[unit] || 1);
}

// Legacy temperature functions for backward compatibility
export function temperatureToSI(value: number, unit: string): number {
  switch (unit) {
    case 'K': case 'kelvin': return value;
    case 'C': case 'celsius': return value + 273.15;
    case 'F': case 'fahrenheit': return (value - 32) * 5/9 + 273.15;
    case 'R': case 'rankine': return value * 5/9;
    default: return value;
  }
}

export function temperatureFromSI(value: number, unit: string): number {
  switch (unit) {
    case 'K': case 'kelvin': return value;
    case 'C': case 'celsius': return value - 273.15;
    case 'F': case 'fahrenheit': return (value - 273.15) * 9/5 + 32;
    case 'R': case 'rankine': return value * 9/5;
    default: return value;
  }
}

// Legacy length functions for backward compatibility
export function lengthToSI(value: number, unit: string): number {
  const conversions: Record<string, number> = {
    'm': 1,
    'mm': 1e-3,
    'cm': 1e-2,
    'in': 0.0254,
    'ft': 0.3048,
  };
  return value * (conversions[unit] || 1);
}

export function lengthFromSI(value: number, unit: string): number {
  const conversions: Record<string, number> = {
    'm': 1,
    'mm': 1e-3,
    'cm': 1e-2,
    'in': 0.0254,
    'ft': 0.3048,
  };
  return value / (conversions[unit] || 1);
}

// Legacy time functions for backward compatibility
export function timeToSI(value: number, unit: string): number {
  const conversions: Record<string, number> = {
    's': 1,
    'second': 1,
    'min': 60,
    'minute': 60,
    'h': 3600,
    'hour': 3600,
    'ms': 1e-3,
  };
  return value * (conversions[unit] || 1);
}

export function timeFromSI(value: number, unit: string): number {
  const conversions: Record<string, number> = {
    's': 1,
    'second': 1,
    'min': 60,
    'minute': 60,
    'h': 3600,
    'hour': 3600,
    'ms': 1e-3,
  };
  return value / (conversions[unit] || 1);
}

// ============= UNIT SYSTEM TYPES =============

export type UnitSystemType = 'SI' | 'Imperial' | 'Mixed';

export interface UnitSystem {
  pressure: PressureUnit;
  volume: VolumeUnit;
  temperature: TemperatureUnit;
  length: LengthUnit;
  time: TimeUnit;
}

export const UNIT_SYSTEMS: Record<UnitSystemType, UnitSystem> = {
  SI: {
    pressure: 'Pa',
    volume: 'm3',
    temperature: 'K',
    length: 'm',
    time: 's',
  },
  Imperial: {
    pressure: 'psi',
    volume: 'ft3',
    temperature: 'F',
    length: 'ft',
    time: 's',
  },
  Mixed: {
    pressure: 'bar',
    volume: 'L',
    temperature: 'C',
    length: 'mm',
    time: 's',
  },
};

// Legacy converters for backward compatibility
export const convertToSI = {
  pressure: pressureToSI,
  volume: volumeToSI,
  temperature: temperatureToSI,
  length: lengthToSI,
  time: timeToSI,
};

export const convertFromSI = {
  pressure: pressureFromSI,
  volume: volumeFromSI,
  temperature: temperatureFromSI,
  length: lengthFromSI,
  time: timeFromSI,
};

// Unit storage in localStorage
export const saveUnitPreferences = (units: UnitSystem) => {
  localStorage.setItem('gasCalculator_units', JSON.stringify(units));
};

export const loadUnitPreferences = (): UnitSystem => {
  const stored = localStorage.getItem('gasCalculator_units');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return UNIT_SYSTEMS.Mixed;
    }
  }
  return UNIT_SYSTEMS.Mixed;
};