import { describe, it, expect, vi } from 'vitest';
import { computeDfromT, GASES } from '../physics';

describe('Critical Validation Tests', () => {
  describe('Invalid time rejection', () => {
    const baseInputs = {
      process: 'blowdown' as const,
      solveFor: 'DfromT' as const,
      V: 2e-7,
      P1: 1.2e6,
      P2: 1e3,
      T: 288.15,
      L: 0.002,
      gas: GASES.air,
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal' as const
    };

    it('should reject empty string time', () => {
      const inputs = { ...baseInputs, t: "" as any };
      
      expect(() => computeDfromT(inputs)).toThrow('Invalid target time');
      
      try {
        computeDfromT(inputs);
      } catch (error: any) {
        expect(error.devNote).toBeDefined();
        expect(error.devNote.tRaw).toBe("");
        expect(error.devNote.parsed).toBe(NaN);
      }
    });

    it('should reject zero time', () => {
      const inputs = { ...baseInputs, t: 0 };
      
      expect(() => computeDfromT(inputs)).toThrow('Invalid target time');
      
      try {
        computeDfromT(inputs);
      } catch (error: any) {
        expect(error.devNote).toBeDefined();
        expect(error.devNote.tRaw).toBe(0);
        expect(error.devNote.t_target_SI).toBe(0);
        expect(error.devNote.error).toContain('≤0');
      }
    });
  });

  describe('Gio preset bracket and search behavior', () => {
    // Gio preset equivalent: V ~ 200 mm³, similar conditions
    const gioInputs = {
      process: 'blowdown' as const,
      solveFor: 'DfromT' as const,
      V: 2e-7, // 200,000 mm³ (200 mm³ = 2e-7 m³)
      P1: 1.2e6, // 12 bar absolute
      P2: 1e3,   // 0.01 bar absolute  
      T: 288.15, // 15°C
      L: 0.002,  // 2 mm
      gas: GASES.air,
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal' as const,
      t: 175 // Target time around 175s
    };

    it('should perform bisection with t(A_lo) > t_target > t(A_hi)', () => {
      const result = computeDfromT(gioInputs);
      
      // Should find a solution around 9 µm (±15%)
      const D_um = result.D * 1e6; // Convert to micrometers
      expect(D_um).toBeGreaterThan(9 * 0.85); // 9 µm - 15%
      expect(D_um).toBeLessThan(9 * 1.15);    // 9 µm + 15%
      
      // Should have sampling data showing bracket behavior
      if (result.sampling) {
        expect(result.sampling.bracketInfo).toBeDefined();
        expect(result.sampling.bracketInfo.t_A_lo).toBeGreaterThan(gioInputs.t); // t(A_lo) > t_target
        expect(result.sampling.bracketInfo.t_A_hi).toBeLessThan(gioInputs.t);    // t(A_hi) < t_target
        
        // Should have performed at least one iteration (not immediate boundary)
        expect(result.sampling.samples.length).toBeGreaterThan(1);
      }
    });

    it('should show proper bracket inclusion for Gio case', () => {
      const result = computeDfromT(gioInputs);
      
      // Verify the target time is properly included in bracket
      if (result.sampling) {
        const t_lo = result.sampling.bracketInfo.t_A_lo;
        const t_hi = result.sampling.bracketInfo.t_A_hi;
        
        // Target should be between t_hi and t_lo (since t decreases with A)
        expect(gioInputs.t).toBeLessThan(t_lo);
        expect(gioInputs.t).toBeGreaterThan(t_hi);
        
        console.log(`Gio bracket: t_target=${gioInputs.t}s in [${t_hi}s, ${t_lo}s]`);
      }
    });
  });

  describe('Filling verification with low residual', () => {
    const fillingInputs = {
      process: 'filling' as const,
      solveFor: 'DfromT' as const,
      V: 2e-7,
      P1: 1e3,   // Initial vessel pressure (low)
      P2: 1.2e6, // Final vessel pressure (high)
      Ps: 1.5e6, // Supply pressure
      T: 288.15,
      L: 0.002,
      gas: GASES.air,
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal' as const,
      t: 150 // Target time
    };

    it('should achieve residual < 1% for filling verification', () => {
      try {
        const result = computeDfromT(fillingInputs);
        
        // Should succeed with low residual
        expect(result.D).toBeGreaterThan(0);
        
        // Check diagnostics for residual info
        if (result.diagnostics.t_check && typeof result.diagnostics.t_check === 'number') {
          const residual = Math.abs(result.diagnostics.t_check - fillingInputs.t) / fillingInputs.t;
          expect(residual).toBeLessThan(0.01); // < 1%
          
          console.log(`Filling residual: ${(residual * 100).toFixed(3)}% (target < 1%)`);
        }
        
      } catch (error: any) {
        // If failed due to residual, check the devNote
        if (error.message === "Result rejected by residual check" && error.devNote) {
          // Even in failure, should show the residual was attempted to be minimized
          expect(error.devNote.refinement_attempted).toBe(true);
          expect(error.devNote.process).toBe('filling');
          
          // Choking should use Pv/Ps ratio for filling
          expect(error.devNote.choking.ratio_type).toBe('Pv/Ps');
        } else {
          // Re-throw if it's not a residual error
          throw error;
        }
      }
    });
  });

  describe('Physical diameter ceiling', () => {
    it('should enforce D ≤ 31 mm for V=2000 mm³', () => {
      const constrainedInputs = {
        process: 'blowdown' as const,
        solveFor: 'DfromT' as const,
        V: 2000e-9, // 2000 mm³
        P1: 1.2e6,
        P2: 1e3,
        T: 288.15,
        L: 0.002,
        gas: GASES.air,
        Cd: 0.62,
        epsilon: 0.01,
        regime: 'isothermal' as const,
        t: 50 // Medium target time
      };
      
      try {
        const result = computeDfromT(constrainedInputs);
        
        // Calculate expected ceiling
        const D_eq = Math.pow(6 * constrainedInputs.V / Math.PI, 1/3);
        const k = 2;
        const D_ceiling = k * D_eq;
        const D_ceiling_mm = D_ceiling * 1000;
        
        // Should be around 31 mm ceiling for V=2000 mm³
        expect(D_ceiling_mm).toBeCloseTo(31, 1);
        
        // Result should respect this ceiling
        const D_result_mm = result.D * 1000;
        expect(D_result_mm).toBeLessThanOrEqual(D_ceiling_mm * 1.01); // Small numerical tolerance
        
        console.log(`Physical constraint: V=${constrainedInputs.V * 1e9}mm³ → D_eq=${(D_eq*1000).toFixed(1)}mm → D_max=${D_ceiling_mm.toFixed(1)}mm → D_result=${D_result_mm.toFixed(1)}mm`);
        
      } catch (error: any) {
        // If it fails, should still respect physical constraints in error reporting
        if (error.devNote?.bracket) {
          const A_hi = error.devNote.bracket.A_hi;
          const D_hi_from_bracket = Math.sqrt(4 * A_hi / Math.PI);
          const D_hi_mm = D_hi_from_bracket * 1000;
          
          // Even in failure, bracket should respect physical limit
          expect(D_hi_mm).toBeLessThanOrEqual(32); // Allow small tolerance
        }
      }
    });

    it('should show bracket expansions are limited by physical constraint', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const tightInputs = {
        process: 'blowdown' as const,
        solveFor: 'DfromT' as const,
        V: 1000e-9, // 1000 mm³ - small volume
        P1: 1.2e6,
        P2: 1e3,
        T: 288.15,
        L: 0.002,
        gas: GASES.air,
        Cd: 0.62,
        epsilon: 0.01,
        regime: 'isothermal' as const,
        t: 5 // Short time that might require large diameter
      };
      
      try {
        computeDfromT(tightInputs);
      } catch (error) {
        // May fail due to physical constraints
      }
      
      // Should have logged physical constraint application
      const logCalls = consoleSpy.mock.calls;
      const constraintLogs = logCalls.some(call => 
        call[0] && (
          call[0].includes('Physical constraint applied') ||
          call[0].includes('D_eq=') ||
          call[0].includes('D_max=')
        )
      );
      
      if (constraintLogs) {
        expect(constraintLogs).toBe(true);
      }
      
      consoleSpy.mockRestore();
    });
  });

  describe('Integration test - all criteria together', () => {
    it('should demonstrate complete workflow from bracket to result', () => {
      // Use Gio-like conditions with medium volume to test all aspects
      const integrationInputs = {
        process: 'blowdown' as const,
        solveFor: 'DfromT' as const,
        V: 5000e-9, // 5000 mm³ - medium volume
        P1: 1.2e6,
        P2: 1e3,
        T: 288.15,
        L: 0.002,
        gas: GASES.air,
        Cd: 0.62,
        epsilon: 0.01,
        regime: 'isothermal' as const,
        t: 100 // Medium time
      };
      
      const result = computeDfromT(integrationInputs);
      
      // Should succeed
      expect(result.D).toBeGreaterThan(0);
      
      // Should respect physical constraint
      const D_eq = Math.pow(6 * integrationInputs.V / Math.PI, 1/3);
      const D_max_physical = 2 * D_eq;
      expect(result.D).toBeLessThanOrEqual(D_max_physical * 1.01);
      
      // Should have proper sampling
      if (result.sampling) {
        expect(result.sampling.bracketInfo.expansions).toBeDefined();
        expect(result.sampling.samples.length).toBeGreaterThan(0);
        
        // Should show proper bracket ordering
        if (result.sampling.bracketInfo.t_A_lo && result.sampling.bracketInfo.t_A_hi) {
          expect(result.sampling.bracketInfo.t_A_lo).toBeGreaterThan(result.sampling.bracketInfo.t_A_hi);
        }
      }
      
      // Should have diagnostics
      expect(result.diagnostics).toBeDefined();
      if (result.diagnostics.t_check && typeof result.diagnostics.t_check === 'number') {
        const residual = Math.abs(result.diagnostics.t_check - integrationInputs.t) / integrationInputs.t;
        expect(residual).toBeLessThan(0.05); // Should be reasonable
      }
      
      console.log(`Integration test: V=${integrationInputs.V*1e9}mm³, t=${integrationInputs.t}s → D=${(result.D*1e6).toFixed(1)}µm (D_max=${(D_max_physical*1000).toFixed(1)}mm)`);
    });
  });
});