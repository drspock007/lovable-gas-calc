import { describe, it, expect } from 'vitest';
import { computeDfromT, GASES } from '../physics';

describe('Isothermal Orifice - GIO Test Case', () => {
  it('should solve isothermal orifice without root finding for specific GIO inputs', () => {
    const inputs = {
      process: 'blowdown' as const,
      solveFor: 'DfromT' as const,
      V: 2e-7, // m³
      P1: 1.2e6, // Pa
      P2: 1e3, // Pa
      T: 288.15, // K
      L: 0.002, // m
      gas: GASES.air,
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal' as const,
      t: 175 // s
    };

    const result = computeDfromT(inputs);
    
    // Should converge successfully
    expect(result.error).toBeUndefined();
    expect(result.D).toBeDefined();
    expect(result.solverResultSI?.D_SI_m).toBeDefined();
    
    const D_SI_m = result.solverResultSI!.D_SI_m!;
    const t_check = result.solverResultSI?.t_SI_s;
    
    // Diameter should be in expected range [7e-6, 1.2e-5] m
    expect(D_SI_m).toBeGreaterThanOrEqual(7e-6);
    expect(D_SI_m).toBeLessThanOrEqual(1.2e-5);
    
    // Residual check: |t_check - 175| / 175 ≤ 0.01 (1%)
    expect(t_check).toBeDefined();
    const residualError = Math.abs(t_check! - 175) / 175;
    expect(residualError).toBeLessThanOrEqual(0.01);
    
    // Should prefer isothermal orifice model
    expect(result.verdict).toBe('orifice');
    
    // Check that isothermal solver was used (should have I_total diagnostic)
    expect(result.solverResultSI?.diag?.I_total).toBeDefined();
    
    console.log(`GIO Isothermal Test Results:`);
    console.log(`  D_SI_m = ${D_SI_m.toExponential(3)} m`);
    console.log(`  t_check = ${t_check?.toFixed(1)} s (target: 175 s)`);
    console.log(`  Residual = ${(residualError * 100).toFixed(2)}%`);
    console.log(`  I_total = ${result.solverResultSI?.diag?.I_total}`);
  });

  it('should handle edge case with very low pressure ratio', () => {
    const inputs = {
      process: 'blowdown' as const,
      solveFor: 'DfromT' as const,
      V: 1e-6, // m³
      P1: 2e5, // Pa
      P2: 1e3, // Pa (high pressure ratio)
      T: 300, // K
      L: 0.001, // m
      gas: GASES.air,
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal' as const,
      t: 100 // s
    };

    const result = computeDfromT(inputs);
    
    // Should still converge
    expect(result.error).toBeUndefined();
    expect(result.D).toBeDefined();
    expect(result.solverResultSI?.D_SI_m).toBeDefined();
    
    const D_SI_m = result.solverResultSI!.D_SI_m!;
    const t_check = result.solverResultSI?.t_SI_s;
    
    // Basic sanity checks
    expect(D_SI_m).toBeGreaterThan(0);
    expect(D_SI_m).toBeLessThan(0.01); // Should be reasonable size
    
    if (t_check) {
      const residualError = Math.abs(t_check - 100) / 100;
      // Allow slightly higher tolerance for edge cases
      expect(residualError).toBeLessThanOrEqual(0.05);
    }
  });
});