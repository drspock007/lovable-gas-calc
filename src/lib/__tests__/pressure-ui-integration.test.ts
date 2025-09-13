import { describe, it, expect } from 'vitest';
import { 
  toSI_Pressure, 
  absFromGauge, 
  gaugeFromAbs, 
  patmFromAltitude, 
  clampAbs,
  PressureUnit 
} from '../pressure-units';

describe('Pressure UI Integration Tests', () => {
  // Mock input values structure similar to InputValues interface
  interface MockInputValues {
    P1: number;
    P1_unit: string;
    P2: number;
    P2_unit: string;
    Ps?: number;
    Ps_unit?: string;
    pressureInputMode: 'absolute' | 'gauge';
    patmMode: 'standard' | 'custom' | 'altitude';
    patmValue?: { value: number; unit: PressureUnit };
    altitude_m?: number;
  }

  // Mock the conversion logic from Calculator.tsx
  function simulateCalculatorConversion(inputs: MockInputValues) {
    const u = inputs.P1_unit as PressureUnit;
    
    // Calculate atmospheric pressure
    const Patm_SI = 
      inputs.patmMode === 'standard' ? 101325 :
      inputs.patmMode === 'custom' ? toSI_Pressure(inputs.patmValue?.value || 101.325, inputs.patmValue?.unit || 'kPa') :
      patmFromAltitude(inputs.altitude_m ?? 0);

    // Helper function to convert user input to absolute SI
    function toAbsSI(v: number): number {
      const x = toSI_Pressure(v, u);
      return inputs.pressureInputMode === 'gauge' ? absFromGauge(x, Patm_SI) : x;
    }

    // Validation guards for gauge mode
    if (inputs.pressureInputMode === 'gauge') {
      const minGaugeAllowed = -Patm_SI + 200;
      
      if (inputs.P1 < minGaugeAllowed / toSI_Pressure(1, u)) {
        throw new Error('P1 gauge pressure below vacuum limit');
      }
      if (inputs.P2 < minGaugeAllowed / toSI_Pressure(1, u)) {
        throw new Error('P2 gauge pressure below vacuum limit');
      }
      if (inputs.Ps && inputs.Ps < minGaugeAllowed / toSI_Pressure(1, u)) {
        throw new Error('Ps gauge pressure below vacuum limit');
      }
    }

    const P1_SI = clampAbs(toAbsSI(inputs.P1));
    const P2_SI = clampAbs(toAbsSI(inputs.P2));
    const Ps_SI = inputs.Ps ? clampAbs(toAbsSI(inputs.Ps)) : undefined;

    return { P1_SI, P2_SI, Ps_SI, Patm_SI };
  }

  describe('Standard Atmospheric Reference', () => {
    it('should convert 12 bar g to ~13.01325 bar abs at sea level', () => {
      const inputs: MockInputValues = {
        P1: 12,
        P1_unit: 'bar',
        P2: 1,
        P2_unit: 'bar',
        pressureInputMode: 'gauge',
        patmMode: 'standard'
      };

      const result = simulateCalculatorConversion(inputs);
      
      // P1: 12 bar g + 1.01325 bar atm = 13.01325 bar abs
      expect(result.P1_SI).toBe(1301325); // Pa
      expect(result.P1_SI / 100000).toBeCloseTo(13.01325, 4); // bar
    });

    it('should handle negative gauge pressures correctly', () => {
      const inputs: MockInputValues = {
        P1: -50,
        P1_unit: 'kPa',
        P2: -30,
        P2_unit: 'kPa',
        pressureInputMode: 'gauge',
        patmMode: 'standard'
      };

      const result = simulateCalculatorConversion(inputs);
      
      // P1: -50 kPa g + 101.325 kPa atm = 51.325 kPa abs
      expect(result.P1_SI).toBe(51325); // Pa
      // P2: -30 kPa g + 101.325 kPa atm = 71.325 kPa abs
      expect(result.P2_SI).toBe(71325); // Pa
    });
  });

  describe('Custom Atmospheric Reference', () => {
    it('should use custom atmospheric pressure for conversions', () => {
      const inputs: MockInputValues = {
        P1: 5,
        P1_unit: 'bar',
        P2: 1,
        P2_unit: 'bar',
        pressureInputMode: 'gauge',
        patmMode: 'custom',
        patmValue: { value: 95, unit: 'kPa' } // 95 kPa custom atmosphere
      };

      const result = simulateCalculatorConversion(inputs);
      
      // P1: 5 bar g (500 kPa) + 95 kPa atm = 595 kPa abs
      expect(result.P1_SI).toBe(595000); // Pa
      expect(result.Patm_SI).toBe(95000); // Custom Patm
    });
  });

  describe('Altitude-based Atmospheric Reference', () => {
    it('should calculate atmospheric pressure from altitude', () => {
      const inputs: MockInputValues = {
        P1: 200,
        P1_unit: 'kPa',
        P2: 50,
        P2_unit: 'kPa',
        pressureInputMode: 'gauge',
        patmMode: 'altitude',
        altitude_m: 1500
      };

      const result = simulateCalculatorConversion(inputs);
      
      // At 1500m, Patm ≈ 84.6 kPa
      expect(result.Patm_SI).toBeCloseTo(84600, 1000); // ±1 kPa tolerance
      
      // P1: 200 kPa g + ~84.6 kPa atm ≈ 284.6 kPa abs
      expect(result.P1_SI).toBeCloseTo(284600, 1000);
    });
  });

  describe('Absolute Mode Pass-through', () => {
    it('should pass absolute pressures through unchanged', () => {
      const inputs: MockInputValues = {
        P1: 15,
        P1_unit: 'bar',
        P2: 2,
        P2_unit: 'bar',
        pressureInputMode: 'absolute',
        patmMode: 'standard' // Should be ignored in absolute mode
      };

      const result = simulateCalculatorConversion(inputs);
      
      // Absolute mode: values should pass through unchanged
      expect(result.P1_SI).toBe(1500000); // 15 bar = 1.5 MPa
      expect(result.P2_SI).toBe(200000);  // 2 bar = 0.2 MPa
    });
  });

  describe('Validation Guards', () => {
    it('should throw error for gauge pressure below vacuum', () => {
      const inputs: MockInputValues = {
        P1: -102, // Below vacuum at standard atmosphere
        P1_unit: 'kPa',
        P2: 0,
        P2_unit: 'kPa',
        pressureInputMode: 'gauge',
        patmMode: 'standard'
      };

      expect(() => simulateCalculatorConversion(inputs)).toThrow('P1 gauge pressure below vacuum limit');
    });

    it('should allow gauge pressures just above vacuum limit', () => {
      const inputs: MockInputValues = {
        P1: -101, // Just above vacuum limit
        P1_unit: 'kPa',
        P2: -50,
        P2_unit: 'kPa',
        pressureInputMode: 'gauge',
        patmMode: 'standard'
      };

      // Should not throw
      const result = simulateCalculatorConversion(inputs);
      expect(result.P1_SI).toBeGreaterThan(0);
      expect(result.P2_SI).toBeGreaterThan(0);
    });

    it('should validate blowdown pressure relationships', () => {
      // This would be handled in Calculator.tsx after conversion
      const inputs: MockInputValues = {
        P1: 1, // bar gauge (lower initial)
        P1_unit: 'bar',
        P2: 5, // bar gauge (higher final)
        P2_unit: 'bar',
        pressureInputMode: 'gauge',
        patmMode: 'standard'
      };

      const result = simulateCalculatorConversion(inputs);
      
      // For blowdown, P1_SI should be > P2_SI, but here it's not
      // This should trigger validation error in Calculator.tsx
      expect(result.P1_SI).toBeLessThan(result.P2_SI); // Invalid for blowdown
    });

    it('should validate filling pressure relationships', () => {
      const inputs: MockInputValues = {
        P1: 1,  // bar gauge (initial)
        P1_unit: 'bar',
        P2: 5,  // bar gauge (target)
        P2_unit: 'bar',
        Ps: 10, // bar gauge (supply)
        Ps_unit: 'bar',
        pressureInputMode: 'gauge',
        patmMode: 'standard'
      };

      const result = simulateCalculatorConversion(inputs);
      
      // For filling: P1 < P2 < Ps (all absolute)
      expect(result.P1_SI).toBeLessThan(result.P2_SI!);
      expect(result.P2_SI).toBeLessThan(result.Ps_SI!);
    });
  });

  describe('UI Round-trip Tests', () => {
    it('should maintain precision through display conversions', () => {
      const inputs: MockInputValues = {
        P1: 7.5,
        P1_unit: 'bar',
        P2: 1.2,
        P2_unit: 'bar',
        pressureInputMode: 'gauge',
        patmMode: 'standard'
      };

      const result = simulateCalculatorConversion(inputs);
      
      // Convert back to display values
      const P1_display_SI = gaugeFromAbs(result.P1_SI, result.Patm_SI);
      const P1_display = P1_display_SI / 100000; // Convert to bar
      
      expect(P1_display).toBeCloseTo(inputs.P1, 10); // High precision
    });

    it('should handle mixed units correctly', () => {
      const inputs: MockInputValues = {
        P1: 1500, // kPa gauge
        P1_unit: 'kPa',
        P2: 2,    // bar gauge
        P2_unit: 'bar',
        pressureInputMode: 'gauge',
        patmMode: 'standard'
      };

      // This test simulates mixed units - in real UI, all pressures would use same unit
      // But the conversion logic should handle different units properly
      const P1_SI = clampAbs(absFromGauge(toSI_Pressure(inputs.P1, 'kPa'), 101325));
      const P2_SI = clampAbs(absFromGauge(toSI_Pressure(inputs.P2, 'bar'), 101325));
      
      expect(P1_SI).toBe(1601325); // 1500 kPa + 101.325 kPa
      expect(P2_SI).toBe(301325);  // 2 bar + 1.01325 bar
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero gauge pressure correctly', () => {
      const inputs: MockInputValues = {
        P1: 0,
        P1_unit: 'bar',
        P2: 0,
        P2_unit: 'bar',
        pressureInputMode: 'gauge',
        patmMode: 'standard'
      };

      const result = simulateCalculatorConversion(inputs);
      
      // 0 bar gauge = 1.01325 bar absolute
      expect(result.P1_SI).toBe(101325);
      expect(result.P2_SI).toBe(101325);
    });

    it('should handle very high pressures', () => {
      const inputs: MockInputValues = {
        P1: 1000,
        P1_unit: 'bar',
        P2: 100,
        P2_unit: 'bar',
        pressureInputMode: 'gauge',
        patmMode: 'standard'
      };

      const result = simulateCalculatorConversion(inputs);
      
      // High pressure: atmospheric contribution becomes negligible
      expect(result.P1_SI).toBe(100101325); // ~100.1 MPa
      expect(result.P2_SI).toBe(10101325);  // ~10.1 MPa
    });
  });
});
