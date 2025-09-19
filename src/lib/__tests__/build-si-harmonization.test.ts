/**
 * Tests d'acceptance pour l'harmonisation de la longueur L
 * Vérifie que buildSI() expose L_SI_m et L_m synchronisés
 */
import { describe, it, expect } from "vitest";
import { buildSI, buildAbsoluteSIFromUI } from "@/lib/build-si";

describe("Builder - Harmonisation longueur L", () => {
  it("buildSI() expose L_SI_m et L_m synchronisés depuis ui.L_SI_m", () => {
    const ui = {
      V_SI_m3: 2e-7,
      T_SI_K: 288.15,
      L_SI_m: 0.002,
      P1: { value: "1200", unit: "kPa" },
      P2: { value: "1", unit: "kPa" },
      gas: { R: 287, gamma: 1.4, mu: 1.8e-5 },
      Cd: 0.62,
      epsilon: 0.01,
      regime: "subcritical",
      pressureInputMode: "absolute",
      patmMode: "standard"
    };

    const result = buildSI(ui);
    
    expect(result.L_SI_m).toBe(0.002);
    expect(result.L_m).toBe(0.002);
    expect(result.L_SI_m).toBe(result.L_m);
  });

  it("buildSI() expose L_SI_m et L_m synchronisés depuis ui.L_m (fallback)", () => {
    const ui = {
      V_SI_m3: 2e-7,
      T_SI_K: 288.15,
      L_m: 0.003, // Pas de L_SI_m
      P1: { value: "1200", unit: "kPa" },
      P2: { value: "1", unit: "kPa" },
      gas: { R: 287, gamma: 1.4, mu: 1.8e-5 },
      Cd: 0.62,
      epsilon: 0.01,
      regime: "subcritical",
      pressureInputMode: "absolute",
      patmMode: "standard"
    };

    const result = buildSI(ui);
    
    expect(result.L_SI_m).toBe(0.003);
    expect(result.L_m).toBe(0.003);
    expect(result.L_SI_m).toBe(result.L_m);
  });

  it("buildAbsoluteSIFromUI() expose L_SI_m et L_m synchronisés", () => {
    const v = {
      V_SI_m3: 2e-7,
      T_SI_K: 288.15,
      L_SI_m: 0.004,
      P1: { value: "1200", unit: "kPa" },
      P2: { value: "1", unit: "kPa" },
      gas: { R: 287, gamma: 1.4, mu: 1.8e-5 },
      Cd: 0.62,
      epsilon: 0.01,
      regime: "subcritical",
      pressureInputMode: "absolute",
      patmMode: "standard"
    };

    const result = buildAbsoluteSIFromUI(v);
    
    expect(result.L_SI_m).toBe(0.004);
    expect(result.L_m).toBe(0.004);
    expect(result.L_SI_m).toBe(result.L_m);
  });
});