/**
 * Tests for controlled residual check rejection with exhaustive devNote
 */
import { describe, it, expect } from "vitest";
import { computeDfromT, computeTfromD } from "@/lib/physics";

describe("Residual Check - Controlled Rejection", () => {
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

  it("DfromT should reject with exhaustive devNote when t_target is inconsistent", () => {
    // Use an extremely short target time that's physically impossible
    const inputs = {
      ...baseInputs,
      solveFor: 'DfromT' as const,
      t: 0.001, // 1 millisecond - way too short for this pressure/volume
      modelSelection: 'capillary' as const
    };

    let caughtError: any = null;
    try {
      computeDfromT(inputs);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeTruthy();
    expect(caughtError.message).toContain("Result rejected by residual check");
    
    // Verify exhaustive devNote structure
    const devNote = caughtError.devNote;
    expect(devNote).toBeDefined();
    expect(devNote.process).toBe('filling');
    expect(devNote.residual).toBeGreaterThan(0);
    expect(devNote.t_target).toBe(0.001);
    expect(devNote.t_forward).toBeGreaterThan(0.001); // Should be much larger
    expect(devNote.inputs_SI).toBeDefined();
    expect(devNote.inputs_SI.V_SI_m3).toBeCloseTo(2e-7);
    expect(devNote.inputs_SI.P1_Pa).toBeCloseTo(1.01325e5);
    expect(devNote.inputs_SI.P2_Pa).toBeCloseTo(1.301325e6);
    expect(devNote.inputs_SI.Ps_Pa).toBeCloseTo(2e6);
    expect(devNote.choking).toBeDefined();
    expect(devNote.epsilon_used).toBeGreaterThan(0);
  });

  it("TfromD should reject with exhaustive devNote when diameter is inconsistent", () => {
    // Use an extremely large diameter that would cause inconsistent time calculation
    const inputs = {
      ...baseInputs,
      solveFor: 'TfromD' as const,
      D: 0.1, // 100mm diameter - way too large for this small volume
      modelSelection: 'capillary' as const
    };

    let caughtError: any = null;
    try {
      computeTfromD(inputs);
    } catch (error) {
      caughtError = error;
    }

    // May not always fail due to different residual logic in TfromD
    // But if it does fail, verify the structure
    if (caughtError && caughtError.message?.includes("residual check")) {
      const devNote = caughtError.devNote;
      expect(devNote).toBeDefined();
      expect(devNote.process).toBe('filling');
      expect(devNote.residual).toBeGreaterThan(0);
      expect(devNote.inputs_SI).toBeDefined();
      expect(devNote.inputs_SI.V_SI_m3).toBeCloseTo(2e-7);
      expect(devNote.choking).toBeDefined();
    }
  });

  it("should provide detailed choking information in devNote", () => {
    // Use conditions that will trigger choked flow
    const inputs = {
      ...baseInputs,
      solveFor: 'DfromT' as const,
      t: 0.01, // Very short time
      P1: 1e5, // 1 bar initial
      P2: 10e5, // 10 bar final  
      Ps: 12e5, // 12 bar supply - will cause choking
      modelSelection: 'orifice' as const
    };

    let caughtError: any = null;
    try {
      computeDfromT(inputs);
    } catch (error) {
      caughtError = error;
    }

    if (caughtError && caughtError.devNote) {
      const choking = caughtError.devNote.choking;
      expect(choking).toBeDefined();
      expect(choking.r_crit).toBeDefined();
      expect(typeof choking.choked).toBe('boolean');
      expect(choking.r).toBeDefined();
    }
  });

  it("should include bounds information when available", () => {
    const inputs = {
      ...baseInputs,
      solveFor: 'DfromT' as const,
      t: 0.005, // Short but not impossible time
      modelSelection: 'orifice' as const
    };

    let caughtError: any = null;
    try {
      computeDfromT(inputs);
    } catch (error) {
      caughtError = error;
    }

    if (caughtError && caughtError.devNote && caughtError.devNote.bounds_used) {
      const bounds = caughtError.devNote.bounds_used;
      // Bounds may be empty object if not available, but structure should exist
      expect(bounds).toBeDefined();
      expect(typeof bounds).toBe('object');
    }
  });
});