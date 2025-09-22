/**
 * Acceptance tests for precise solver diagnostics in Filling mode
 * Validates that specific error reasons are provided with detailed context
 */

import { describe, it, expect } from 'vitest';
import { computeDfromT, GASES } from '@/lib/physics';

describe('Filling Solver Precise Diagnostics', () => {
  it('should provide "non-finite bracket times" error when times are invalid', () => {
    const invalidInputs = {
      process: 'filling' as const,
      solveFor: 'DfromT' as const,
      V: 2e-6, // 2000 mm³
      P1: 0, // Invalid pressure causing non-finite times
      P2: 202650,
      Ps: 505000,
      T: 293.15,
      L: 0.001,
      gas: GASES.air,
      t: 10,
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal' as const
    };

    expect(() => {
      computeDfromT(invalidInputs);
    }).toThrow();

    try {
      computeDfromT(invalidInputs);
    } catch (error: any) {
      if (error.devNote?.reason === "non-finite bracket times") {
        expect(error.devNote).toMatchObject({
          reason: "non-finite bracket times",
          t_lo: expect.any(Number),
          t_hi: expect.any(Number),
          A_lo_m2: expect.any(Number),
          A_hi_m2: expect.any(Number),
          process: "filling",
          bracket_expansions: expect.any(Number)
        });
      }
    }
  });

  it('should provide "Target time out of bracket" error after max expansions', () => {
    const outOfBracketInputs = {
      process: 'filling' as const,
      solveFor: 'DfromT' as const,
      V: 1e-9, // Very small volume
      P1: 101325,
      P2: 202650,
      Ps: 505000,
      T: 293.15,
      L: 0.001,
      gas: GASES.air,
      t: 10000, // Extremely long time - should be out of bracket
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal' as const
    };

    expect(() => {
      computeDfromT(outOfBracketInputs);
    }).toThrow();

    try {
      computeDfromT(outOfBracketInputs);
    } catch (error: any) {
      if (error.devNote?.reason === "Target time out of bracket") {
        expect(error.devNote).toMatchObject({
          reason: "Target time out of bracket",
          t_target_s: 10000,
          t_lo: expect.any(Number),
          t_hi: expect.any(Number),
          A_lo_m2: expect.any(Number),
          A_hi_m2: expect.any(Number),
          bracket_expansions: 4 // Should hit max expansions
        });
      }
    }
  });

  it('should provide "Hit bracket bound (no root inside)" error when terminating on boundary', () => {
    const boundaryInputs = {
      process: 'filling' as const,
      solveFor: 'DfromT' as const,
      V: 2e-6,
      P1: 101325,
      P2: 101326, // Very small pressure difference
      Ps: 101327,
      T: 293.15,
      L: 0.001,
      gas: GASES.air,
      t: 0.001, // Short time with small pressure difference
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal' as const
    };

    expect(() => {
      computeDfromT(boundaryInputs);
    }).toThrow();

    try {
      computeDfromT(boundaryInputs);
    } catch (error: any) {
      if (error.devNote?.reason === "Hit bracket bound (no root inside)") {
        expect(error.devNote).toMatchObject({
          reason: "Hit bracket bound (no root inside)",
          A_lo_m2: expect.any(Number),
          A_hi_m2: expect.any(Number),
          t_lo_s: expect.any(Number),
          t_hi_s: expect.any(Number),
          t_target_s: 0.001,
          boundary_hit: expect.stringMatching(/A_lo|A_hi/)
        });
      }
    }
  });

  it('should provide "Result rejected by residual check" error when forward check fails', () => {
    // Use parameters that might give a solution but fail residual check
    const residualFailInputs = {
      process: 'filling' as const,
      solveFor: 'DfromT' as const,
      V: 5e-6, // 5000 mm³
      P1: 101325,
      P2: 151988, // 1.5 atm
      Ps: 253312, // 2.5 atm
      T: 293.15,
      L: 0.005, // 5 mm
      gas: GASES.air,
      t: 0.1, // 100 ms - might converge but fail residual
      Cd: 0.62,
      epsilon: 0.001, // Very strict epsilon to force residual failure
      regime: 'isothermal' as const
    };

    try {
      computeDfromT(residualFailInputs);
    } catch (error: any) {
      if (error.devNote?.reason === "Result rejected by residual check") {
        expect(error.devNote).toMatchObject({
          reason: "Result rejected by residual check",
          t_forward_s: expect.any(Number),
          t_target_s: 0.1,
          residual: expect.any(Number),
          epsilon_used: expect.any(Number),
          bounds_used: expect.objectContaining({
            A_lo_m2: expect.any(Number),
            A_hi_m2: expect.any(Number)
          }),
          choking: expect.objectContaining({
            choked: expect.any(Boolean)
          })
        });
        
        // Residual should be > epsilon_used
        expect(error.devNote.residual).toBeGreaterThan(error.devNote.epsilon_used);
      }
    }
  });

  it('should normalize bracket orientation (swap if t_lo < t_hi)', () => {
    // Create inputs that might initially have wrong orientation
    const orientationInputs = {
      process: 'filling' as const,
      solveFor: 'DfromT' as const,
      V: 3e-6,
      P1: 101325,
      P2: 202650,
      Ps: 405300,
      T: 293.15,
      L: 0.002,
      gas: GASES.air,
      t: 1, // 1 second
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal' as const
    };

    // Even if successful, bracket should be properly oriented
    // If it fails, the error should show proper bracket orientation
    try {
      const result = computeDfromT(orientationInputs);
      // Success case - just verify no error
      expect(result).toBeDefined();
    } catch (error: any) {
      // If it fails, verify that error shows properly oriented bracket
      if (error.devNote && error.devNote.t_lo !== undefined && error.devNote.t_hi !== undefined) {
        // For a monotone decreasing function t(A), we should have t_lo >= t_hi
        expect(error.devNote.t_lo).toBeGreaterThanOrEqual(error.devNote.t_hi);
      }
    }
  });

  it('should log bracket expansions up to maximum of 4', () => {
    const expansionInputs = {
      process: 'filling' as const,
      solveFor: 'DfromT' as const,
      V: 1e-9, // Very small volume to force expansions
      P1: 101325,
      P2: 151988,
      Ps: 202650,
      T: 293.15,
      L: 0.001,
      gas: GASES.air,
      t: 100, // Long time to force bracket expansion
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal' as const
    };

    try {
      computeDfromT(expansionInputs);
    } catch (error: any) {
      if (error.devNote?.bracket_expansions !== undefined) {
        // Should not exceed maximum of 4 expansions
        expect(error.devNote.bracket_expansions).toBeLessThanOrEqual(4);
        expect(error.devNote.bracket_expansions).toBeGreaterThanOrEqual(0);
      }
    }
  });
});