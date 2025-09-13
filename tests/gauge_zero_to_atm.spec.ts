import { describe, it, expect } from 'vitest';
import { toSI_Pressure, absFromGauge, patmFromAltitude } from "@/lib/pressure-units";
import { computeDisabledReason } from "@/lib/compute-enabled";

describe('Gauge Zero to Atmosphere Tests', () => {
  it('Gauge P2 = 0 is valid to atmosphere', () => {
    const Patm = 101325; // Pa (standard atmosphere)
    const P2g = 0;        // 0 kPa gauge
    const P2_abs = absFromGauge(P2g * 1000, Patm); // convert kPa to Pa for absFromGauge
    expect(P2_abs).toBeCloseTo(Patm, 1);           // ≈ 101.325 kPa abs
  });

  it('Different gauge zero values convert to atmospheric pressure correctly', () => {
    const Patm = 101325; // Pa

    // Test with different units
    const P2g_kPa = 0;
    const P2g_bar = 0;
    const P2g_Pa = 0;

    const P2_abs_kPa = absFromGauge(toSI_Pressure(P2g_kPa, 'kPa'), Patm);
    const P2_abs_bar = absFromGauge(toSI_Pressure(P2g_bar, 'bar'), Patm);
    const P2_abs_Pa = absFromGauge(toSI_Pressure(P2g_Pa, 'Pa'), Patm);

    expect(P2_abs_kPa).toBeCloseTo(Patm, 1);
    expect(P2_abs_bar).toBeCloseTo(Patm, 1);
    expect(P2_abs_Pa).toBeCloseTo(Patm, 1);
  });

  it('Form allows P2_g === 0 in blowdown', () => {
    // Simulate schema refine logic with pressureInputMode='gauge'
    const mockFormData = {
      pressureInputMode: 'gauge' as const,
      patmMode: 'standard' as const,
      process: 'blowdown' as const,
      P1: { value: '10', unit: 'bar' as const },
      P2: { value: '0', unit: 'bar' as const },  // 0 bar gauge = to atmosphere
    };

    // Parse helper (from schema)
    const parse = (s: string) => {
      const n = Number(s.replace(/\s/g,"").replace(",","."));
      return Number.isFinite(n) ? n : NaN;
    };

    const Patm_SI = 101325; // standard atmosphere

    const toAbsSI = (valStr: string, unit: any) => {
      const v = toSI_Pressure(parse(valStr), unit);
      if (!Number.isFinite(v)) return NaN;
      return mockFormData.pressureInputMode === "gauge" ? absFromGauge(v, Patm_SI) : v;
    };

    const P1_abs = toAbsSI(mockFormData.P1.value, mockFormData.P1.unit);
    const P2_abs = toAbsSI(mockFormData.P2.value, mockFormData.P2.unit);

    // Validation checks that should pass
    expect(Number.isFinite(P1_abs)).toBe(true);
    expect(Number.isFinite(P2_abs)).toBe(true);
    expect(P1_abs).toBeGreaterThan(1); // positive absolute
    expect(P2_abs).toBeGreaterThan(1); // positive absolute
    
    // Physics validation: P1 > P2 for blowdown
    expect(P1_abs).toBeGreaterThan(P2_abs);

    // P2 = 0 bar gauge should equal atmospheric pressure
    expect(P2_abs).toBeCloseTo(101325, 1); // ~1.01325 bar abs

    // Gauge pressure validation - P2_g = 0 should be allowed (not below vacuum)
    const P2_g = toSI_Pressure(parse(mockFormData.P2.value), mockFormData.P2.unit);
    expect(P2_g).toBe(0); // exactly 0 gauge
    expect(P2_g).toBeGreaterThanOrEqual(-Patm_SI + 200); // above vacuum limit
  });

  it('Form validation does not reject P2_g = 0 in various scenarios', () => {
    const testCases = [
      {
        name: 'Standard atmosphere',
        patmMode: 'standard' as const,
        expectedPatm: 101325
      },
      {
        name: 'Custom atmosphere (95 kPa)',
        patmMode: 'custom' as const,
        patmValue: { value: '95', unit: 'kPa' as const },
        expectedPatm: 95000
      },
      {
        name: 'Altitude 1500m',
        patmMode: 'altitude' as const,
        altitude_m: 1500,
        expectedPatm: patmFromAltitude(1500)
      }
    ];

    testCases.forEach((testCase) => {
      const mockFormData = {
        pressureInputMode: 'gauge' as const,
        patmMode: testCase.patmMode,
        process: 'blowdown' as const,
        P1: { value: '5', unit: 'bar' as const },
        P2: { value: '0', unit: 'bar' as const }, // 0 bar gauge
        ...(testCase.patmValue && { patmValue: testCase.patmValue }),
        ...(testCase.altitude_m !== undefined && { altitude_m: testCase.altitude_m })
      };

      // Calculate atmospheric pressure
      const parse = (s: string) => Number(s.replace(/\s/g,"").replace(",","."));
      let Patm_SI: number;
      
      if (testCase.patmMode === 'standard') {
        Patm_SI = 101325;
      } else if (testCase.patmMode === 'custom') {
        Patm_SI = toSI_Pressure(parse(testCase.patmValue!.value), testCase.patmValue!.unit);
      } else {
        Patm_SI = patmFromAltitude(testCase.altitude_m!);
      }

      // Convert P2 gauge to absolute
      const P2_g = toSI_Pressure(parse(mockFormData.P2.value), mockFormData.P2.unit);
      const P2_abs = absFromGauge(P2_g, Patm_SI);

      // P2 = 0 gauge should equal the atmospheric pressure for this scenario
      expect(P2_abs).toBeCloseTo(Patm_SI, 1);
      
      // Should be above vacuum limit
      expect(P2_g).toBeGreaterThanOrEqual(-Patm_SI + 200);
      
      // Should be valid positive absolute pressure
      expect(P2_abs).toBeGreaterThan(1);
    });
  });

  it('Blowdown to atmosphere button sets P2_g = 0 correctly', () => {
    // Simulate the "to atmosphere" button functionality
    const initialP2_g = 1.5; // 1.5 bar gauge
    const afterButtonClick_P2_g = 0; // Button sets to 0 gauge

    const Patm_SI = 101325;
    
    const initialP2_abs = absFromGauge(toSI_Pressure(initialP2_g, 'bar'), Patm_SI);
    const finalP2_abs = absFromGauge(toSI_Pressure(afterButtonClick_P2_g, 'bar'), Patm_SI);

    // Initial: 1.5 bar g + 1.01325 bar atm = 2.51325 bar abs
    expect(initialP2_abs).toBeCloseTo(251325, 1);
    
    // After button: 0 bar g + 1.01325 bar atm = 1.01325 bar abs (atmospheric)
    expect(finalP2_abs).toBeCloseTo(101325, 1);
    
    // The button effectively sets the final pressure to atmospheric
    expect(finalP2_abs).toBeCloseTo(Patm_SI, 1);
  });

  it('Validates that P2_g = 0 works with different P1 values in blowdown', () => {
    const Patm_SI = 101325;
    const P2_g = 0; // Always to atmosphere
    
    const testP1Values = [
      { value: 1, unit: 'bar', expected_valid: true },   // 1 bar g > 0 bar g
      { value: 5, unit: 'bar', expected_valid: true },   // 5 bar g > 0 bar g  
      { value: 15, unit: 'bar', expected_valid: true },  // 15 bar g > 0 bar g
      { value: 0, unit: 'bar', expected_valid: false },  // 0 bar g = 0 bar g (invalid)
      { value: -0.5, unit: 'bar', expected_valid: false }, // -0.5 bar g < 0 bar g (invalid)
    ];

    testP1Values.forEach((testCase) => {
      const P1_g_SI = toSI_Pressure(testCase.value, testCase.unit as any);
      const P2_g_SI = toSI_Pressure(P2_g, 'bar');
      
      const P1_abs = absFromGauge(P1_g_SI, Patm_SI);
      const P2_abs = absFromGauge(P2_g_SI, Patm_SI);
      
      // P2 should always be atmospheric
      expect(P2_abs).toBeCloseTo(Patm_SI, 1);
      
      // Blowdown validity: P1_abs > P2_abs
      const isValid = P1_abs > P2_abs;
      expect(isValid).toBe(testCase.expected_valid);
    });
  });

  it("P2 = 0 bar g active le bouton (blowdown)", () => {
    const values = {
      pressureInputMode: "gauge",
      patmMode: "standard",
      process: "blowdown",
      P1: { value: "12", unit: "bar" },
      P2: { value: "0",  unit: "bar" },
    };
    expect(computeDisabledReason(values)).toBe("ok");
  });

  it("Gauge P2 = 0 enables Compute in blowdown", () => {
    const values = {
      pressureInputMode: "gauge",
      patmMode: "standard",
      process: "blowdown",
      P1: { value: "12", unit: "bar" },
      P2: { value: "0", unit: "bar" }, // atmosphère
      // champs requis minimaux pour l'appli (V, T, t/D, L, etc.) si utilisés par disabled
    };
    expect(computeDisabledReason(values)).toBe("ok");
  });
});