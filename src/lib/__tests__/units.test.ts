import { describe, it, expect } from 'vitest';
import { pressureToSI, pressureFromSI, temperatureToSI, temperatureFromSI, volumeToSI, volumeFromSI, lengthToSI, lengthFromSI } from '../units';

describe('Unit Conversions', () => {
  describe('Pressure conversions', () => {
    it('should convert bar to Pa correctly', () => {
      expect(pressureToSI(1, 'bar')).toBeCloseTo(100000);
      expect(pressureFromSI(100000, 'bar')).toBeCloseTo(1);
    });

    it('should convert psi to Pa correctly', () => {
      expect(pressureToSI(1, 'psi')).toBeCloseTo(6894.757);
      expect(pressureFromSI(6894.757, 'psi')).toBeCloseTo(1);
    });
  });

  describe('Temperature conversions', () => {
    it('should convert Celsius to Kelvin correctly', () => {
      expect(temperatureToSI(0, 'celsius')).toBeCloseTo(273.15);
      expect(temperatureToSI(20, 'celsius')).toBeCloseTo(293.15);
    });

    it('should convert Fahrenheit to Kelvin correctly', () => {
      expect(temperatureToSI(32, 'fahrenheit')).toBeCloseTo(273.15);
      expect(temperatureToSI(68, 'fahrenheit')).toBeCloseTo(293.15);
    });
  });

  describe('Volume conversions', () => {
    it('should convert liters to m³ correctly', () => {
      expect(volumeToSI(1000, 'liter')).toBeCloseTo(1);
      expect(volumeFromSI(1, 'liter')).toBeCloseTo(1000);
    });

    it('should convert round-trip: 10 L → SI → mm³ = 10,000,000 mm³', () => {
      const volumeInL = 10;
      const volumeInSI = volumeToSI(volumeInL, 'L');
      const volumeInMm3 = volumeFromSI(volumeInSI, 'mm3');
      expect(volumeInMm3).toBeCloseTo(10_000_000);
    });

    it('should convert mm³ to m³ correctly', () => {
      expect(volumeToSI(1_000_000_000, 'mm3')).toBeCloseTo(1);
      expect(volumeFromSI(1, 'mm3')).toBeCloseTo(1_000_000_000);
    });

    it('should convert ft³ to m³ correctly', () => {
      expect(volumeToSI(1, 'ft3')).toBeCloseTo(0.028316846592);
      expect(volumeFromSI(0.028316846592, 'ft3')).toBeCloseTo(1);
    });
  });

  describe('Length conversions', () => {
    it('should convert mm to m correctly', () => {
      expect(lengthToSI(1000, 'mm')).toBeCloseTo(1);
      expect(lengthFromSI(1, 'mm')).toBeCloseTo(1000);
    });

    it('should convert inches to m correctly', () => {
      expect(lengthToSI(1, 'inch')).toBeCloseTo(0.0254);
      expect(lengthFromSI(0.0254, 'inch')).toBeCloseTo(1);
    });
  });
});