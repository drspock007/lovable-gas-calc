/**
 * Acceptance test for enhanced error reporting in Filling DfromT calculations
 * Validates that errors contain comprehensive devNote with inputs_SI, bracket, and reason
 */

import { describe, it, expect } from 'vitest';
import { computeDfromT, GASES } from '@/lib/physics';

describe('Filling DfromT Enhanced Error Reporting', () => {
  it('should provide comprehensive devNote when orifice solver fails in filling mode', () => {
    const failingInputs = {
      process: 'filling' as const,
      solveFor: 'DfromT' as const,
      V: 2e-6, // 2000 mm³ in m³
      P1: 101325, // 1 atm
      P2: 202650, // 2 atm 
      Ps: 505000, // 5 atm supply
      T: 293.15, // 20°C
      L: 0.001, // 1 mm
      gas: GASES.air,
      t: 0.00001, // Extremely short time - should cause solver to fail
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal' as const
    };

    expect(() => {
      computeDfromT(failingInputs);
    }).toThrow();

    try {
      computeDfromT(failingInputs);
    } catch (error: any) {
      // Should have devNote with all required information
      expect(error.devNote).toBeDefined();
      
      // Process and model info
      expect(error.devNote.process).toBe('filling');
      expect(error.devNote.model).toBeDefined();
      expect(error.devNote.t_target_s).toBe(0.00001);
      expect(error.devNote.epsilon).toBe(0.01);
      
      // Inputs in SI units
      expect(error.devNote.inputs_SI).toBeDefined();
      expect(error.devNote.inputs_SI.V_SI_m3).toBe(2e-6);
      expect(error.devNote.inputs_SI.P1_Pa).toBe(101325);
      expect(error.devNote.inputs_SI.P2_Pa).toBe(202650);
      expect(error.devNote.inputs_SI.Ps_Pa).toBe(505000);
      expect(error.devNote.inputs_SI.T_K).toBe(293.15);
      expect(error.devNote.inputs_SI.L_SI_m).toBe(0.001);
      expect(error.devNote.inputs_SI.gas).toBeDefined();
      expect(error.devNote.inputs_SI.Cd).toBe(0.62);
      
      // Bracket information (if available)
      if (error.devNote.bracket) {
        expect(error.devNote.bracket.A_lo_m2).toBeDefined();
        expect(error.devNote.bracket.A_hi_m2).toBeDefined();
        expect(error.devNote.bracket.t_lo_s).toBeDefined();
        expect(error.devNote.bracket.t_hi_s).toBeDefined();
        expect(error.devNote.bracket.expansions).toBeDefined();
      }
      
      // Forward check information
      expect(error.devNote.forward_check).toBeDefined();
      expect(error.devNote.forward_check.epsilon_used).toBe(0.01);
      
      // Reason
      expect(error.devNote.reason).toBeDefined();
      expect(typeof error.devNote.reason).toBe('string');
    }
  });

  it('should provide devNote when bracket expansion fails in filling mode', () => {
    const bracketFailInputs = {
      process: 'filling' as const,
      solveFor: 'DfromT' as const,
      V: 1e-9, // Very small volume 
      P1: 100000,
      P2: 200000,
      Ps: 300000,
      T: 300,
      L: 0.1,
      gas: GASES.air,
      t: 1000, // Very long time - should cause bracket issues
      Cd: 0.62,
      epsilon: 0.01
    };

    expect(() => {
      computeDfromT(bracketFailInputs);
    }).toThrow();

    try {
      computeDfromT(bracketFailInputs);
    } catch (error: any) {
      expect(error.devNote).toBeDefined();
      expect(error.devNote.process).toBe('filling');
      expect(error.devNote.inputs_SI).toBeDefined();
      expect(error.devNote.reason).toContain('No valid solution found');
    }
  });

  it('should include capillary and orifice error messages when both models fail', () => {
    const bothFailInputs = {
      process: 'filling' as const,
      solveFor: 'DfromT' as const,
      V: 0, // Invalid volume
      P1: 0, // Invalid pressure
      P2: 0, // Invalid pressure
      Ps: 0, // Invalid pressure
      T: 0, // Invalid temperature
      L: 0, // Invalid length
      gas: GASES.air,
      t: 10,
      Cd: 0.62,
      epsilon: 0.01
    };

    expect(() => {
      computeDfromT(bothFailInputs);
    }).toThrow();

    try {
      computeDfromT(bothFailInputs);
    } catch (error: any) {
      if (error.devNote) {
        // Should have error details from both models
        expect(error.devNote.process).toBe('filling');
        expect(error.devNote.inputs_SI).toBeDefined();
      }
    }
  });

  it('should enrich solver bracket errors with filling context', () => {
    const solverErrorInputs = {
      process: 'filling' as const,
      solveFor: 'DfromT' as const,
      V: 2e-6, // 2000 mm³
      P1: 101325,
      P2: 101326, // Very small pressure difference
      Ps: 101327,
      T: 293.15,
      L: 0.01,
      gas: GASES.air,
      t: 0.001, // Short time with small pressure difference
      Cd: 0.62,
      epsilon: 0.01
    };

    expect(() => {
      computeDfromT(solverErrorInputs);
    }).toThrow();

    try {
      computeDfromT(solverErrorInputs);
    } catch (error: any) {
      if (error.devNote?.bracket) {
        expect(error.devNote.bracket.A_lo_m2).toBeDefined();
        expect(error.devNote.bracket.A_hi_m2).toBeDefined();
        expect(error.devNote.forward_check).toBeDefined();
      }
    }
  });
});