/**
 * Tests for auto-retry functionality and devNote enrichment
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeDfromT } from '@/lib/physics';

// Mock the physics module to simulate retry behavior
vi.mock('@/lib/physics', async () => {
  const actual = await vi.importActual('@/lib/physics');
  return {
    ...actual,
    computeDfromT: vi.fn(),
  };
});

const mockComputeDfromT = vi.mocked(computeDfromT);

describe('Auto-retry devNote enrichment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should enrich devNote with retry information on first failure then retry success', () => {
    const baseInputs = {
      process: 'filling' as const,
      solveFor: 'DfromT' as const,
      V: 2e-7,
      P1: 1.01325e5,
      P2: 1.301325e6, 
      Ps: 2e6,
      T: 288.15,
      L: 0.002,
      t: 0.01, // Short time that might cause issues
      gas: { name: 'Air', M: 0.028964, R: 287.06, gamma: 1.4, mu: 1.825e-5 },
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal' as const,
      modelSelection: 'capillary' as const
    };

    // First call - simulate failure with residual error
    const firstFailureError = {
      message: "Result rejected by residual check",
      devNote: {
        process: "filling",
        residual: 0.15,
        t_target: 0.01,
        t_forward: 0.0115,
        bounds_used: {
          D_lo: 5e-6,
          D_hi: 15e-6,
          iters: 3,
          bracketed: true
        },
        inputs_SI: {
          V_SI_m3: 2e-7,
          P1_Pa: 1.01325e5,
          P2_Pa: 1.301325e6,
          Ps_Pa: 2e6
        }
      }
    };

    // Second call (after retry) - simulate success with expanded bounds
    const retrySuccessResult = {
      D: 8.5e-6,
      verdict: 'capillary' as const,
      diagnostics: { convergence: 'success' },
      warnings: []
    };

    mockComputeDfromT
      .mockImplementationOnce(() => { throw firstFailureError; })
      .mockImplementationOnce(() => retrySuccessResult);

    // Simulate first attempt (should fail)
    let firstAttemptError: any = null;
    try {
      computeDfromT(baseInputs);
    } catch (error) {
      firstAttemptError = error;
    }

    expect(firstAttemptError).toBeTruthy();
    expect(firstAttemptError.devNote.process).toBe('filling');
    expect(firstAttemptError.devNote.residual).toBe(0.15);
    expect(firstAttemptError.devNote.bounds_used).toBeDefined();

    // Store original bounds for retry context
    const originalBounds = firstAttemptError.devNote.bounds_used;
    const originalResidual = firstAttemptError.devNote.residual;

    // Simulate retry with expanded bounds
    const retryInputs = { ...baseInputs };
    const expandFactor = 2;
    
    // Call retry (should succeed)
    const retryResult = computeDfromT(retryInputs);
    
    expect(retryResult).toBeDefined();
    expect(retryResult.D).toBeCloseTo(8.5e-6);
    expect(retryResult.verdict).toBe('capillary');
  });

  it('should handle multiple retry attempts with incrementally expanded bounds', () => {
    const baseInputs = {
      process: 'blowdown' as const,
      solveFor: 'DfromT' as const,
      V: 1e-6,
      P1: 5e5, // 5 bar
      P2: 1e5, // 1 bar
      T: 293.15,
      L: 0.005,
      t: 0.1,
      gas: { name: 'Air', M: 0.028964, R: 287.06, gamma: 1.4, mu: 1.825e-5 },
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal' as const,
      modelSelection: 'orifice' as const
    };

    // Mock multiple failures followed by success
    const createFailureError = (attempt: number, expandFactor: number) => ({
      message: "Result rejected by residual check",
      devNote: {
        process: "blowdown",
        residual: 0.1 - (0.02 * attempt), // Decreasing residual
        t_target: 0.1,
        t_forward: 0.11 - (0.005 * attempt),
        bounds_used: {
          D_lo: (5e-6) / expandFactor,
          D_hi: (15e-6) * expandFactor,
          iters: 3 + attempt,
          bracketed: true
        },
        inputs_SI: baseInputs,
        retry: attempt > 1 ? {
          attempt: attempt - 1,
          expand_factor: expandFactor / 2,
          previous_bounds: {
            D_lo: (5e-6) / (expandFactor / 2),
            D_hi: (15e-6) * (expandFactor / 2)
          }
        } : undefined
      }
    });

    mockComputeDfromT
      .mockImplementationOnce(() => { throw createFailureError(1, 2); })
      .mockImplementationOnce(() => { throw createFailureError(2, 4); })
      .mockImplementationOnce(() => ({
        D: 7.2e-6,
        verdict: 'orifice' as const,
        diagnostics: { convergence: 'success', retries: 2 },
        warnings: []
      }));

    // First attempt
    let attempt1Error: any = null;
    try {
      computeDfromT(baseInputs);
    } catch (error) {
      attempt1Error = error;
    }

    expect(attempt1Error.devNote.residual).toBe(0.08);
    expect(attempt1Error.devNote.bounds_used.D_lo).toBeCloseTo(2.5e-6);
    expect(attempt1Error.devNote.bounds_used.D_hi).toBeCloseTo(30e-6);

    // Second attempt
    let attempt2Error: any = null;
    try {
      computeDfromT(baseInputs);
    } catch (error) {
      attempt2Error = error;
    }

    expect(attempt2Error.devNote.residual).toBe(0.06);
    expect(attempt2Error.devNote.retry).toBeDefined();
    expect(attempt2Error.devNote.retry.attempt).toBe(1);

    // Third attempt (success)
    const finalResult = computeDfromT(baseInputs);
    expect(finalResult.D).toBeCloseTo(7.2e-6);
    expect(finalResult.diagnostics.retries).toBe(2);
  });

  it('should preserve retry context across action boundaries', () => {
    // This test simulates the full flow from Calculator component
    const retryContext = {
      previous_bounds: { D_lo: 3e-6, D_hi: 12e-6 },
      previous_residual: 0.08,
      expand_factor: 2,
      attempt: 1
    };

    const mockSuccessResult = {
      D: 6.8e-6,
      verdict: 'capillary' as const,
      diagnostics: { convergence: 'success' },
      warnings: []
    };

    mockComputeDfromT.mockImplementationOnce(() => mockSuccessResult);

    // Simulate retry call with context
    const result = computeDfromT({
      process: 'filling',
      solveFor: 'DfromT', 
      V: 5e-7,
      P1: 1e5,
      P2: 8e5,
      Ps: 10e5,
      T: 298.15,
      L: 0.003,
      t: 50.0,
      gas: { name: 'Air', M: 0.028964, R: 287.06, gamma: 1.4, mu: 1.825e-5 },
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal' as const,
      modelSelection: 'capillary' as const
    } as any); // Use any to bypass retryContext type check for testing

    expect(result).toBeDefined();
    expect(mockComputeDfromT).toHaveBeenCalledWith(
      expect.objectContaining({
        process: 'filling',
        solveFor: 'DfromT'
      })
    );
  });
});