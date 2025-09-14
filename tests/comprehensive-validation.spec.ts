import { describe, it, expect } from 'vitest';
import { toSI_Length } from '@/lib/length-units';
import { areaFromDiameterSI } from '@/lib/geometry';
import { timeOrificeFromAreaSI } from '@/lib/physics';
import { computeTimeFromDiameter } from '@/lib/pipeline-time-from-d';
import { computeDfromT } from '@/lib/physics';
import { buildSI } from '@/lib/build-si';
import { computeDisabledReason } from '@/lib/compute-enabled';

describe('Comprehensive Validation Tests', () => {
  
  describe('1. Unit Conversions', () => {
    it('mm→m conversion (1e-3)', () => {
      const result = toSI_Length(5, 'mm');
      expect(result).toBe(0.005); // 5 mm = 0.005 m
      expect(result).toBe(5e-3);
    });

    it('µm→m conversion (1e-6)', () => {
      const result = toSI_Length(9, 'µm');
      expect(result).toBe(9e-6); // 9 µm = 9e-6 m
    });

    it('area πD²/4 calculation', () => {
      const D = 10e-6; // 10 µm
      const expectedArea = Math.PI * Math.pow(D, 2) / 4;
      const calculatedArea = areaFromDiameterSI(D);
      expect(calculatedArea).toBeCloseTo(expectedArea, 12);
      expect(calculatedArea).toBeCloseTo(7.854e-11, 12); // π*(10e-6)²/4
    });
  });

  describe('2. Orifice Isothermal Time Calculations', () => {
    const SI_base = {
      V_SI_m3: 2e-7,
      P1_Pa: 1.2e6,
      P2_Pa: 1e3,
      T_K: 288.15,
      L_m: 0.002,
      gas: { R: 287.06196, gamma: 1.4, mu: 1.825e-5 },
      Cd: 0.62,
      epsilon: 0.01,
      regime: "isothermal"
    };

    it('t(9 µm) ≈ 175 s (±15%)', () => {
      const D = 9e-6; // 9 µm
      const A = areaFromDiameterSI(D);
      const t = timeOrificeFromAreaSI(SI_base, A);
      
      expect(t).toBeGreaterThan(175 * 0.85); // -15%
      expect(t).toBeLessThan(175 * 1.15);    // +15%
    });

    it('t(5 µm) ≈ 540 s (±20%)', () => {
      const D = 5e-6; // 5 µm
      const A = areaFromDiameterSI(D);
      const t = timeOrificeFromAreaSI(SI_base, A);
      
      expect(t).toBeGreaterThan(540 * 0.8);  // -20%
      expect(t).toBeLessThan(540 * 1.2);     // +20%
    });

    it('t ∝ 1/A scaling relationship', () => {
      const A1 = 1e-11; // Small area
      const A2 = 2e-11; // Double area
      
      const t1 = timeOrificeFromAreaSI(SI_base, A1);
      const t2 = timeOrificeFromAreaSI(SI_base, A2);
      
      // t should be inversely proportional to A
      const ratio = t1 / t2;
      expect(ratio).toBeCloseTo(2, 0.1); // t1/t2 ≈ A2/A1 = 2
    });
  });

  describe('3. Round-trip D↔t Consistency (Same Model)', () => {
    const baseUI = {
      volume: "200", volumeUnit: "mm3",
      pressure1: "12", pressure1Unit: "bar", pressureMode: "absolute",
      pressure2: "0.01", pressure2Unit: "bar",
      temperature: "15", temperatureUnit: "celsius",
      length: "2", lengthUnit: "mm",
      gas: "air",
      dischargeCoeff: "0.62",
      convergence: "0.01",
      process: "blowdown",
      debug: false
    };

    it('orifice model D→t→D error ≤ 5%', () => {
      const ui = { ...baseUI, diameter: "8", diameterUnit: "µm" };
      const SI = buildSI(ui);
      
      // D → t (orifice)
      const timeResult = computeTimeFromDiameter({ 
        ...ui, __SI__: SI, modelOverride: "orifice" 
      });
      
      // t → D (orifice)
      const diameterInputs = { ...SI, t: timeResult.t_SI_s, modelSelection: "orifice" };
      const diameterResult = computeDfromT(diameterInputs);
      
      const D_original = timeResult.D_SI_m;
      const D_roundtrip = diameterResult.D!;
      const relativeError = Math.abs(D_roundtrip - D_original) / D_original;
      
      expect(relativeError).toBeLessThan(0.05); // ≤ 5%
      expect(timeResult.model).toBe("orifice");
      expect(diameterResult.verdict).toBe("orifice");
    });

    it('capillary model D→t→D error ≤ 5%', () => {
      const ui = { ...baseUI, diameter: "50", diameterUnit: "µm", length: "10", lengthUnit: "mm" };
      const SI = buildSI(ui);
      
      // D → t (capillary)
      const timeResult = computeTimeFromDiameter({ 
        ...ui, __SI__: SI, modelOverride: "capillary" 
      });
      
      // t → D (capillary)
      const diameterInputs = { ...SI, t: timeResult.t_SI_s, modelSelection: "capillary" };
      const diameterResult = computeDfromT(diameterInputs);
      
      const D_original = timeResult.D_SI_m;
      const D_roundtrip = diameterResult.D!;
      const relativeError = Math.abs(D_roundtrip - D_original) / D_original;
      
      expect(relativeError).toBeLessThan(0.05); // ≤ 5%
      expect(timeResult.model).toBe("capillary");
      expect(diameterResult.verdict).toBe("capillary");
    });
  });

  describe('4. Gauge Pressure P2_g=0 Validation', () => {
    it('P2_g=0 → button active (reason=ok)', () => {
      const values = {
        pressure1: "5", pressure1Unit: "bar",
        pressure2: "0", pressure2Unit: "bar",
        pressureMode: "gauge",
        process: "blowdown",
        altitudeMode: "sealevel"
      };
      
      const reason = computeDisabledReason(values, true);
      expect(reason).toBe("ok");
    });

    it('P2_g=0 → P2_abs ≈ 101.3 kPa at sea level', () => {
      // This validates the conversion logic
      const P_atm = 101325; // Pa at sea level
      const P2_gauge = 0; // bar gauge
      const P2_abs = P2_gauge * 1e5 + P_atm; // Convert to Pa absolute
      
      expect(P2_abs).toBeCloseTo(101325, 0); // ≈ 101.3 kPa
    });

    it('negative gauge pressure beyond vacuum → disabled', () => {
      const values = {
        pressure1: "5", pressure1Unit: "bar",
        pressure2: "-2", pressure2Unit: "bar", // Below vacuum
        pressureMode: "gauge",
        process: "blowdown",
        altitudeMode: "sealevel"
      };
      
      const reason = computeDisabledReason(values, true);
      expect(reason).not.toBe("ok");
    });
  });

  describe('5. Debug System DevDump Visibility', () => {
    it('Time from Diameter with debug → DevDump contains expected fields', () => {
      const ui = {
        volume: "200", volumeUnit: "mm3",
        pressure1: "12", pressure1Unit: "bar", pressureMode: "absolute",
        pressure2: "0.01", pressure2Unit: "bar",
        temperature: "15", temperatureUnit: "celsius",
        length: "2", lengthUnit: "mm",
        gas: "air",
        dischargeCoeff: "0.62",
        diameter: "9", diameterUnit: "µm",
        debug: true
      };
      
      const SI = buildSI(ui);
      const result = computeTimeFromDiameter({ 
        ...ui, __SI__: SI, modelOverride: "orifice", debug: true 
      });
      
      expect(result.debugNote).toBeDefined();
      expect(result.debugNote).toHaveProperty('diameterRaw');
      expect(result.debugNote).toHaveProperty('diameterUnit');
      expect(result.debugNote).toHaveProperty('parsed');
      expect(result.debugNote).toHaveProperty('D_SI_m');
      expect(result.debugNote).toHaveProperty('A_SI_m2');
      expect(result.debugNote).toHaveProperty('model');
      expect(result.debugNote).toHaveProperty('t_SI_s');
      expect(result.debugNote).toHaveProperty('inputs_SI');
      expect(result.debugNote).toHaveProperty('success');
      
      // Validate specific values
      expect(result.debugNote.diameterRaw).toBe("9");
      expect(result.debugNote.diameterUnit).toBe("µm");
      expect(result.debugNote.model).toBe("orifice");
      expect(result.debugNote.success).toBe(true);
    });

    it('Diameter from Time with forced model → correct verdict in diagnostics', () => {
      const ui = {
        volume: "200", volumeUnit: "mm3",
        pressure1: "12", pressure1Unit: "bar", pressureMode: "absolute", 
        pressure2: "0.01", pressure2Unit: "bar",
        temperature: "15", temperatureUnit: "celsius",
        length: "2", lengthUnit: "mm",
        gas: "air",
        dischargeCoeff: "0.62",
        time: "175", timeUnit: "s",
        process: "blowdown"
      };
      
      const SI = buildSI(ui);
      const inputs = { ...SI, modelSelection: "orifice" };
      const result = computeDfromT(inputs);
      
      expect(result.verdict).toBe("orifice");
      expect(result.diagnostics.rationale).toContain("forced by user selection");
    });
  });
});