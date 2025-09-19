/**
 * Tests d'acceptance pour la validation de la longueur capillaire
 * Vérifie qu'une erreur est levée si L manque ou est invalide
 */
import { describe, it, expect } from "vitest";
import { timeCapillaryFromAreaSI_validated } from "@/lib/physics-capillary";
import { areaFromDiameterSI } from "@/lib/geometry";

describe("Capillary - Validation longueur L", () => {
  const baseSI = {
    V_SI_m3: 2e-7,
    P1_Pa: 1.2e6,
    P2_Pa: 1e3,
    T_K: 288.15,
    gas: { R: 287.06196, gamma: 1.4, mu: 1.825e-5 },
    epsilon: 0.01
  };

  it("L manquant → erreur 'Invalid capillary length L'", () => {
    const SI = { ...baseSI }; // Pas de L_SI_m ni L_m
    const A_SI = areaFromDiameterSI(10e-6);

    expect(() => {
      timeCapillaryFromAreaSI_validated(SI, A_SI);
    }).toThrow("Invalid capillary length L");
  });

  it("L = 0 → erreur 'Invalid capillary length L'", () => {
    const SI = { ...baseSI, L_SI_m: 0, L_m: 0 };
    const A_SI = areaFromDiameterSI(10e-6);

    expect(() => {
      timeCapillaryFromAreaSI_validated(SI, A_SI);
    }).toThrow("Invalid capillary length L");
  });

  it("L négatif → erreur 'Invalid capillary length L'", () => {
    const SI = { ...baseSI, L_SI_m: -0.001, L_m: -0.001 };
    const A_SI = areaFromDiameterSI(10e-6);

    expect(() => {
      timeCapillaryFromAreaSI_validated(SI, A_SI);
    }).toThrow("Invalid capillary length L");
  });

  it("L = NaN → erreur 'Invalid capillary length L'", () => {
    const SI = { ...baseSI, L_SI_m: NaN, L_m: NaN };
    const A_SI = areaFromDiameterSI(10e-6);

    expect(() => {
      timeCapillaryFromAreaSI_validated(SI, A_SI);
    }).toThrow("Invalid capillary length L");
  });

  it("L valide → calcul réussi", () => {
    const SI = { ...baseSI, L_SI_m: 0.002, L_m: 0.002 };
    const A_SI = areaFromDiameterSI(10e-6);

    const result = timeCapillaryFromAreaSI_validated(SI, A_SI);
    
    expect(result.t_SI_s).toBeGreaterThan(0);
    expect(Number.isFinite(result.t_SI_s)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});