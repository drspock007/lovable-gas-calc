import { describe, it, expect } from 'vitest';
import { buildSI } from '@/lib/build-si';
import { computeTimeFromD } from '@/actions/compute-time-from-d';

describe("ESM Migration & Time-from-D Validation", () => {
  it("should successfully calculate Time-from-D for valid Filling inputs", async () => {
    const ui = {
      process: "filling",
      V: { value: 4, unit: "L" },
      T: { value: 15, unit: "C" },
      P1: { value: 0, unit: "kPa" },
      P2: { value: 600, unit: "kPa" },
      Ps: { value: 1200, unit: "kPa" },
      diameter: { value: 3, unit: "mm" },
      pressureInputMode: "gauge",
      patmMode: "standard",
      gas: "CH4",
      model: "orifice",
      Cd: 0.62
    };

    const result = await computeTimeFromD(ui);
    
    expect(result).toBeDefined();
    expect(typeof result.t_SI_s).toBe('number');
    expect(result.t_SI_s).toBeGreaterThan(0);
    expect(result.t_SI_s).toBeLessThan(10000); // Reasonable time
    expect(result.model).toBe('orifice');
  });

  it("should throw readable error for invalid Filling inequalities", async () => {
    const ui = {
      process: "filling",
      V: { value: 4, unit: "L" },
      T: { value: 15, unit: "C" },
      P1: { value: 800, unit: "kPa" }, // P1 > Pf (invalid)
      P2: { value: 600, unit: "kPa" },
      Ps: { value: 1200, unit: "kPa" },
      diameter: { value: 3, unit: "mm" },
      pressureInputMode: "gauge",
      patmMode: "standard",
      gas: "CH4",
      model: "orifice",
      Cd: 0.62
    };

    try {
      await computeTimeFromD(ui);
      expect.fail("Should have thrown error for invalid inequalities");
    } catch (error: any) {
      expect(error.message).toContain("Invalid filling inequalities");
      expect(error.devNote).toBeDefined();
      expect(error.devNote.process).toBe("filling");
      expect(error.devNote.inputs_SI).toBeDefined();
      expect(error.devNote.inputs_SI.Ps_Pa).toBeGreaterThan(0);
      expect(error.devNote.inputs_SI.Pf_Pa).toBeGreaterThan(0);
      expect(error.devNote.inputs_SI.P1_Pa).toBeGreaterThan(0);
    }
  });

  it("should throw readable error for missing critical parameters", () => {
    const ui = {
      process: "filling",
      V: undefined, // missing volume
      T: { value: 15, unit: "C" },
      P1: { value: 0, unit: "kPa" },
      P2: { value: 600, unit: "kPa" },
      Ps: { value: 1200, unit: "kPa" },
      pressureInputMode: "gauge",
      patmMode: "standard",
      gas: "CH4"
    };

    try {
      buildSI(ui);
      expect.fail("Should have thrown error for missing volume");
    } catch (error: any) {
      expect(error.message).toContain("buildSI: missing");
      expect(error.devNote).toBeDefined();
      expect(error.devNote.inputs_UI).toBeDefined();
      expect(error.devNote.inputs_SI).toBeDefined();
    }
  });

  it("should use unified buildSI for both forward and inverse calculations", () => {
    const ui = {
      process: "filling", 
      V: { value: 4, unit: "L" },
      T: { value: 15, unit: "C" },
      P1: { value: 0, unit: "kPa" },
      P2: { value: 600, unit: "kPa" },
      Ps: { value: 1200, unit: "kPa" },
      pressureInputMode: "gauge",
      patmMode: "standard",
      gas: "CH4"
    };

    const SI = buildSI(ui);
    
    // Check SI structure
    expect(SI.V_SI_m3).toBeCloseTo(0.004, 6); // 4L = 0.004 m³
    expect(SI.T_K).toBeCloseTo(288.15, 2); // 15°C = 288.15K
    expect(SI.P1_Pa).toBeCloseTo(101325, 100); // 0 gauge + 1atm = 101325 Pa
    expect(SI.Pf_Pa).toBeCloseTo(701325, 100); // 600 kPa gauge + 1atm
    expect(SI.Ps_Pa).toBeCloseTo(1301325, 100); // 1200 kPa gauge + 1atm
    expect(SI.gas).toBe("CH4");
    
    // Check inequalities are satisfied
    expect(SI.Ps_Pa).toBeGreaterThan(SI.Pf_Pa);
    expect(SI.Pf_Pa).toBeGreaterThan(SI.P1_Pa);
    expect(SI.P1_Pa).toBeGreaterThan(0);
  });
});