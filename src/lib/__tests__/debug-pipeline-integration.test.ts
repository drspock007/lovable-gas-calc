import { describe, it, expect, vi } from 'vitest';
import { computeTimeFromDiameter } from '@/lib/pipeline-time-from-d';

describe('Debug Pipeline Integration', () => {
  it('should return detailed debugNote when debug is enabled', () => {
    const mockUI = {
      diameter: '9',
      diameterUnit: 'µm',
      debug: true,
      model: 'orifice',
      __SI__: {
        V_SI_m3: 2e-7,
        P1_Pa: 1.2e6,
        P2_Pa: 1e3,
        T_K: 288.15,
        L_m: 0.002,
        gas: { R: 287.06196, gamma: 1.4, mu: 1.825e-5 },
        Cd: 0.62,
        epsilon: 0.01,
        regime: "isothermal"
      }
    };

    const result = computeTimeFromDiameter(mockUI);

    expect(result).toHaveProperty('debugNote');
    expect(result.debugNote).toMatchObject({
      diameterRaw: '9',
      diameterUnit: 'µm',
      parsed: 9e-6,
      D_SI_m: 9e-6,
      A_SI_m2: expect.any(Number),
      model: 'orifice',
      t_SI_s: expect.any(Number),
      inputs_SI: expect.any(Object),
      success: true
    });
  });

  it('should not return debugNote when debug is disabled', () => {
    const mockUI = {
      diameter: '9',
      diameterUnit: 'µm',
      debug: false,
      model: 'orifice',
      __SI__: {
        V_SI_m3: 2e-7,
        P1_Pa: 1.2e6,
        P2_Pa: 1e3,
        T_K: 288.15,
        L_m: 0.002,
        gas: { R: 287.06196, gamma: 1.4, mu: 1.825e-5 },
        Cd: 0.62,
        epsilon: 0.01,
        regime: "isothermal"
      }
    };

    const result = computeTimeFromDiameter(mockUI);

    expect(result.debugNote).toBeUndefined();
  });

  it('should log to console when debug is enabled', () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const mockUI = {
      diameter: '5',
      diameterUnit: 'µm',
      debug: true,
      model: 'orifice',
      __SI__: {
        V_SI_m3: 2e-7,
        P1_Pa: 1.2e6,
        P2_Pa: 1e3,
        T_K: 288.15,
        L_m: 0.002,
        gas: { R: 287.06196, gamma: 1.4, mu: 1.825e-5 },
        Cd: 0.62,
        epsilon: 0.01,
        regime: "isothermal"
      }
    };

    computeTimeFromDiameter(mockUI);

    expect(consoleSpy).toHaveBeenCalledWith(
      '🔵 Time from Diameter - Pipeline:',
      expect.objectContaining({
        diameterRaw: '5',
        diameterUnit: 'µm',
        parsed: 5e-6,
        D_SI_m: 5e-6,
        A_SI_m2: expect.any(Number),
        model: 'orifice',
        t_SI_s: expect.any(Number)
      })
    );

    consoleSpy.mockRestore();
  });

  it('should include error debug info for invalid diameter', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mockUI = {
      diameter: 'invalid',
      diameterUnit: 'µm',
      debug: true,
      model: 'orifice',
      __SI__: {}
    };

    expect(() => computeTimeFromDiameter(mockUI)).toThrow('Invalid diameter');

    expect(consoleSpy).toHaveBeenCalledWith(
      '🔴 Time from Diameter - Invalid diameter:',
      expect.objectContaining({
        diameterRaw: 'invalid',
        diameterUnit: 'µm',
        error: 'Invalid diameter: NaN or ≤0'
      })
    );

    consoleSpy.mockRestore();
  });

  it('should verify acceptance criteria: 9µm ≈ 175s (±15%)', () => {
    const mockUI = {
      diameter: '9',
      diameterUnit: 'µm',
      debug: true,
      model: 'orifice',
      __SI__: {
        V_SI_m3: 2e-7,
        P1_Pa: 1.2e6,
        P2_Pa: 1e3,
        T_K: 288.15,
        L_m: 0.002,
        gas: { R: 287.06196, gamma: 1.4, mu: 1.825e-5 },
        Cd: 0.62,
        epsilon: 0.01,
        regime: "isothermal"
      }
    };

    const result = computeTimeFromDiameter(mockUI);
    
    // 175s ± 15% = [148.75, 201.25]
    expect(result.t_SI_s).toBeGreaterThan(148);
    expect(result.t_SI_s).toBeLessThan(202);
  });

  it('should verify acceptance criteria: 5µm ≈ 540s (±20%)', () => {
    const mockUI = {
      diameter: '5',
      diameterUnit: 'µm',
      debug: true,
      model: 'orifice',
      __SI__: {
        V_SI_m3: 2e-7,
        P1_Pa: 1.2e6,
        P2_Pa: 1e3,
        T_K: 288.15,
        L_m: 0.002,
        gas: { R: 287.06196, gamma: 1.4, mu: 1.825e-5 },
        Cd: 0.62,
        epsilon: 0.01,
        regime: "isothermal"
      }
    };

    const result = computeTimeFromDiameter(mockUI);
    
    // 540s ± 20% = [432, 648]
    expect(result.t_SI_s).toBeGreaterThan(430);
    expect(result.t_SI_s).toBeLessThan(650);
  });
});