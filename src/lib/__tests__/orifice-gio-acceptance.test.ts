/**
 * Tests d'acceptance pour le calcul orifice avec preset Gio
 * Vérifie les temps de calcul pour diamètres spécifiques
 */
import { describe, it, expect } from "vitest";
import { timeOrificeFromAreaSI } from "@/lib/physics";
import { areaFromDiameterSI } from "@/lib/geometry";

describe("Orifice - Preset Gio Acceptance", () => {
  // Preset Gio typique
  const SI_Gio = {
    V_SI_m3: 2e-7,
    P1_Pa: 1.2e6,
    P2_Pa: 1e3,
    T_K: 288.15,
    L_SI_m: 0.002,
    L_m: 0.002,
    gas: { R: 287.06196, gamma: 1.4, mu: 1.825e-5 },
    Cd: 0.62,
    epsilon: 0.01
  };

  it("D=9 µm → t ≈ 175 s (±15%)", () => {
    const A_SI = areaFromDiameterSI(9e-6); // 9 µm en mètres
    const t_SI = timeOrificeFromAreaSI(SI_Gio, A_SI);
    
    expect(t_SI).toBeGreaterThan(175 * 0.85); // -15%
    expect(t_SI).toBeLessThan(175 * 1.15);    // +15%
    expect(Number.isFinite(t_SI)).toBe(true);
  });

  it("D=5 µm → t ≈ 540 s (±20%)", () => {
    const A_SI = areaFromDiameterSI(5e-6); // 5 µm en mètres
    const t_SI = timeOrificeFromAreaSI(SI_Gio, A_SI);
    
    expect(t_SI).toBeGreaterThan(540 * 0.8); // -20%
    expect(t_SI).toBeLessThan(540 * 1.2);    // +20%
    expect(Number.isFinite(t_SI)).toBe(true);
  });

  it("Scaling: t ∝ 1/A (vérification ordre de grandeur)", () => {
    const A1 = areaFromDiameterSI(10e-6);
    const A2 = areaFromDiameterSI(5e-6); // A2 = A1/4
    
    const t1 = timeOrificeFromAreaSI(SI_Gio, A1);
    const t2 = timeOrificeFromAreaSI(SI_Gio, A2);
    
    // t2 devrait être ~4x plus grand que t1
    const ratio = t2 / t1;
    expect(ratio).toBeGreaterThan(3.5);
    expect(ratio).toBeLessThan(4.5);
  });

  it("Tous les calculs retournent des temps finis et positifs", () => {
    const diameters = [3e-6, 5e-6, 9e-6, 15e-6, 20e-6]; // µm
    
    diameters.forEach(D => {
      const A_SI = areaFromDiameterSI(D);
      const t_SI = timeOrificeFromAreaSI(SI_Gio, A_SI);
      
      expect(Number.isFinite(t_SI)).toBe(true);
      expect(t_SI).toBeGreaterThan(0);
    });
  });
});