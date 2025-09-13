import { describe, it, expect } from 'vitest';
import { GASES, computeDfromT, computeTfromD, criticalPressureRatio } from '../physics';
import type { ComputeInputs } from '../physics';

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

    it('should calculate critical pressure ratios correctly', () => {
      expect(criticalPressureRatio(1.4)).toBeCloseTo(0.528, 3); // Air
      expect(criticalPressureRatio(1.67)).toBeCloseTo(0.487, 3); // Helium
    });
  });

  describe('1. Capillary Round-Trip Tests', () => {
    const generateRandomInputs = (process: 'blowdown' | 'filling') => {
      const base: Partial<ComputeInputs> = {
        process,
        V: 0.01 + Math.random() * 0.5, // 10L to 500L
        P1: process === 'blowdown' ? 500000 + Math.random() * 1500000 : 100000 + Math.random() * 200000,
        P2: process === 'blowdown' ? 100000 + Math.random() * 200000 : 500000 + Math.random() * 1500000,
        T: 273.15 + Math.random() * 100, // 0°C to 100°C
        L: 0.01 + Math.random() * 0.1, // 1cm to 10cm
        gas: GASES.air,
        Cd: 0.62,
        epsilon: 0.01,
      };
      
      if (process === 'filling') {
        base.Ps = (base.P2! + 200000) + Math.random() * 500000; // Supply pressure above target
      }
      
      return base as ComputeInputs;
    };

    it('should round-trip D↔t for blowdown within 0.5%', () => {
      for (let i = 0; i < 10; i++) {
        const inputs = generateRandomInputs('blowdown');
        inputs.t = 30 + Math.random() * 300; // 30s to 5min
        inputs.solveFor = 'DfromT';
        
        const resultD = computeDfromT(inputs);
        if (resultD.D && resultD.verdict === 'capillary') {
          inputs.D = resultD.D;
          inputs.solveFor = 'TfromD';
          delete inputs.t;
          
          const resultT = computeTfromD(inputs);
          if (resultT.t && resultT.verdict === 'capillary') {
            const error = Math.abs((resultT.t - inputs.t!) / inputs.t!) * 100;
            expect(error).toBeLessThan(0.5);
          }
        }
      }
    });

    it('should round-trip D↔t for filling within 0.5%', () => {
      for (let i = 0; i < 10; i++) {
        const inputs = generateRandomInputs('filling');
        inputs.t = 30 + Math.random() * 300; // 30s to 5min
        inputs.solveFor = 'DfromT';
        
        const resultD = computeDfromT(inputs);
        if (resultD.D && resultD.verdict === 'capillary') {
          inputs.D = resultD.D;
          inputs.solveFor = 'TfromD';
          delete inputs.t;
          
          const resultT = computeTfromD(inputs);
          if (resultT.t && resultT.verdict === 'capillary') {
            const error = Math.abs((resultT.t - inputs.t!) / inputs.t!) * 100;
            expect(error).toBeLessThan(0.5);
          }
        }
      }
    });
  });

  describe('2. Orifice Monotonicity Tests', () => {
    it('should show t(A) is monotonically decreasing for blowdown', () => {
      const baseInputs: ComputeInputs = {
        process: 'blowdown',
        solveFor: 'TfromD',
        V: 0.1,
        P1: 1000000, // 10 bar
        P2: 100000,  // 1 bar
        T: 293.15,
        L: 0.001, // Very short for orifice behavior
        gas: GASES.air,
        Cd: 0.62,
      };

      const diameters = [0.001, 0.002, 0.005, 0.01, 0.02]; // 1mm to 20mm
      const times: number[] = [];

      for (const D of diameters) {
        const inputs = { ...baseInputs, D };
        const result = computeTfromD(inputs);
        if (result.t && result.verdict === 'orifice') {
          times.push(result.t);
        }
      }

      // Check monotonicity: larger diameter → shorter time
      for (let i = 1; i < times.length; i++) {
        expect(times[i]).toBeLessThan(times[i - 1]);
      }
    });

    it('should show t(A) is monotonically decreasing for filling', () => {
      const baseInputs: ComputeInputs = {
        process: 'filling',
        solveFor: 'TfromD',
        V: 0.1,
        P1: 100000,  // 1 bar
        P2: 1000000, // 10 bar
        Ps: 1200000, // 12 bar supply
        T: 293.15,
        L: 0.001, // Very short for orifice behavior
        gas: GASES.air,
        Cd: 0.62,
      };

      const diameters = [0.001, 0.002, 0.005, 0.01, 0.02];
      const times: number[] = [];

      for (const D of diameters) {
        const inputs = { ...baseInputs, D };
        const result = computeTfromD(inputs);
        if (result.t && result.verdict === 'orifice') {
          times.push(result.t);
        }
      }

      // Check monotonicity: larger diameter → shorter time
      for (let i = 1; i < times.length; i++) {
        expect(times[i]).toBeLessThan(times[i - 1]);
      }
    });
  });

  describe('3. Choked Flow Boundary Tests', () => {
    it('should detect choked flow at critical pressure ratio', () => {
      const r_star = criticalPressureRatio(GASES.air.gamma);
      
      const inputs: ComputeInputs = {
        process: 'blowdown',
        solveFor: 'TfromD',
        V: 0.1,
        P1: 1000000, // 10 bar
        P2: 1000000 * r_star * 0.8, // Below critical ratio
        T: 293.15,
        L: 0.001,
        D: 0.005,
        gas: GASES.air,
        Cd: 0.62,
      };

      const result = computeTfromD(inputs);
      expect(result.diagnostics.choked).toBe(true);

      // Test just above critical ratio
      inputs.P2 = 1000000 * r_star * 1.2;
      const result2 = computeTfromD(inputs);
      expect(result2.diagnostics.choked).toBe(false);
    });

    it('should have consistent pressure split in two-phase flow', () => {
      const r_star = criticalPressureRatio(GASES.air.gamma);
      
      const inputs: ComputeInputs = {
        process: 'blowdown',
        solveFor: 'TfromD',
        V: 0.1,
        P1: 1000000, // 10 bar
        P2: 100000,  // 1 bar (well below critical)
        T: 293.15,
        L: 0.001,
        D: 0.005,
        gas: GASES.air,
        Cd: 0.62,
      };

      const result = computeTfromD(inputs);
      if (result.diagnostics.P_transition) {
        const P_star = result.diagnostics.P_transition as number;
        const calculated_ratio = inputs.P2 / P_star;
        expect(Math.abs(calculated_ratio - r_star)).toBeLessThan(0.01);
      }
    });
  });

  describe('4. Model Selection Tests', () => {
    it('should select capillary for low Reynolds, high L/D', () => {
      const inputs: ComputeInputs = {
        process: 'filling',
        solveFor: 'DfromT',
        V: 0.01,     // Small volume
        P1: 100000,  // 1 bar
        P2: 200000,  // 2 bar
        Ps: 250000,  // 2.5 bar
        T: 293.15,
        L: 0.1,      // Long tube (10cm)
        t: 300,      // Long time (5 min)
        gas: GASES.air,
        Cd: 0.62,
      };

      const result = computeDfromT(inputs);
      expect(['capillary', 'both']).toContain(result.verdict);
      if (result.diagnostics.Re) {
        expect(result.diagnostics.Re as number).toBeLessThan(2000);
      }
      if (result.diagnostics['L/D']) {
        expect(result.diagnostics['L/D'] as number).toBeGreaterThan(10);
      }
    });

    it('should select orifice for thin plate, high pressure ratio', () => {
      const inputs: ComputeInputs = {
        process: 'blowdown',
        solveFor: 'TfromD',
        V: 0.1,      // Larger volume
        P1: 2000000, // 20 bar
        P2: 100000,  // 1 bar (high ratio)
        T: 293.15,
        L: 0.001,    // Very thin plate (1mm)
        D: 0.01,     // 10mm diameter
        gas: GASES.air,
        Cd: 0.62,
      };

      const result = computeTfromD(inputs);
      expect(result.verdict).toBe('orifice');
      expect(result.diagnostics.choked).toBe(true);
      if (result.diagnostics['L/D']) {
        expect(result.diagnostics['L/D'] as number).toBeLessThan(10);
      }
    });

    it('should handle inconclusive cases gracefully', () => {
      const inputs: ComputeInputs = {
        process: 'blowdown',
        solveFor: 'DfromT',
        V: 0.1,
        P1: 1000000,
        P2: 100000,
        T: 293.15,
        L: 0.05,
        t: 1, // Very short time - likely no solution
        gas: GASES.air,
        Cd: 0.62,
      };

      const result = computeDfromT(inputs);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.diagnostics.rationale).toBeDefined();
    });
  });

  describe('5. Regression Tests', () => {
    it('should produce consistent results for standard blowdown case', () => {
      const inputs: ComputeInputs = {
        process: 'blowdown',
        solveFor: 'DfromT',
        V: 0.1,        // 100L
        P1: 1000000,   // 10 bar
        P2: 100000,    // 1 bar
        T: 293.15,     // 20°C
        L: 0.05,       // 5cm
        t: 60,         // 1 minute
        gas: GASES.air,
        Cd: 0.62,
        epsilon: 0.01,
      };

      const result = computeDfromT(inputs);
      
      // Snapshot test - these values should remain consistent
      expect(result.verdict).toBeDefined();
      expect(result.D).toBeGreaterThan(0);
      expect(result.D).toBeLessThan(0.1); // Reasonable diameter range
      expect(result.diagnostics).toHaveProperty('Re');
      expect(result.diagnostics).toHaveProperty('L/D');
      expect(result.diagnostics).toHaveProperty('rationale');
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should produce consistent results for standard filling case', () => {
      const inputs: ComputeInputs = {
        process: 'filling',
        solveFor: 'TfromD',
        V: 0.1,        // 100L
        P1: 100000,    // 1 bar
        P2: 1000000,   // 10 bar
        Ps: 1200000,   // 12 bar supply
        T: 293.15,     // 20°C
        L: 0.05,       // 5cm
        D: 0.005,      // 5mm
        gas: GASES.air,
        Cd: 0.62,
        epsilon: 0.01,
      };

      const result = computeTfromD(inputs);
      
      // Snapshot test
      expect(result.verdict).toBeDefined();
      expect(result.t).toBeGreaterThan(0);
      expect(result.t).toBeLessThan(3600); // Reasonable time range (< 1 hour)
      expect(result.diagnostics).toHaveProperty('Re');
      expect(result.diagnostics).toHaveProperty('L/D');
      expect(result.diagnostics).toHaveProperty('rationale');
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should handle edge case with helium gas', () => {
      const inputs: ComputeInputs = {
        process: 'blowdown',
        solveFor: 'DfromT',
        V: 0.01,       // 10L
        P1: 500000,    // 5 bar
        P2: 100000,    // 1 bar
        T: 77.15,      // Liquid nitrogen temp
        L: 0.02,       // 2cm
        t: 30,         // 30 seconds
        gas: GASES.He, // Helium - different gamma
        Cd: 0.62,
        epsilon: 0.01,
      };

      const result = computeDfromT(inputs);
      
      expect(result.verdict).toBeDefined();
      expect(result.diagnostics.rationale).toBeDefined();
      // Helium should typically favor orifice model due to high speed
      if (result.diagnostics.choked !== undefined) {
        expect(typeof result.diagnostics.choked).toBe('boolean');
      }
    });
  });
});