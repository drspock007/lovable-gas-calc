import { toSI_Length, normalizeLengthUnit } from "@/lib/length-units";
import { areaFromDiameterSI } from "@/lib/geometry";
import { timeOrificeFromAreaSI } from "@/lib/physics";

describe("Length Units Corrections", () => {
  it("converts µm correctly to SI", () => {
    const D_raw = 0.005; // 0.005 µm
    const D_SI = toSI_Length(D_raw, "µm");
    expect(D_SI).toBeCloseTo(5e-9, 12); // 5 nanometers in SI
  });

  it("converts 5 µm to 5e-6 m", () => {
    const D_SI = toSI_Length(5, "µm");
    expect(D_SI).toBeCloseTo(5e-6, 12);
  });

  it("converts 9 µm to 9e-6 m", () => {
    const D_SI = toSI_Length(9, "µm");
    expect(D_SI).toBeCloseTo(9e-6, 12);
  });

  it("normalizes µm variants correctly", () => {
    expect(normalizeLengthUnit("µm")).toBe("µm");
    expect(normalizeLengthUnit("um")).toBe("µm");
    expect(normalizeLengthUnit("μm")).toBe("µm");
  });

  it("computes area coherently from 0.005 mm diameter", () => {
    const D_raw = 0.005; // 0.005 mm = 5e-6 m
    const D_SI = toSI_Length(D_raw, "mm");
    expect(D_SI).toBeCloseTo(5e-6, 12);
    
    const A = areaFromDiameterSI(D_SI);
    expect(A).toBeGreaterThan(1e-12);
    expect(A).toBeLessThan(1e-9);
  });

  it("orifice time scales as 1/A", () => {
    const SI = { 
      V_SI_m3: 2e-7, P1_Pa: 1.2e6, P2_Pa: 1e3, T_K: 288.15,
      L_SI_m: 0.002, gas: {R: 287.06, gamma: 1.4, mu: 1.825e-5}, 
      Cd: 0.62, epsilon: 0.01 
    };
    
    const t1 = timeOrificeFromAreaSI(SI, 2e-11);
    const t2 = timeOrificeFromAreaSI(SI, 1e-11);
    expect(t2/t1).toBeCloseTo(2, 0); // t ∝ 1/A
  });

  it("D=5µm gives t≈400-700s (orifice)", () => {
    const SI = { 
      V_SI_m3: 2e-7, P1_Pa: 1.2e6, P2_Pa: 1e3, T_K: 288.15,
      L_SI_m: 0.002, gas: {R: 287.06196, gamma: 1.4, mu: 1.825e-5}, 
      Cd: 0.62, epsilon: 0.01 
    };
    
    const D_SI = toSI_Length(5, "µm"); // 5e-6 m
    const A = areaFromDiameterSI(D_SI);
    const t = timeOrificeFromAreaSI(SI, A);
    expect(t).toBeGreaterThan(400);
    expect(t).toBeLessThan(700);
  });
});