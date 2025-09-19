import { describe, it, expect, vi } from 'vitest';
import { computeTimeFromDiameter } from '@/lib/pipeline-time-from-d';
import { buildSI } from '@/lib/build-si';

describe('Time from D - Error handling with devNote', () => {
  it('should throw error with devNote for invalid diameter', () => {
    const ui = {
      V: 0.2, V_unit: 'mm3',
      P1: 1200, P1_unit: 'kPa',
      P2: 1, P2_unit: 'kPa',
      T: 15, T_unit: 'celsius',
      L: 2, L_unit: 'mm',
      gasType: 'air',
      regime: 'isothermal',
      D: -5, D_unit: 'µm',
      debug: true
    };

    const SI = buildSI(ui);
    
    expect(() => {
      computeTimeFromDiameter({
        ...ui,
        __SI__: SI,
        modelOverride: 'orifice',
        debug: true
      });
    }).toThrow();
  });

  it('should throw error with devNote for zero diameter', () => {
    const ui = {
      V: 0.2, V_unit: 'mm3',
      P1: 1200, P1_unit: 'kPa',
      P2: 1, P2_unit: 'kPa',
      T: 15, T_unit: 'celsius',
      L: 2, L_unit: 'mm',
      gasType: 'air',
      regime: 'isothermal',
      D: 0, D_unit: 'µm',
      debug: true
    };

    const SI = buildSI(ui);
    
    expect(() => {
      computeTimeFromDiameter({
        ...ui,
        __SI__: SI,
        modelOverride: 'orifice',
        debug: true
      });
    }).toThrow();
  });

  it('should return debugNote on successful calculation', () => {
    const ui = {
      V: 0.2, V_unit: 'mm3',
      P1: 1200, P1_unit: 'kPa',
      P2: 1, P2_unit: 'kPa',
      T: 15, T_unit: 'celsius',
      L: 2, L_unit: 'mm',
      gasType: 'air',
      regime: 'isothermal',
      D: 9, D_unit: 'µm',
      debug: true
    };

    const SI = buildSI(ui);
    
    const result = computeTimeFromDiameter({
      ...ui,
      __SI__: SI,
      modelOverride: 'orifice',
      debug: true
    });

    expect(result).toBeDefined();
    expect(result.t_SI_s).toBeGreaterThan(0);
    expect(result.debugNote).toBeDefined();
    expect(result.debugNote.parsed).toBeDefined();
    expect(result.debugNote.D_SI_m).toBeDefined();
    expect(result.debugNote.model).toBeDefined();
  });

  it('should not return debugNote when debug is false', () => {
    const ui = {
      V: 0.2, V_unit: 'mm3',
      P1: 1200, P1_unit: 'kPa',
      P2: 1, P2_unit: 'kPa',
      T: 15, T_unit: 'celsius',
      L: 2, L_unit: 'mm',
      gasType: 'air',
      regime: 'isothermal',
      D: 9, D_unit: 'µm',
      debug: false
    };

    const SI = buildSI(ui);
    
    const result = computeTimeFromDiameter({
      ...ui,
      __SI__: SI,
      modelOverride: 'orifice',
      debug: false
    });

    expect(result).toBeDefined();
    expect(result.t_SI_s).toBeGreaterThan(0);
    expect(result.debugNote).toBeUndefined();
  });
});