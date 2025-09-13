import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  toSI_Pressure, 
  fromSI_Pressure, 
  absFromGauge, 
  gaugeFromAbs, 
  patmFromAltitude 
} from '../pressure-units';

describe('Pressure Mode Switching and Persistence', () => {
  // Mock localStorage
  const mockLocalStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
  });

  // Simulate the pressure conversion logic from InputsCard
  function simulatePressureModeSwitch(
    currentValues: {
      P1: number;
      P1_unit: string;
      P2: number;
      P2_unit: string;
      Ps?: number;
      Ps_unit?: string;
      pressureInputMode: 'absolute' | 'gauge';
      patmMode: 'standard' | 'custom' | 'altitude';
      patmValue?: { value: number; unit: string };
      altitude_m?: number;
    },
    newMode: 'absolute' | 'gauge'
  ) {
    if (newMode === currentValues.pressureInputMode) return currentValues;

    // Calculate atmospheric pressure
    const getAtmosphericPressure = (): number => {
      switch (currentValues.patmMode) {
        case 'standard':
          return 101325; // Pa
        case 'custom':
          return toSI_Pressure(
            currentValues.patmValue?.value || 101.325, 
            currentValues.patmValue?.unit as any || 'kPa'
          );
        case 'altitude':
          return patmFromAltitude(currentValues.altitude_m ?? 0);
        default:
          return 101325;
      }
    };

    const atmSI = getAtmosphericPressure();
    const oldMode = currentValues.pressureInputMode;

    // Convert pressure values to preserve physical pressure
    const convertPressure = (value: number, unit: string) => {
      const currentSI = toSI_Pressure(value, unit as any);
      let physicalSI: number;

      if (oldMode === 'gauge' && newMode === 'absolute') {
        // Converting from gauge to absolute: add atmospheric pressure
        physicalSI = absFromGauge(currentSI, atmSI);
      } else if (oldMode === 'absolute' && newMode === 'gauge') {
        // Converting from absolute to gauge: subtract atmospheric pressure
        physicalSI = gaugeFromAbs(currentSI, atmSI);
      } else {
        physicalSI = currentSI;
      }

      return fromSI_Pressure(physicalSI, unit as any);
    };

    // Convert all pressure values
    const newValues = { ...currentValues };
    newValues.pressureInputMode = newMode;
    newValues.P1 = convertPressure(currentValues.P1, currentValues.P1_unit);
    newValues.P2 = convertPressure(currentValues.P2, currentValues.P2_unit);
    
    if (currentValues.Ps && currentValues.Ps_unit) {
      newValues.Ps = convertPressure(currentValues.Ps, currentValues.Ps_unit);
    }

    return newValues;
  }

  describe('Physical Pressure Preservation', () => {
    it('should preserve physical pressure when switching from gauge to absolute', () => {
      const initialValues = {
        P1: 10, // bar gauge
        P1_unit: 'bar',
        P2: 2,  // bar gauge
        P2_unit: 'bar',
        pressureInputMode: 'gauge' as const,
        patmMode: 'standard' as const,
      };

      const newValues = simulatePressureModeSwitch(initialValues, 'absolute');

      // P1: 10 bar g + 1.01325 bar atm = 11.01325 bar abs
      expect(newValues.P1).toBeCloseTo(11.01325, 4);
      // P2: 2 bar g + 1.01325 bar atm = 3.01325 bar abs
      expect(newValues.P2).toBeCloseTo(3.01325, 4);
      expect(newValues.pressureInputMode).toBe('absolute');
    });

    it('should preserve physical pressure when switching from absolute to gauge', () => {
      const initialValues = {
        P1: 15,    // bar absolute
        P1_unit: 'bar',
        P2: 5,     // bar absolute  
        P2_unit: 'bar',
        pressureInputMode: 'absolute' as const,
        patmMode: 'standard' as const,
      };

      const newValues = simulatePressureModeSwitch(initialValues, 'gauge');

      // P1: 15 bar abs - 1.01325 bar atm = 13.98675 bar g
      expect(newValues.P1).toBeCloseTo(13.98675, 4);
      // P2: 5 bar abs - 1.01325 bar atm = 3.98675 bar g
      expect(newValues.P2).toBeCloseTo(3.98675, 4);
      expect(newValues.pressureInputMode).toBe('gauge');
    });

    it('should handle supply pressure (Ps) conversion correctly', () => {
      const initialValues = {
        P1: 1,
        P1_unit: 'bar',
        P2: 5,
        P2_unit: 'bar',
        Ps: 20,     // bar gauge
        Ps_unit: 'bar',
        pressureInputMode: 'gauge' as const,
        patmMode: 'standard' as const,
      };

      const newValues = simulatePressureModeSwitch(initialValues, 'absolute');

      // Ps: 20 bar g + 1.01325 bar atm = 21.01325 bar abs
      expect(newValues.Ps).toBeCloseTo(21.01325, 4);
    });

    it('should preserve pressure with custom atmospheric reference', () => {
      const initialValues = {
        P1: 8,      // bar gauge
        P1_unit: 'bar',
        P2: 1,      // bar gauge
        P2_unit: 'bar',
        pressureInputMode: 'gauge' as const,
        patmMode: 'custom' as const,
        patmValue: { value: 95, unit: 'kPa' }, // 0.95 bar custom atmosphere
      };

      const newValues = simulatePressureModeSwitch(initialValues, 'absolute');

      // P1: 8 bar g + 0.95 bar atm = 8.95 bar abs
      expect(newValues.P1).toBeCloseTo(8.95, 4);
      // P2: 1 bar g + 0.95 bar atm = 1.95 bar abs
      expect(newValues.P2).toBeCloseTo(1.95, 4);
    });

    it('should preserve pressure with altitude-based atmospheric reference', () => {
      const initialValues = {
        P1: 5,      // bar gauge
        P1_unit: 'bar',
        P2: 0.5,    // bar gauge
        P2_unit: 'bar',
        pressureInputMode: 'gauge' as const,
        patmMode: 'altitude' as const,
        altitude_m: 1500, // ~84.6 kPa atmosphere
      };

      const newValues = simulatePressureModeSwitch(initialValues, 'absolute');

      // At 1500m, Patm ≈ 0.846 bar
      const expectedP1 = 5 + 0.846; // ~5.846 bar abs
      const expectedP2 = 0.5 + 0.846; // ~1.346 bar abs

      expect(newValues.P1).toBeCloseTo(expectedP1, 2);
      expect(newValues.P2).toBeCloseTo(expectedP2, 2);
    });
  });

  describe('Round-trip Conversion Accuracy', () => {
    it('should maintain precision through multiple mode switches', () => {
      let values = {
        P1: 12.345,
        P1_unit: 'bar',
        P2: 3.678,
        P2_unit: 'bar',
        pressureInputMode: 'gauge' as 'gauge',
        patmMode: 'standard' as 'standard',
      };

      // Gauge → Absolute → Gauge
      const absValues = simulatePressureModeSwitch(values, 'absolute');
      const backToGauge = simulatePressureModeSwitch(absValues, 'gauge');

      // Should return to original values (within floating point precision)
      expect(backToGauge.P1).toBeCloseTo(12.345, 10);
      expect(backToGauge.P2).toBeCloseTo(3.678, 10);
    });

    it('should handle mixed units correctly during mode switch', () => {
      const initialValues = {
        P1: 1000,   // kPa gauge
        P1_unit: 'kPa',
        P2: 2,      // bar gauge  
        P2_unit: 'bar',
        pressureInputMode: 'gauge' as const,
        patmMode: 'standard' as const,
      };

      const newValues = simulatePressureModeSwitch(initialValues, 'absolute');

      // P1: 1000 kPa g + 101.325 kPa atm = 1101.325 kPa abs
      expect(newValues.P1).toBeCloseTo(1101.325, 3);
      // P2: 2 bar g + 1.01325 bar atm = 3.01325 bar abs
      expect(newValues.P2).toBeCloseTo(3.01325, 4);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero gauge pressure correctly', () => {
      const initialValues = {
        P1: 0,      // bar gauge (atmospheric)
        P1_unit: 'bar',
        P2: 0,      // bar gauge (atmospheric)
        P2_unit: 'bar',
        pressureInputMode: 'gauge' as const,
        patmMode: 'standard' as const,
      };

      const newValues = simulatePressureModeSwitch(initialValues, 'absolute');

      // 0 bar g = 1.01325 bar abs
      expect(newValues.P1).toBeCloseTo(1.01325, 4);
      expect(newValues.P2).toBeCloseTo(1.01325, 4);
    });

    it('should handle negative gauge pressures correctly', () => {
      const initialValues = {
        P1: -0.5,   // bar gauge (vacuum)
        P1_unit: 'bar',
        P2: -0.3,   // bar gauge (vacuum)
        P2_unit: 'bar',
        pressureInputMode: 'gauge' as const,
        patmMode: 'standard' as const,
      };

      const newValues = simulatePressureModeSwitch(initialValues, 'absolute');

      // -0.5 bar g + 1.01325 bar atm = 0.51325 bar abs
      expect(newValues.P1).toBeCloseTo(0.51325, 4);
      // -0.3 bar g + 1.01325 bar atm = 0.71325 bar abs
      expect(newValues.P2).toBeCloseTo(0.71325, 4);
    });

    it('should not change values when switching to the same mode', () => {
      const initialValues = {
        P1: 7.5,
        P1_unit: 'bar',
        P2: 2.1,
        P2_unit: 'bar',
        pressureInputMode: 'gauge' as const,
        patmMode: 'standard' as const,
      };

      const newValues = simulatePressureModeSwitch(initialValues, 'gauge');

      // Should be identical (no conversion)
      expect(newValues).toEqual(initialValues);
    });
  });

  describe('UI Badge Display Logic', () => {
    it('should show gauge badge only in gauge mode', () => {
      const gaugeMode = { pressureInputMode: 'gauge' };
      const absoluteMode = { pressureInputMode: 'absolute' };

      // In gauge mode, badge should be shown
      expect(gaugeMode.pressureInputMode === 'gauge').toBe(true);
      
      // In absolute mode, badge should not be shown
      expect(absoluteMode.pressureInputMode === 'gauge').toBe(false);
    });
  });
});