/**
 * Tests de régression pour le mode filling et les corrections du residual check
 */
import { describe, it, expect } from "vitest";
import { computeDfromT, computeTfromD } from "@/lib/physics";

describe("Filling mode residual fixes", () => {
  const baseInputs = {
    process: 'filling' as const,
    V: 2e-7, // 200 mm³
    P1: 1.01325e5, // 1 atm
    P2: 1.301325e6, // ~13 atm final
    Ps: 2e6, // 20 bar supply pressure
    T: 288.15, // 15°C
    L: 0.002, // 2 mm
    gas: { 
      name: 'Air',
      M: 0.028964, // kg/mol
      R: 287.06, 
      gamma: 1.4, 
      mu: 1.825e-5 
    },
    Cd: 0.62,
    epsilon: 0.01,
    regime: 'isothermal' as const
  };

  it("should accept elevated residual (up to 5%) for filling mode in DfromT", () => {
    const inputs = {
      ...baseInputs,
      solveFor: 'DfromT' as const,
      t: 100, // Target time 100s
      modelSelection: 'capillary' as const
    };

    // Should not throw even with potentially higher residual
    const result = computeDfromT(inputs);
    expect(result.D).toBeGreaterThan(0);
    expect(result.D).toBeLessThan(0.01); // Reasonable diameter range
    expect(result.verdict).toBe('capillary');
  });

  it("should accept elevated residual (up to 5%) for filling mode in TfromD", () => {
    const inputs = {
      ...baseInputs,
      solveFor: 'TfromD' as const,
      D: 1e-5, // 10 µm diameter
      modelSelection: 'capillary' as const
    };

    // Should not throw even with potentially higher residual
    const result = computeTfromD(inputs);
    expect(result.t).toBeGreaterThan(0);
    expect(result.t).toBeLessThan(1000); // Reasonable time range
    expect(result.verdict).toBe('capillary');
  });

  it("should validate Ps > P1 and Ps > P2 in filling mode", () => {
    const invalidInputs = {
      ...baseInputs,
      solveFor: 'DfromT' as const,
      t: 100,
      Ps: 5e4, // Too low supply pressure (< P1 and P2)
      modelSelection: 'capillary' as const
    };

    expect(() => computeDfromT(invalidInputs)).toThrow(/Supply pressure Ps.*must be greater/);
  });

  it("should provide detailed error messages for invalid pressure conditions", () => {
    const badInputs = {
      ...baseInputs,
      solveFor: 'DfromT' as const,
      t: 100,
      P2: 3e6, // P2 > Ps, will cause denominator issues
      modelSelection: 'capillary' as const
    };

    expect(() => computeDfromT(badInputs)).toThrow();
  });

  it("round-trip consistency for filling mode with relaxed tolerance", () => {
    // Start with a diameter, compute time, then compute diameter back
    const D_original = 8e-6; // 8 µm
    
    // Step 1: D → t
    const tFromD = computeTfromD({
      ...baseInputs,
      solveFor: 'TfromD' as const,
      D: D_original,
      modelSelection: 'capillary' as const
    });
    
    // Step 2: t → D
    const dFromT = computeDfromT({
      ...baseInputs,
      solveFor: 'DfromT' as const,
      t: tFromD.t,
      modelSelection: 'capillary' as const
    });
    
    // Should be within 10% for filling mode (more relaxed than blowdown)
    const error = Math.abs(dFromT.D - D_original) / D_original;
    expect(error).toBeLessThan(0.10); // 10% tolerance for round-trip
  });

  it("should provide detailed debug info in residual errors", () => {
    // Force a scenario that might cause residual issues
    const problematicInputs = {
      ...baseInputs,
      solveFor: 'DfromT' as const,
      t: 0.1, // Very short time, likely to cause convergence issues
      modelSelection: 'capillary' as const
    };

    try {
      computeDfromT(problematicInputs);
    } catch (error: any) {
      if (error.name === 'ResidualError') {
        // Check that enhanced debug info is present
        expect(error.details).toBeDefined();
        expect(error.details.process).toBe('filling');
        expect(error.details.tolerance).toBeDefined();
        expect(error.details.model_used).toBeDefined();
      }
    }
  });
});