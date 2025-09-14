import { describe, it, expect } from 'vitest';
import { computeDfromT } from '@/lib/physics';
import { computeTimeFromDiameter } from '@/lib/pipeline-time-from-d';
import { buildSI } from '@/lib/build-si';

describe('Unified Model Selection Tests', () => {
  const baseUI = {
    volume: "200", volumeUnit: "mm3",
    pressure1: "12", pressure1Unit: "bar", pressureMode: "absolute",
    pressure2: "0.01", pressure2Unit: "bar", 
    temperature: "15", temperatureUnit: "celsius",
    length: "2", lengthUnit: "mm",
    gas: "air",
    dischargeCoeff: "0.62",
    convergence: "0.01",
    model: "orifice",
    process: "blowdown",
    debug: false
  };

  describe('DfromT respects modelSelection', () => {
    it('forces orifice model when modelSelection=orifice', () => {
      const ui = { ...baseUI, time: "175", timeUnit: "s", modelSelection: "orifice" };
      const SI = buildSI(ui);
      const inputs = { ...SI, modelSelection: "orifice" };
      
      const result = computeDfromT(inputs);
      
      expect(result.verdict).toBe('orifice');
      expect(result.diagnostics.rationale).toContain('forced by user selection');
    });

    it('forces capillary model when modelSelection=capillary', () => {
      const ui = { ...baseUI, time: "1000", timeUnit: "s", modelSelection: "capillary" };
      const SI = buildSI(ui);
      const inputs = { ...SI, modelSelection: "capillary" };
      
      const result = computeDfromT(inputs);
      
      expect(result.verdict).toBe('capillary');
      expect(result.diagnostics.rationale).toContain('forced by user selection');
    });
  });

  describe('TfromD uses modelSelection', () => {
    it('uses orifice model when modelOverride=orifice', () => {
      const ui = { ...baseUI, diameter: "9", diameterUnit: "µm" };
      const SI = buildSI(ui);
      const result = computeTimeFromDiameter({ ...ui, __SI__: SI, modelOverride: "orifice" });
      
      expect(result.model).toBe("orifice");
    });

    it('uses capillary model when modelOverride=capillary', () => {
      const ui = { ...baseUI, diameter: "9", diameterUnit: "µm" };
      const SI = buildSI(ui);
      const result = computeTimeFromDiameter({ ...ui, __SI__: SI, modelOverride: "capillary" });
      
      expect(result.model).toBe("capillary");
    });
  });

  describe('Round-trip consistency with same model', () => {
    it('orifice model: D→t→D accuracy ±5%', () => {
      const ui = { ...baseUI, diameter: "8", diameterUnit: "µm" };
      const SI = buildSI(ui);
      
      // D → t (orifice)
      const timeResult = computeTimeFromDiameter({ ...ui, __SI__: SI, modelOverride: "orifice" });
      
      // t → D (orifice)
      const diameterInputs = { ...SI, t: timeResult.t_SI_s, modelSelection: "orifice" };
      const diameterResult = computeDfromT(diameterInputs);
      
      const D_original = timeResult.D_SI_m;
      const D_roundtrip = diameterResult.D!;
      const error = Math.abs(D_roundtrip - D_original) / D_original;
      
      expect(error).toBeLessThan(0.05); // ±5%
      expect(timeResult.model).toBe("orifice");
      expect(diameterResult.verdict).toBe("orifice");
    });

    it('capillary model: D→t→D accuracy ±5%', () => {
      const ui = { ...baseUI, diameter: "50", diameterUnit: "µm", length: "10", lengthUnit: "mm" };
      const SI = buildSI(ui);
      
      // D → t (capillary)
      const timeResult = computeTimeFromDiameter({ ...ui, __SI__: SI, modelOverride: "capillary" });
      
      // t → D (capillary) 
      const diameterInputs = { ...SI, t: timeResult.t_SI_s, modelSelection: "capillary" };
      const diameterResult = computeDfromT(diameterInputs);
      
      const D_original = timeResult.D_SI_m;
      const D_roundtrip = diameterResult.D!;
      const error = Math.abs(D_roundtrip - D_original) / D_original;
      
      expect(error).toBeLessThan(0.05); // ±5%
      expect(timeResult.model).toBe("capillary");
      expect(diameterResult.verdict).toBe("capillary");
    });
  });

  describe('Debug output consistency', () => {
    it('TfromD debug shows selected model', () => {
      const ui = { ...baseUI, diameter: "9", diameterUnit: "µm", debug: true };
      const SI = buildSI(ui);
      const result = computeTimeFromDiameter({ ...ui, __SI__: SI, modelOverride: "orifice", debug: true });
      
      expect(result.model).toBe("orifice");
      expect(result.debugNote).toBeDefined();
      expect(result.debugNote.model).toBe("orifice");
      expect(result.debugNote.diameterRaw).toBe("9");
      expect(result.debugNote.diameterUnit).toBe("µm");
    });

    it('DfromT debug shows selected model', () => {
      const ui = { ...baseUI, time: "175", timeUnit: "s" };
      const SI = buildSI(ui);
      const inputs = { ...SI, modelSelection: "orifice" };
      const result = computeDfromT(inputs);
      
      expect(result.verdict).toBe("orifice");
      expect(result.diagnostics.rationale).toContain("forced by user selection");
    });
  });
});