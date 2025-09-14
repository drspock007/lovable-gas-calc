import { describe, it, expect, vi } from 'vitest';
import { computeDisabledReason } from '@/lib/compute-enabled';

describe('Gauge Zero Validation', () => {
  it('should return "ok" when P2 gauge = 0 in blowdown mode', () => {
    const values = {
      pressureInputMode: 'gauge',
      patmMode: 'standard',
      process: 'blowdown',
      P1: { value: '1200', unit: 'kPa' },
      P2: { value: '0', unit: 'kPa' }
    };

    const result = computeDisabledReason(values);
    expect(result).toBe('ok');
  });

  it('should convert P2 gauge = 0 to atmospheric pressure (~101.3 kPa abs)', () => {
    const values = {
      pressureInputMode: 'gauge',
      patmMode: 'standard',
      process: 'blowdown',
      P1: { value: '1200', unit: 'kPa' },
      P2: { value: '0', unit: 'kPa' }
    };

    // Test with debug enabled to trigger logging
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    computeDisabledReason(values, true);
    
    expect(consoleSpy).toHaveBeenCalledWith(
      '🔥 P2=0 DEBUG:',
      expect.objectContaining({
        pressureInputMode: 'gauge',
        P1_val: '1200',
        P2_val: '0'
      })
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      'DEBUG abs pressures:',
      expect.objectContaining({
        P1_abs: expect.any(Number),
        P2_abs: expect.closeTo(101325, 100), // ~101.3 kPa in Pa
        Patm_SI: 101325
      })
    );

    consoleSpy.mockRestore();
  });

  it('should handle different atmospheric pressure modes with P2 gauge = 0', () => {
    // Standard atmosphere
    let values = {
      pressureInputMode: 'gauge',
      patmMode: 'standard',
      process: 'blowdown',
      P1: { value: '1200', unit: 'kPa' },
      P2: { value: '0', unit: 'kPa' }
    };
    expect(computeDisabledReason(values)).toBe('ok');

    // Custom atmosphere
    values = {
      pressureInputMode: 'gauge',
      patmMode: 'custom',
      patmValue: { value: '1000', unit: 'hPa' },
      process: 'blowdown',
      P1: { value: '1200', unit: 'kPa' },
      P2: { value: '0', unit: 'kPa' }
    } as any;
    expect(computeDisabledReason(values)).toBe('ok');

    // Altitude-based atmosphere
    values = {
      pressureInputMode: 'gauge',
      patmMode: 'altitude',
      altitude_m: '1000',
      process: 'blowdown',
      P1: { value: '1200', unit: 'kPa' },
      P2: { value: '0', unit: 'kPa' }
    } as any;
    expect(computeDisabledReason(values)).toBe('ok');
  });

  it('should reject negative gauge pressures beyond vacuum limit', () => {
    const values = {
      pressureInputMode: 'gauge',
      patmMode: 'standard',
      process: 'blowdown',
      P1: { value: '1200', unit: 'kPa' },
      P2: { value: '-102', unit: 'kPa' } // Below atmospheric pressure
    };

    const result = computeDisabledReason(values);
    expect(result).toBe('invalid-abs');
  });

  it('should validate blowdown inequality: P1_abs > P2_abs', () => {
    // Valid case: P1 > P2
    let values = {
      pressureInputMode: 'gauge',
      patmMode: 'standard',
      process: 'blowdown',
      P1: { value: '500', unit: 'kPa' },
      P2: { value: '0', unit: 'kPa' }
    };
    expect(computeDisabledReason(values)).toBe('ok');

    // Invalid case: P1 < P2 (when P2 = 0 gauge = ~101.3 kPa abs)
    values = {
      pressureInputMode: 'gauge',
      patmMode: 'standard',
      process: 'blowdown',
      P1: { value: '50', unit: 'kPa' }, // 50 kPa gauge = ~152 kPa abs
      P2: { value: '100', unit: 'kPa' } // 100 kPa gauge = ~202 kPa abs
    };
    expect(computeDisabledReason(values)).toBe('ineq-blowdown');
  });
});