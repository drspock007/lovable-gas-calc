import { describe, it, expect } from 'vitest';
import { convertToSI, convertFromSI } from '../units';

describe('Unit Conversions', () => {
  describe('Pressure conversions', () => {
    it('should convert bar to Pa correctly', () => {
      expect(convertToSI.pressure(1, 'bar')).toBeCloseTo(100000);
      expect(convertFromSI.pressure(100000, 'bar')).toBeCloseTo(1);
    });

    it('should convert psi to Pa correctly', () => {
      expect(convertToSI.pressure(1, 'psi')).toBeCloseTo(6894.76);
      expect(convertFromSI.pressure(6894.76, 'psi')).toBeCloseTo(1);
    });
  });

  describe('Temperature conversions', () => {
    it('should convert Celsius to Kelvin correctly', () => {
      expect(convertToSI.temperature(0, 'celsius')).toBeCloseTo(273.15);
      expect(convertToSI.temperature(20, 'celsius')).toBeCloseTo(293.15);
    });

    it('should convert Fahrenheit to Kelvin correctly', () => {
      expect(convertToSI.temperature(32, 'fahrenheit')).toBeCloseTo(273.15);
      expect(convertToSI.temperature(68, 'fahrenheit')).toBeCloseTo(293.15);
    });
  });

  describe('Volume conversions', () => {
    it('should convert liters to m³ correctly', () => {
      expect(convertToSI.volume(1000, 'liter')).toBeCloseTo(1);
      expect(convertFromSI.volume(1, 'liter')).toBeCloseTo(1000);
    });
  });

  describe('Length conversions', () => {
    it('should convert mm to m correctly', () => {
      expect(convertToSI.length(1000, 'mm')).toBeCloseTo(1);
      expect(convertFromSI.length(1, 'mm')).toBeCloseTo(1000);
    });

    it('should convert inches to m correctly', () => {
      expect(convertToSI.length(1, 'inch')).toBeCloseTo(0.0254);
      expect(convertFromSI.length(0.0254, 'inch')).toBeCloseTo(1);
    });
  });
});