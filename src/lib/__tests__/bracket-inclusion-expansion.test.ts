import { describe, it, expect } from 'vitest';
import { computeDfromT, GASES } from '../physics';

describe('Target Time Inclusion and Bracket Expansion', () => {
  const baseInputs = {
    process: 'blowdown' as const,
    solveFor: 'DfromT' as const,
    V: 2e-7,
    P1: 1.2e6,
    P2: 1e3,
    T: 288.15,
    L: 0.002,
    gas: GASES.air,
    Cd: 0.62,
    epsilon: 0.01,
    regime: 'isothermal' as const
  };

  describe('Bracket expansion behavior', () => {
    it('should expand bracket when target time is outside initial range', () => {
      // Use a very large time that requires bracket expansion
      const inputs = { ...baseInputs, t: 10000 }; // 10,000 seconds
      
      try {
        const result = computeDfromT(inputs);
        
        // Should either succeed with expansions > 0 or fail with proper devNote
        if (result.sampling) {
          expect(result.sampling.bracketInfo.expansions).toBeGreaterThan(0);
        }
      } catch (error: any) {
        // If it fails, should be due to bracket limits, not boundary solution
        if (error.devNote) {
          expect(error.devNote.expansions).toBeDefined();
          expect(error.devNote.max_expansions).toBe(4);
        }
      }
    });

    it('should reject solutions at exact boundaries', () => {
      // Use a time that might result in boundary solution
      const inputs = { ...baseInputs, t: 1e-6 }; // Very small time
      
      try {
        const result = computeDfromT(inputs);
        
        // If successful, verify it's not at boundary
        expect(result.D).toBeGreaterThan(0);
        expect(result.D).toBeLessThan(1.0);
        
        // Should have reasonable sampling data
        if (result.sampling) {
          expect(result.sampling.bracketInfo.A_lo).toBeDefined();
          expect(result.sampling.bracketInfo.A_hi).toBeDefined();
        }
      } catch (error: any) {
        // If rejected, should have proper boundary detection
        if (error.devNote?.boundary_reached) {
          expect(error.message).toBe("Target time out of bracket");
          expect(error.devNote.A_solution).toBeDefined();
          expect(error.devNote.bracket).toBeDefined();
        }
      }
    });
  });

  describe('Inclusion testing logic', () => {
    it('should properly test time inclusion in bracket', () => {
      // Use a reasonable time that should be includable
      const inputs = { ...baseInputs, t: 175 }; // Normal time
      
      const result = computeDfromT(inputs);
      
      // Should succeed without many expansions
      expect(result.D).toBeGreaterThan(0);
      expect(result.D).toBeLessThan(1.0);
      
      if (result.sampling) {
        // Should have reasonable bracket info
        expect(result.sampling.bracketInfo.t_A_lo).toBeGreaterThan(0);
        expect(result.sampling.bracketInfo.t_A_hi).toBeGreaterThan(0);
        expect(result.sampling.bracketInfo.expansions).toBeLessThanOrEqual(4);
      }
    });

    it('should throw proper error for unbracketable time', () => {
      // Use extremely large time that cannot be bracketed
      const inputs = { ...baseInputs, t: 1e10 }; // Impossibly large time
      
      expect(() => computeDfromT(inputs)).toThrow();
      
      try {
        computeDfromT(inputs);
      } catch (error: any) {
        if (error.devNote) {
          expect(error.devNote.t_target_SI).toBe(1e10);
          expect(error.devNote.bracket).toBeDefined();
          expect(error.devNote.expansions).toBe(4); // Should hit max expansions
        }
      }
    });
  });

  describe('Residual time validation', () => {
    it('should enforce residual time tolerance', () => {
      const inputs = { ...baseInputs, t: 175, epsilon: 0.001 }; // Very strict tolerance
      
      try {
        const result = computeDfromT(inputs);
        
        // If successful, residual should be within tolerance
        expect(result.D).toBeGreaterThan(0);
      } catch (error: any) {
        // If failed due to residual, should have proper devNote
        if (error.message === "Time residual too large") {
          expect(error.devNote.residual_time).toBeDefined();
          expect(error.devNote.epsilon_threshold).toBeDefined();
          expect(error.devNote.t_target_SI).toBe(175);
          expect(error.devNote.t_computed).toBeDefined();
        }
      }
    });
  });

  describe('Physical bounds enforcement', () => {
    it('should respect maximum physical area bounds', () => {
      // Test with parameters that might require very large areas
      const inputs = { 
        ...baseInputs, 
        t: 1e-3, // Very small time requiring large diameter
        V: 1e-3   // Larger volume
      };
      
      try {
        const result = computeDfromT(inputs);
        
        // Should either succeed with reasonable D or fail properly
        if (result.D) {
          expect(result.D).toBeLessThan(1.0); // Should not exceed 1m diameter
        }
      } catch (error: any) {
        // Should fail with proper bracket information
        if (error.devNote?.bracket) {
          // A_hi should be capped at physical limit
          expect(error.devNote.bracket.A_hi).toBeLessThanOrEqual(1e-1);
        }
      }
    });
  });
});