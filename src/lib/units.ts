/**
 * Unit conversion utilities for gas transfer calculations
 * All conversions to/from SI base units
 */

export type PressureUnit = 'Pa' | 'bar' | 'kPa' | 'MPa' | 'psi';
export type VolumeUnit = 'liter' | 'L' | 'm3' | 'ft3';
export type TemperatureUnit = 'celsius' | 'kelvin' | 'fahrenheit';
export type LengthUnit = 'mm' | 'inch' | 'm';
export type TimeUnit = 'second' | 'minute' | 'hour';

export interface UnitSystem {
  pressure: PressureUnit;
  volume: VolumeUnit;
  temperature: TemperatureUnit;
  length: LengthUnit;
  time: TimeUnit;
}

// Default unit systems
export const UNIT_SYSTEMS = {
  metric: {
    pressure: 'bar' as PressureUnit,
    volume: 'liter' as VolumeUnit,
    temperature: 'celsius' as TemperatureUnit,
    length: 'mm' as LengthUnit,
    time: 'second' as TimeUnit,
  },
  imperial: {
    pressure: 'psi' as PressureUnit,
    volume: 'ft3' as VolumeUnit,
    temperature: 'fahrenheit' as TemperatureUnit,
    length: 'inch' as LengthUnit,
    time: 'second' as TimeUnit,
  },
  si: {
    pressure: 'Pa' as PressureUnit,
    volume: 'm3' as VolumeUnit,
    temperature: 'kelvin' as TemperatureUnit,
    length: 'm' as LengthUnit,
    time: 'second' as TimeUnit,
  },
};

/**
 * Convert pressure to Pascal (Pa)
 * @param value Pressure value
 * @param unit Source unit
 * @returns Pressure in Pa
 */
export function pressureToSI(value: number, unit: PressureUnit): number {
  switch (unit) {
    case 'Pa': return value;
    case 'bar': return value * 100000; // 1 bar = 100,000 Pa
    case 'kPa': return value * 1000; // 1 kPa = 1,000 Pa
    case 'MPa': return value * 1000000; // 1 MPa = 1,000,000 Pa
    case 'psi': return value * 6894.757; // 1 psi = 6,894.757 Pa
    default: throw new Error(`Unknown pressure unit: ${unit}`);
  }
}

/**
 * Convert pressure from Pascal (Pa)
 * @param value Pressure in Pa
 * @param unit Target unit
 * @returns Pressure in target unit
 */
export function pressureFromSI(value: number, unit: PressureUnit): number {
  switch (unit) {
    case 'Pa': return value;
    case 'bar': return value / 100000;
    case 'kPa': return value / 1000;
    case 'MPa': return value / 1000000;
    case 'psi': return value / 6894.757;
    default: throw new Error(`Unknown pressure unit: ${unit}`);
  }
}

/**
 * Convert volume to cubic meters (m³)
 * @param value Volume value
 * @param unit Source unit
 * @returns Volume in m³
 */
export function volumeToSI(value: number, unit: VolumeUnit): number {
  switch (unit) {
    case 'm3': return value;
    case 'liter':
    case 'L': return value / 1000; // 1 L = 0.001 m³
    case 'ft3': return value * 0.0283168; // 1 ft³ = 0.0283168 m³
    default: throw new Error(`Unknown volume unit: ${unit}`);
  }
}

/**
 * Convert volume from cubic meters (m³)
 * @param value Volume in m³
 * @param unit Target unit
 * @returns Volume in target unit
 */
export function volumeFromSI(value: number, unit: VolumeUnit): number {
  switch (unit) {
    case 'm3': return value;
    case 'liter':
    case 'L': return value * 1000;
    case 'ft3': return value / 0.0283168;
    default: throw new Error(`Unknown volume unit: ${unit}`);
  }
}

/**
 * Convert temperature to Kelvin (K)
 * @param value Temperature value
 * @param unit Source unit
 * @returns Temperature in K
 */
export function temperatureToSI(value: number, unit: TemperatureUnit): number {
  switch (unit) {
    case 'kelvin': return value;
    case 'celsius': return value + 273.15; // °C to K
    case 'fahrenheit': return (value - 32) * 5/9 + 273.15; // °F to K
    default: throw new Error(`Unknown temperature unit: ${unit}`);
  }
}

/**
 * Convert temperature from Kelvin (K)
 * @param value Temperature in K
 * @param unit Target unit
 * @returns Temperature in target unit
 */
export function temperatureFromSI(value: number, unit: TemperatureUnit): number {
  switch (unit) {
    case 'kelvin': return value;
    case 'celsius': return value - 273.15; // K to °C
    case 'fahrenheit': return (value - 273.15) * 9/5 + 32; // K to °F
    default: throw new Error(`Unknown temperature unit: ${unit}`);
  }
}

/**
 * Convert length to meters (m)
 * @param value Length value
 * @param unit Source unit
 * @returns Length in m
 */
export function lengthToSI(value: number, unit: LengthUnit): number {
  switch (unit) {
    case 'm': return value;
    case 'mm': return value / 1000; // 1 mm = 0.001 m
    case 'inch': return value * 0.0254; // 1 inch = 0.0254 m
    default: throw new Error(`Unknown length unit: ${unit}`);
  }
}

/**
 * Convert length from meters (m)
 * @param value Length in m
 * @param unit Target unit
 * @returns Length in target unit
 */
export function lengthFromSI(value: number, unit: LengthUnit): number {
  switch (unit) {
    case 'm': return value;
    case 'mm': return value * 1000;
    case 'inch': return value / 0.0254;
    default: throw new Error(`Unknown length unit: ${unit}`);
  }
}

/**
 * Convert time to seconds (s)
 * @param value Time value
 * @param unit Source unit
 * @returns Time in s
 */
export function timeToSI(value: number, unit: TimeUnit): number {
  switch (unit) {
    case 'second': return value;
    case 'minute': return value * 60; // 1 min = 60 s
    case 'hour': return value * 3600; // 1 h = 3600 s
    default: throw new Error(`Unknown time unit: ${unit}`);
  }
}

/**
 * Convert time from seconds (s)
 * @param value Time in s
 * @param unit Target unit
 * @returns Time in target unit
 */
export function timeFromSI(value: number, unit: TimeUnit): number {
  switch (unit) {
    case 'second': return value;
    case 'minute': return value / 60;
    case 'hour': return value / 3600;
    default: throw new Error(`Unknown time unit: ${unit}`);
  }
}

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
      return UNIT_SYSTEMS.metric;
    }
  }
  return UNIT_SYSTEMS.metric;
};