export type PressureUnit = 'bar' | 'psi' | 'pa';
export type VolumeUnit = 'liter' | 'm3' | 'ft3';
export type TemperatureUnit = 'celsius' | 'kelvin' | 'fahrenheit';
export type LengthUnit = 'mm' | 'inch';
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
    pressure: 'pa' as PressureUnit,
    volume: 'm3' as VolumeUnit,
    temperature: 'kelvin' as TemperatureUnit,
    length: 'mm' as LengthUnit,
    time: 'second' as TimeUnit,
  },
};

// Conversion functions to SI units
export const convertToSI = {
  pressure: (value: number, unit: PressureUnit): number => {
    switch (unit) {
      case 'bar': return value * 100000; // Pa
      case 'psi': return value * 6894.76; // Pa
      case 'pa': return value; // Pa
    }
  },
  volume: (value: number, unit: VolumeUnit): number => {
    switch (unit) {
      case 'liter': return value / 1000; // m³
      case 'm3': return value; // m³
      case 'ft3': return value * 0.0283168; // m³
    }
  },
  temperature: (value: number, unit: TemperatureUnit): number => {
    switch (unit) {
      case 'celsius': return value + 273.15; // K
      case 'kelvin': return value; // K
      case 'fahrenheit': return (value - 32) * 5/9 + 273.15; // K
    }
  },
  length: (value: number, unit: LengthUnit): number => {
    switch (unit) {
      case 'mm': return value / 1000; // m
      case 'inch': return value * 0.0254; // m
    }
  },
  time: (value: number, unit: TimeUnit): number => {
    switch (unit) {
      case 'second': return value; // s
      case 'minute': return value * 60; // s
      case 'hour': return value * 3600; // s
    }
  },
};

// Conversion functions from SI units
export const convertFromSI = {
  pressure: (value: number, unit: PressureUnit): number => {
    switch (unit) {
      case 'bar': return value / 100000;
      case 'psi': return value / 6894.76;
      case 'pa': return value;
    }
  },
  volume: (value: number, unit: VolumeUnit): number => {
    switch (unit) {
      case 'liter': return value * 1000;
      case 'm3': return value;
      case 'ft3': return value / 0.0283168;
    }
  },
  temperature: (value: number, unit: TemperatureUnit): number => {
    switch (unit) {
      case 'celsius': return value - 273.15;
      case 'kelvin': return value;
      case 'fahrenheit': return (value - 273.15) * 9/5 + 32;
    }
  },
  length: (value: number, unit: LengthUnit): number => {
    switch (unit) {
      case 'mm': return value * 1000;
      case 'inch': return value / 0.0254;
    }
  },
  time: (value: number, unit: TimeUnit): number => {
    switch (unit) {
      case 'second': return value;
      case 'minute': return value / 60;
      case 'hour': return value / 3600;
    }
  },
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