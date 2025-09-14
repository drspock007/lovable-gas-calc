import { computeTimeFromDiameter } from "@/lib/pipeline-time-from-d";
import { computeDfromT } from "@/lib/physics";
import { buildSI } from "@/lib/build-si";

describe("Time from Diameter Round-Trip Tests", () => {
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

  it("D=9µm → t≈175s ± 15% (orifice)", () => {
    const ui = { ...baseUI, diameter: "9", diameterUnit: "µm" };
    const SI = buildSI(ui);
    const result = computeTimeFromDiameter({ ...ui, __SI__: SI, modelOverride: "orifice" });
    
    expect(result.t_SI_s).toBeGreaterThan(150);
    expect(result.t_SI_s).toBeLessThan(200);
    expect(result.model).toBe("orifice");
  });

  it("D=5µm → t≈540s ± 20% (orifice)", () => {
    const ui = { ...baseUI, diameter: "5", diameterUnit: "µm" };
    const SI = buildSI(ui);
    const result = computeTimeFromDiameter({ ...ui, __SI__: SI, modelOverride: "orifice" });
    
    expect(result.t_SI_s).toBeGreaterThan(400);
    expect(result.t_SI_s).toBeLessThan(700);
    expect(result.model).toBe("orifice");
  });

  it("round-trip D→t→D accuracy ±5%", () => {
    const ui = { ...baseUI, diameter: "8", diameterUnit: "µm" };
    const SI = buildSI(ui);
    
    // D → t
    const timeResult = computeTimeFromDiameter({ ...ui, __SI__: SI, modelOverride: "orifice" });
    const t_computed = timeResult.t_SI_s;
    
    // t → D  
    const diameterUI = { ...ui, time: t_computed.toString(), timeUnit: "s" };
    const diameterSI = buildSI(diameterUI);
    const diameterResult = computeDfromT({
      ...diameterUI,
      __SI__: diameterSI,
      modelOverride: "orifice",
      solveFor: "DfromT",
      process: "blowdown",
      debug: false
    });
    
    const D_original = timeResult.D_SI_m;
    const D_roundtrip = diameterResult.D;
    const error = Math.abs(D_roundtrip - D_original) / D_original;
    
    expect(error).toBeLessThan(0.05); // ±5%
  });

  it("invalid diameter handling", () => {
    const ui = { ...baseUI, diameter: "abc", diameterUnit: "µm" };
    const SI = buildSI(ui);
    
    expect(() => computeTimeFromDiameter({ ...ui, __SI__: SI }))
      .toThrow("Invalid diameter");
  });

  it("zero diameter handling", () => {
    const ui = { ...baseUI, diameter: "0", diameterUnit: "µm" };
    const SI = buildSI(ui);
    
    expect(() => computeTimeFromDiameter({ ...ui, __SI__: SI }))
      .toThrow("Invalid diameter");
  });
});