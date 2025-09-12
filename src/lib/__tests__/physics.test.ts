import { describe, it, expect } from 'vitest';
import { GASES } from '../physics';
import { computeDfromT, computeTfromD } from '../physics';

describe('Physics Calculations', () => {
  describe('Gas Properties', () => {
    it('should have correct molecular weights for common gases', () => {
      expect(GASES.air.M).toBeCloseTo(0.028964);
      expect(GASES.N2.M).toBeCloseTo(0.028014);
      expect(GASES.O2.M).toBeCloseTo(0.031998);
      expect(GASES.He.M).toBeCloseTo(0.004003);
    });

    it('should have appropriate gamma ratios', () => {
      expect(GASES.air.gamma).toBe(1.4);
      expect(GASES.He.gamma).toBe(1.67);
      expect(GASES.CH4.gamma).toBe(1.32);
    });
  });

  describe('Flow Calculations', () => {
    it('should calculate diameter from time', () => {
      const inputs = {
        process: 'blowdown' as const,
        solveFor: 'DfromT' as const,
        V: 0.1,        // 100 L in m³
        P1: 1000000,   // 10 bar in Pa
        P2: 100000,    // 1 bar in Pa
        T: 293.15,     // 20°C in K
        L: 0.05,       // 5 cm
        gas: GASES.air,
        t: 60,         // 1 minute
      };

      const results = computeDfromT(inputs);
      
      expect(results).toBeDefined();
      expect(results.D).toBeGreaterThan(0);
      expect(results.verdict).toBeDefined();
      expect(Array.isArray(results.warnings)).toBe(true);
    });

    it('should calculate time from diameter', () => {
      const inputs = {
        process: 'blowdown' as const,
        solveFor: 'TfromD' as const,
        V: 0.1,
        P1: 1000000, // 10 bar
        P2: 100000,  // 1 bar
        T: 293.15,
        L: 0.05,     // 5 cm
        gas: GASES.air,
        D: 0.005,    // 5mm
      };

      const results = computeTfromD(inputs);
      expect(results).toBeDefined();
      expect(results.verdict).toBeDefined();
    });
  });
});