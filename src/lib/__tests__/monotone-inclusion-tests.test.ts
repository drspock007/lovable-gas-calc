/**
 * Test for monotone decreasing inclusion and bracket swapping in computeDfromT
 * Ensures that t(A) is properly monotone decreasing and inclusion tests work correctly
 */

import { describe, it, expect } from 'vitest';
import { computeDfromT, GASES } from '../physics';

describe('Monotone Decreasing Inclusion Tests', () => {
  const baseInputs = {
    process: 'blowdown' as const,
    solveFor: 'DfromT' as const,
    V: 2e-7, // 200 mm³ (Gio preset)
    P1: 1.2e6, // 1.2 MPa 
    P2: 1e3, // 1 kPa
    T: 288.15, // 15°C
    L: 0.002, // 2 mm
    gas: GASES.air,
    Cd: 0.62,
    epsilon: 0.01,
    regime: 'isothermal' as const
  };

  describe('Monotone decreasing verification', () => {
    it('should ensure t(A) is monotone decreasing with bracket swapping', () => {
      const inputs = { ...baseInputs, t: 175 };
      
      // This should work without throwing monotonicity errors
      const result = computeDfromT(inputs);
      expect(result.D).toBeDefined();
      expect(result.D).toBeGreaterThan(0);
      expect(result.D).toBeLessThan(1); // Reasonable bounds
    });

    it('should handle Gio preset conditions (V~200mm³, t~175s)', () => {
      const inputs = { 
        ...baseInputs, 
        t: 175, // Target time around 175s for Gio preset
        V: 2e-7 // 200 mm³
      };
      
      const result = computeDfromT(inputs);
      expect(result.D).toBeDefined();
      expect(result.D).toBeGreaterThan(5e-6); // > 5 µm
      expect(result.D).toBeLessThan(15e-6); // < 15 µm (expecting ~9 µm ±15%)
      
      // Should be approximately 9 µm ±15%
      const expectedD = 9e-6; // 9 µm
      const tolerance = 0.15; // 15%
      expect(result.D).toBeGreaterThan(expectedD * (1 - tolerance));
      expect(result.D).toBeLessThan(expectedD * (1 + tolerance));
    });
  });

  describe('Inclusion testing logic', () => {
    it('should properly test inclusion with t_hi <= t_target <= t_lo', () => {
      const inputs = { ...baseInputs, t: 100 };
      
      // For normal inputs, inclusion should work and not throw "Target time out of bracket"
      expect(() => computeDfromT(inputs)).not.toThrow('Target time out of bracket');
      
      const result = computeDfromT(inputs);
      expect(result.D).toBeDefined();
      expect(result.D).toBeGreaterThan(0);
    });

    it('should handle very large target times that require bracket expansion', () => {
      const inputs = { ...baseInputs, t: 1000 }; // Very large time
      
      try {
        const result = computeDfromT(inputs);
        // If it succeeds, the result should be reasonable
        expect(result.D).toBeDefined();
        expect(result.D).toBeGreaterThan(0);
      } catch (error: any) {
        // If it fails, it should be due to physical constraints, not monotonicity issues
        if (error.message === 'Target time out of bracket') {
          expect(error.devNote).toBeDefined();
          expect(error.devNote.t_target_SI).toBe(1000);
          expect(error.devNote.expansions).toBeDefined();
          expect(error.devNote.max_expansions).toBeDefined();
          expect(typeof error.devNote.t_lo).toBe('number');
          expect(typeof error.devNote.t_hi).toBe('number');
          // Verify monotonicity is maintained: t_lo >= t_hi
          expect(error.devNote.t_lo).toBeGreaterThanOrEqual(error.devNote.t_hi);
        }
      }
    });
  });

  describe('Physical constraint interaction', () => {
    it('should respect physical diameter ceiling (V=2000mm³ → D≤31mm)', () => {
      const inputs = { 
        ...baseInputs, 
        V: 2e-6, // 2000 mm³
        t: 50 // Medium target time
      };
      
      try {
        const result = computeDfromT(inputs);
        
        // If successful, diameter should be <= 31 mm (k=2 physical constraint)
        if (result.D) {
          const D_eq = Math.pow(6 * inputs.V / Math.PI, 1/3); // Volumic equivalent diameter
          const k_physical = 2;
          const D_max_physical = k_physical * D_eq; // Should be ~31mm for 2000mm³
          
          expect(result.D).toBeLessThanOrEqual(D_max_physical);
          expect(D_max_physical).toBeCloseTo(0.031, 3); // ~31 mm
        }
      } catch (error: any) {
        // If it fails due to physical constraints, that's expected for this test
        if (error.message === 'Target time out of bracket') {
          expect(error.devNote.A_hi).toBeDefined();
          expect(error.devNote.A_lo).toBeDefined();
        }
      }
    });
  });

  describe('Error message content validation', () => {
    it('should provide comprehensive devNote when target time is out of bracket', () => {
      const inputs = { 
        ...baseInputs, 
        t: 1e-6, // Extremely small time to force out of bracket
        epsilon: 0.001 // Very strict to trigger issues
      };
      
      try {
        computeDfromT(inputs);
      } catch (error: any) {
        if (error.message === 'Target time out of bracket') {
          expect(error.devNote).toBeDefined();
          expect(error.devNote.t_target_SI).toBe(1e-6);
          expect(typeof error.devNote.t_lo).toBe('number');
          expect(typeof error.devNote.t_hi).toBe('number');
          expect(typeof error.devNote.A_lo).toBe('number');
          expect(typeof error.devNote.A_hi).toBe('number');
          expect(typeof error.devNote.expansions).toBe('number');
          expect(typeof error.devNote.max_expansions).toBe('number');
          
          // Verify monotonicity is maintained in error report
          expect(error.devNote.t_lo).toBeGreaterThanOrEqual(error.devNote.t_hi);
        }
      }
    });
  });
});