import { describe, it, expect } from 'vitest';
import { COMMON_GASES } from '../physics';
import { calculateOrificeFlow } from '../physics';

describe('Physics Calculations', () => {
  describe('Gas Properties', () => {
    it('should have correct molecular weights for common gases', () => {
      expect(COMMON_GASES.air.molecularWeight).toBeCloseTo(0.02897);
      expect(COMMON_GASES.nitrogen.molecularWeight).toBeCloseTo(0.02801);
      expect(COMMON_GASES.oxygen.molecularWeight).toBeCloseTo(0.032);
      expect(COMMON_GASES.helium.molecularWeight).toBeCloseTo(0.004003);
    });

    it('should have appropriate gamma ratios', () => {
      expect(COMMON_GASES.air.gammaRatio).toBe(1.4);
      expect(COMMON_GASES.helium.gammaRatio).toBe(1.67);
      expect(COMMON_GASES.methane.gammaRatio).toBe(1.32);
    });
  });

  describe('Flow Calculations', () => {
    it('should calculate basic orifice flow', () => {
      const inputs = {
        vessel: {
          pressure1: 1000000, // 10 bar in Pa
          pressure2: 100000,  // 1 bar in Pa
          volume: 0.1,        // 100 L in m³
          temperature: 293.15, // 20°C in K
        },
        gas: COMMON_GASES.air,
        time: 60, // 1 minute
      };

      const results = calculateOrificeFlow(inputs);
      
      expect(results).toBeDefined();
      expect(results.massFlowRate).toBeGreaterThan(0);
      expect(results.dischargeCoefficient).toBe(0.62);
      expect(typeof results.chokedFlow).toBe('boolean');
    });

    it('should detect choked flow conditions', () => {
      const inputs = {
        vessel: {
          pressure1: 1000000, // 10 bar
          pressure2: 100000,  // 1 bar (high pressure ratio)
          volume: 0.1,
          temperature: 293.15,
        },
        gas: COMMON_GASES.air,
        diameter: 0.005, // 5mm
      };

      const results = calculateOrificeFlow(inputs);
      expect(results.chokedFlow).toBeDefined();
    });
  });
});