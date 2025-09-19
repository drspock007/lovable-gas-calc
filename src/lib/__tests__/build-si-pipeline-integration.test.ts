/**
 * Tests d'intégration buildSI → pipeline Time-from-D
 * Couvre preset Gio, happy path et validation de garde
 */
import { describe, it, expect } from "vitest";
import { buildSI } from "@/lib/build-si";
import { computeTimeFromDiameter } from "@/lib/pipeline-time-from-d";

describe("buildSI → pipeline integration", () => {
  it("buildSI preset Gio - conversion UI → SI", () => {
    const uiValues = {
      // Volume: 200 mm³ → 2e-7 m³
      V: { value: "200", unit: "mm3" },
      // Température: 15°C → 288.15 K
      T: { value: "15", unit: "C" },
      // Pressions gauge: 1200 kPa g → ~1.301325e6 Pa abs, 1 kPa g → ~1.01325e5 Pa abs
      P1: { value: "1200", unit: "kPa" },
      P2: { value: "1", unit: "kPa" },
      pressureInputMode: "gauge",
      patmMode: "standard",
      // Longueur: 2 mm → 0.002 m
      L: { value: "2", unit: "mm" },
      // Paramètres par défaut
      gas: { R: 287, gamma: 1.4, mu: 1.8e-5 },
      Cd: 0.62,
      epsilon: 0.01,
      regime: "subcritical"
    };

    const SI = buildSI(uiValues);

    expect(SI.V_SI_m3).toBeCloseTo(2e-7, 10);
    expect(SI.T_K).toBeCloseTo(288.15, 2);
    expect(SI.P1_Pa).toBeCloseTo(1.301325e6, -2); // ~1301325 Pa
    expect(SI.P2_Pa).toBeCloseTo(1.01325e5, -2);  // ~101325 Pa
    expect(SI.L_SI_m).toBeCloseTo(0.002, 6);
    expect(SI.L_m).toBeCloseTo(0.002, 6); // Backward compatibility
  });

  it("pipeline Time-from-D happy path (orifice, D=9 µm)", () => {
    const values = {
      diameter: "9",
      diameterUnit: "µm",
      model: "orifice",
      debug: false,
      __SI__: {
        V_SI_m3: 2e-7,
        P1_Pa: 1.301325e6,
        P2_Pa: 1.01325e5,
        T_K: 288.15,
        L_SI_m: 0.002,
        gas: { R: 287, gamma: 1.4, mu: 1.8e-5 },
        Cd: 0.62,
        epsilon: 0.01,
        regime: "subcritical"
      }
    };

    const result = computeTimeFromDiameter(values);

    expect(result.model).toBe("orifice");
    expect(result.D_SI_m).toBeCloseTo(9e-6, 10);
    expect(result.A_SI_m2).toBeCloseTo(Math.PI * (9e-6/2)**2, 15);
    expect(result.t_SI_s).toBeGreaterThan(150);
    expect(result.t_SI_s).toBeLessThan(200);
    expect(Number.isFinite(result.t_SI_s)).toBe(true);
  });

  it("guard - Inputs missing P1_Pa throws avec devNote", () => {
    const valuesWithoutP1 = {
      diameter: "9",
      diameterUnit: "µm",
      model: "orifice",
      debug: false,
      __SI__: {
        V_SI_m3: 2e-7,
        // P1_Pa manquant (undefined/null)
        P2_Pa: 1.01325e5,
        T_K: 288.15,
        L_SI_m: 0.002,
        gas: { R: 287, gamma: 1.4, mu: 1.8e-5 },
        Cd: 0.62,
        epsilon: 0.01,
        regime: "subcritical"
      }
    };

    expect(() => {
      computeTimeFromDiameter(valuesWithoutP1);
    }).toThrow();

    try {
      computeTimeFromDiameter(valuesWithoutP1);
    } catch (error: any) {
      expect(error.message).toBe("Inputs missing: P1_Pa");
      expect(error.devNote).toBeDefined();
      expect(error.devNote.inputs_SI).toBeDefined();
      expect(error.devNote.inputs_SI.P1_Pa).toBeUndefined();
      expect(error.devNote.inputs_SI.V_SI_m3).toBe(2e-7);
      expect(error.devNote.inputs_SI.P2_Pa).toBe(1.01325e5);
    }
  });
});