import { describe, it, expect } from 'vitest';
import { 
  toSI_Pressure, 
  fromSI_Pressure, 
  absFromGauge, 
  gaugeFromAbs, 
  patmFromAltitude, 
  clampAbs 
} from '../pressure-units';

describe('Pressure Conversion Tests', () => {
  describe('Gauge to Absolute Conversions', () => {
    it('should convert 12 bar g @ sea level to ~13.01325 bar abs (±0.1%)', () => {
      const P_g = 12; // bar gauge
      const Patm_SI = 101325; // Pa (standard atmosphere)
      
      // Convert gauge to SI
      const P_g_SI = toSI_Pressure(P_g, 'bar');
      expect(P_g_SI).toBe(1200000); // 12 bar = 1.2 MPa
      
      // Convert to absolute
      const P_abs_SI = absFromGauge(P_g_SI, Patm_SI);
      expect(P_abs_SI).toBe(1301325); // 1200000 + 101325
      
      // Convert back to bar
      const P_abs_bar = fromSI_Pressure(P_abs_SI, 'bar');
      expect(P_abs_bar).toBeCloseTo(13.01325, 5);
      
      // Check tolerance (±0.1%)
      const expected = 13.01325;
      const tolerance = expected * 0.001; // 0.1%
      expect(Math.abs(P_abs_bar - expected)).toBeLessThan(tolerance);
    });

    it('should convert -50 kPa g to ~51.325 kPa abs', () => {
      const P_g = -50; // kPa gauge (negative)
      const Patm_SI = 101325; // Pa
      
      // Convert gauge to SI
      const P_g_SI = toSI_Pressure(P_g, 'kPa');
      expect(P_g_SI).toBe(-50000); // -50 kPa
      
      // Convert to absolute
      const P_abs_SI = absFromGauge(P_g_SI, Patm_SI);
      expect(P_abs_SI).toBe(51325); // 101325 - 50000
      
      // Convert back to kPa
      const P_abs_kPa = fromSI_Pressure(P_abs_SI, 'kPa');
      expect(P_abs_kPa).toBeCloseTo(51.325, 3);
    });
  });

  describe('Altitude-based Atmospheric Pressure', () => {
    it('should calculate Patm ≈ 84.6 kPa at 1500 m altitude (±2%)', () => {
      const altitude_m = 1500;
      const Patm_SI = patmFromAltitude(altitude_m);
      
      // Convert to kPa for comparison
      const Patm_kPa = Patm_SI / 1000;
      
      // Expected value ~84.6 kPa
      const expected = 84.6;
      const tolerance = expected * 0.02; // ±2%
      
      expect(Patm_kPa).toBeCloseTo(expected, 1);
      expect(Math.abs(Patm_kPa - expected)).toBeLessThan(tolerance);
    });

    it('should return standard atmosphere at sea level (h=0)', () => {
      const Patm_SI = patmFromAltitude(0);
      expect(Patm_SI).toBeCloseTo(101325, 1);
    });

    it('should decrease pressure with increasing altitude', () => {
      const Patm_0 = patmFromAltitude(0);
      const Patm_1000 = patmFromAltitude(1000);
      const Patm_5000 = patmFromAltitude(5000);
      
      expect(Patm_1000).toBeLessThan(Patm_0);
      expect(Patm_5000).toBeLessThan(Patm_1000);
    });
  });

  describe('UI Round-Trip Conversion', () => {
    it('should convert 200 kPa g to ~301.325 kPa abs for physics', () => {
      const userInput = 200; // kPa gauge
      const userUnit = 'kPa';
      const Patm_SI = 101325; // Standard atmosphere
      
      // Simulate the conversion process in Calculator.tsx
      function toAbsSI(v: number): number {
        const x = toSI_Pressure(v, userUnit as any);
        return absFromGauge(x, Patm_SI); // Gauge mode
      }
      
      const P_abs_SI = clampAbs(toAbsSI(userInput));
      
      // Convert to kPa for verification
      const P_abs_kPa = P_abs_SI / 1000;
      
      expect(P_abs_kPa).toBeCloseTo(301.325, 3);
      expect(P_abs_SI).toBe(301325); // Exact SI value
    });

    it('should pass through absolute values unchanged', () => {
      const userInput = 500; // kPa absolute
      const userUnit = 'kPa';
      const Patm_SI = 101325; // Standard atmosphere (unused for absolute)
      
      // Simulate absolute mode conversion
      function toAbsSI(v: number): number {
        const x = toSI_Pressure(v, userUnit as any);
        return x; // Absolute mode - no conversion needed
      }
      
      const P_abs_SI = clampAbs(toAbsSI(userInput));
      const P_abs_kPa = P_abs_SI / 1000;
      
      expect(P_abs_kPa).toBe(500);
      expect(P_abs_SI).toBe(500000);
    });
  });

  describe('Validation Guards', () => {
    it('should detect gauge pressure below vacuum limit', () => {
      const Patm_SI = 101325; // Standard atmosphere
      const minGaugeAllowed = -Patm_SI + 200; // Allow 200 Pa margin above perfect vacuum
      
      // Test a gauge pressure that's too negative
      const P_g_bad = -102; // kPa (below vacuum)
      const P_g_bad_SI = toSI_Pressure(P_g_bad, 'kPa');
      
      expect(P_g_bad_SI).toBeLessThan(minGaugeAllowed);
      
      // Test a gauge pressure that's acceptable
      const P_g_ok = -90; // kPa (above vacuum limit)
      const P_g_ok_SI = toSI_Pressure(P_g_ok, 'kPa');
      
      expect(P_g_ok_SI).toBeGreaterThan(minGaugeAllowed);
    });

    it('should validate blowdown pressure relationship (P1 > P2)', () => {
      const Patm_SI = 101325;
      
      // Valid blowdown: P1 > P2
      const P1_g = 10; // bar gauge
      const P2_g = 1;  // bar gauge
      
      const P1_abs_SI = clampAbs(absFromGauge(toSI_Pressure(P1_g, 'bar'), Patm_SI));
      const P2_abs_SI = clampAbs(absFromGauge(toSI_Pressure(P2_g, 'bar'), Patm_SI));
      
      expect(P1_abs_SI).toBeGreaterThan(P2_abs_SI);
      
      // Invalid blowdown: P1 ≤ P2
      const P1_bad = 1; // bar gauge
      const P2_bad = 10; // bar gauge
      
      const P1_bad_abs_SI = clampAbs(absFromGauge(toSI_Pressure(P1_bad, 'bar'), Patm_SI));
      const P2_bad_abs_SI = clampAbs(absFromGauge(toSI_Pressure(P2_bad, 'bar'), Patm_SI));
      
      expect(P1_bad_abs_SI).toBeLessThanOrEqual(P2_bad_abs_SI);
    });

    it('should validate filling pressure relationship (P1 < P2 < Ps)', () => {
      const Patm_SI = 101325;
      
      // Valid filling: P1 < P2 < Ps
      const P1_g = 1;  // bar gauge (initial)
      const P2_g = 5;  // bar gauge (target)
      const Ps_g = 10; // bar gauge (supply)
      
      const P1_abs_SI = clampAbs(absFromGauge(toSI_Pressure(P1_g, 'bar'), Patm_SI));
      const P2_abs_SI = clampAbs(absFromGauge(toSI_Pressure(P2_g, 'bar'), Patm_SI));
      const Ps_abs_SI = clampAbs(absFromGauge(toSI_Pressure(Ps_g, 'bar'), Patm_SI));
      
      expect(P1_abs_SI).toBeLessThan(P2_abs_SI);
      expect(P2_abs_SI).toBeLessThan(Ps_abs_SI);
    });

    it('should clamp pressures to minimum 1 Pa', () => {
      // Test very low absolute pressure
      const veryLowPressure = -1000; // Negative SI pressure
      const clamped = clampAbs(veryLowPressure);
      
      expect(clamped).toBe(1); // Should be clamped to 1 Pa
      
      // Test normal pressure (should pass through)
      const normalPressure = 100000; // 1 bar
      const normalClamped = clampAbs(normalPressure);
      
      expect(normalClamped).toBe(normalPressure);
    });
  });

  describe('Inverse Conversions', () => {
    it('should convert absolute back to gauge correctly', () => {
      const P_abs = 15; // bar absolute
      const Patm_SI = 101325; // Pa
      
      const P_abs_SI = toSI_Pressure(P_abs, 'bar');
      const P_g_SI = gaugeFromAbs(P_abs_SI, Patm_SI);
      const P_g_bar = fromSI_Pressure(P_g_SI, 'bar');
      
      // Should be ~13.98675 bar gauge (15 - 1.01325)
      expect(P_g_bar).toBeCloseTo(13.98675, 4);
    });

    it('should handle round-trip conversions accurately', () => {
      const originalValue = 7.5; // bar gauge
      const Patm_SI = 101325; // Pa
      
      // Forward: gauge → absolute
      const P_g_SI = toSI_Pressure(originalValue, 'bar');
      const P_abs_SI = absFromGauge(P_g_SI, Patm_SI);
      
      // Backward: absolute → gauge
      const P_g_back_SI = gaugeFromAbs(P_abs_SI, Patm_SI);
      const P_g_back = fromSI_Pressure(P_g_back_SI, 'bar');
      
      expect(P_g_back).toBeCloseTo(originalValue, 10);
    });
  });
});