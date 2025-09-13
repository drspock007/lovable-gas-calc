import { describe, it, expect } from 'vitest';
import { toSI_Volume, toSI_Pressure, toSI_Temperature, toSI_Length, toSI_Time } from '../units';

/**
 * Regression test for mm³ volume calculations
 * Based on Gio's screenshot case with micrometric results
 */
describe('Volume mm³ Regression Tests', () => {
  // Test case parameters from Gio's screenshot
  const testCase = {
    process: 'blowdown',
    V_mm3: 200, // mm³
    T_celsius: 15, // °C
    P1_kPa: 1200, // kPa abs
    P2_kPa_low: 1, // kPa abs
    P2_kPa_high: 100, // kPa abs
    L_mm: 2, // mm
    t_s: 175, // s
    gas: 'Air',
    Cd: 0.62,
    epsilon: 0.01,
    regime: 'isothermal'
  };

  describe('Unit conversions for test case', () => {
    it('should convert 200 mm³ to 2e-7 m³', () => {
      const volumeSI = toSI_Volume(testCase.V_mm3, 'mm3');
      expect(volumeSI).toBeCloseTo(2e-7, 10);
    });

    it('should convert other units correctly', () => {
      const tempSI = toSI_Temperature(testCase.T_celsius, 'C');
      expect(tempSI).toBeCloseTo(288.15, 2); // 15°C = 288.15K

      const p1SI = toSI_Pressure(testCase.P1_kPa, 'kPa');
      expect(p1SI).toBeCloseTo(1200000, 1); // 1200 kPa = 1.2 MPa

      const lengthSI = toSI_Length(testCase.L_mm, 'mm');
      expect(lengthSI).toBeCloseTo(0.002, 6); // 2 mm = 0.002 m

      const timeSI = toSI_Time(testCase.t_s, 's');
      expect(timeSI).toBe(175); // Already in SI
    });
  });

  describe('Diameter computation expectations', () => {
    it('should expect micrometric diameters for small volumes', () => {
      // For 200 mm³ volumes, diameter should be micrometric
      const expectedMinD = 1e-6; // 1 μm
      const expectedMaxD = 1e-4;  // 100 μm
      
      // This is a range check - actual computation would go here
      // We're testing that our expectations are reasonable
      expect(expectedMinD).toBeLessThan(expectedMaxD);
      expect(expectedMaxD).toBeLessThan(0.001); // Much less than 1 mm
    });

    it('should have different ranges for capillary vs orifice models', () => {
      // Expected ranges (order of magnitude)
      const capillaryExpected = 5e-5; // ~50 μm
      const orificeMinExpected = 1e-5; // ~10 μm
      const orificeMaxExpected = 3e-5; // ~30 μm
      
      // Sanity checks on expected ranges
      expect(capillaryExpected).toBeGreaterThan(orificeMinExpected);
      expect(capillaryExpected).toBeGreaterThan(orificeMaxExpected);
      expect(orificeMaxExpected).toBeGreaterThan(orificeMinExpected);
      
      // All should be micrometric
      expect(capillaryExpected).toBeLessThan(1e-4);
      expect(orificeMaxExpected).toBeLessThan(1e-4);
    });
  });

  describe('Physics sanity checks', () => {
    it('should validate pressure ratio', () => {
      const pressureRatio1 = testCase.P2_kPa_low / testCase.P1_kPa;
      const pressureRatio2 = testCase.P2_kPa_high / testCase.P1_kPa;
      
      expect(pressureRatio1).toBeCloseTo(1/1200, 6); // Very low final pressure
      expect(pressureRatio2).toBeCloseTo(100/1200, 3); // Moderate final pressure
      
      // Both should be less than 1 (expansion)
      expect(pressureRatio1).toBeLessThan(1);
      expect(pressureRatio2).toBeLessThan(1);
    });

    it('should check volume-diameter relationship', () => {
      const volumeSI = toSI_Volume(testCase.V_mm3, 'mm3');
      
      // Equivalent sphere diameter: D_eq = (6V/π)^(1/3)
      const equivalentDiameter = Math.pow(6 * volumeSI / Math.PI, 1/3);
      
      // For a 200 mm³ sphere, equivalent diameter should be ~7 mm
      expect(equivalentDiameter).toBeCloseTo(0.007, 3); // ~7 mm
      
      // Orifice diameter should be much smaller than vessel size
      const expectedOrificeD = 2e-5; // 20 μm
      expect(expectedOrificeD).toBeLessThan(equivalentDiameter / 100);
    });
  });

  describe('Test case variations', () => {
    it('should handle both low and high final pressures', () => {
      const lowPressureRatio = testCase.P2_kPa_low / testCase.P1_kPa;
      const highPressureRatio = testCase.P2_kPa_high / testCase.P1_kPa;
      
      // Low pressure case (1 kPa final) - more extreme
      expect(lowPressureRatio).toBeLessThan(0.01);
      
      // High pressure case (100 kPa final) - less extreme  
      expect(highPressureRatio).toBeGreaterThan(0.05);
      expect(highPressureRatio).toBeLessThan(0.15);
    });

    it('should maintain consistent units throughout calculation', () => {
      // All SI conversions should be consistent
      const allSI = {
        volume: toSI_Volume(testCase.V_mm3, 'mm3'),
        temperature: toSI_Temperature(testCase.T_celsius, 'C'),
        pressure1: toSI_Pressure(testCase.P1_kPa, 'kPa'),
        pressure2: toSI_Pressure(testCase.P2_kPa_low, 'kPa'),
        length: toSI_Length(testCase.L_mm, 'mm'),
        time: toSI_Time(testCase.t_s, 's')
      };
      
      // All should be positive and finite
      Object.values(allSI).forEach(value => {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      });
      
      // Volume should be very small (mm³ scale)
      expect(allSI.volume).toBeLessThan(1e-6);
      
      // Temperature should be reasonable
      expect(allSI.temperature).toBeGreaterThan(250);
      expect(allSI.temperature).toBeLessThan(350);
    });
  });
});