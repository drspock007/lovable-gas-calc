import { computeTimeFromDiameter } from "@/lib/pipeline-time-from-d";
import { buildSI } from "@/lib/build-si";

describe("Time from Diameter - Acceptance Tests", () => {
  // Gio — mm³ sanity (debug) preset equivalent
  const gioPreset = {
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
    debug: true
  };

  it("Gio preset: D=9µm → t≈175s ±15% (orifice)", () => {
    const ui = { ...gioPreset, diameter: "9", diameterUnit: "µm" };
    const SI = buildSI(ui);
    const result = computeTimeFromDiameter({ ...ui, __SI__: SI, modelOverride: "orifice" });

    // Validation des résultats exposés
    expect(result).toHaveProperty("model", "orifice");
    expect(result).toHaveProperty("D_SI_m");
    expect(result).toHaveProperty("A_SI_m2"); 
    expect(result).toHaveProperty("t_SI_s");
    expect(result).toHaveProperty("debugNote");

    // Validation des valeurs
    expect(result.D_SI_m).toBeCloseTo(9e-6, 12);
    expect(result.A_SI_m2).toBeCloseTo(Math.PI * (9e-6)**2 / 4, 16);
    expect(result.t_SI_s).toBeGreaterThan(150);
    expect(result.t_SI_s).toBeLessThan(200);
  });

  it("Gio preset: D=5µm → t≈540s ±20% (orifice)", () => {
    const ui = { ...gioPreset, diameter: "5", diameterUnit: "µm" };
    const SI = buildSI(ui);
    const result = computeTimeFromDiameter({ ...ui, __SI__: SI, modelOverride: "orifice" });

    expect(result.model).toBe("orifice");
    expect(result.D_SI_m).toBeCloseTo(5e-6, 12);
    expect(result.t_SI_s).toBeGreaterThan(400);
    expect(result.t_SI_s).toBeLessThan(700);
  });

  it("respects user model selection (no auto-switch)", () => {
    const ui = { ...gioPreset, diameter: "10", diameterUnit: "µm" };
    const SI = buildSI(ui);
    
    // Force capillary model
    const capillaryResult = computeTimeFromDiameter({ ...ui, __SI__: SI, modelOverride: "capillary" });
    expect(capillaryResult.model).toBe("capillary");
    
    // Force orifice model  
    const orificeResult = computeTimeFromDiameter({ ...ui, __SI__: SI, modelOverride: "orifice" });
    expect(orificeResult.model).toBe("orifice");
    
    // Results should differ between models
    expect(capillaryResult.t_SI_s).not.toBeCloseTo(orificeResult.t_SI_s, 1);
  });

  it("debug note contains all expected fields", () => {
    const ui = { ...gioPreset, diameter: "7", diameterUnit: "µm" };
    const SI = buildSI(ui);
    const result = computeTimeFromDiameter({ ...ui, __SI__: SI, debug: true });

    const debug = result.debugNote;
    expect(debug).toHaveProperty("diameterRaw", "7");
    expect(debug).toHaveProperty("diameterUnit", "µm");
    expect(debug).toHaveProperty("parsed", 7);
    expect(debug).toHaveProperty("D_SI_m");
    expect(debug).toHaveProperty("A_SI_m2");
    expect(debug).toHaveProperty("model");
    expect(debug).toHaveProperty("t_SI_s");
  });

  it("error handling for invalid diameter", () => {
    const ui = { ...gioPreset, diameter: "invalid", diameterUnit: "µm" };
    const SI = buildSI(ui);

    expect(() => computeTimeFromDiameter({ ...ui, __SI__: SI }))
      .toThrow("Invalid diameter");

    try {
      computeTimeFromDiameter({ ...ui, __SI__: SI });
    } catch (err: any) {
      expect(err.devNote).toHaveProperty("diameterRaw", "invalid");
      expect(err.devNote).toHaveProperty("diameterUnit", "µm");
      expect(err.devNote).toHaveProperty("parsed");
      expect(err.devNote).toHaveProperty("D_SI");
      expect(Number.isNaN(err.devNote.D_SI)).toBe(true);
    }
  });
});