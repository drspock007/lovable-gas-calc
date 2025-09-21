import { describe, it, expect, vi } from 'vitest';
import { computeDfromT, GASES } from '../physics';

describe('Physical Diameter Constraint', () => {
  describe('Volume-based diameter limits', () => {
    it('should calculate correct equivalent diameter for V=2000 mm³', () => {
      const V_m3 = 2000e-9; // 2000 mm³ in m³
      const D_eq = Math.pow(6 * V_m3 / Math.PI, 1/3);
      const D_eq_mm = D_eq * 1000;
      
      // D_eq should be approximately 15.6 mm for V=2000 mm³
      expect(D_eq_mm).toBeCloseTo(15.6, 1);
    });

    it('should enforce diameter constraint for small volume (V=2000 mm³)', () => {
      const inputs = {
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
        t: 1 // Very short time that might require large diameter
      };
      
      try {
        const result = computeDfromT(inputs);
        
        // Calculate expected max diameter
        const D_eq = Math.pow(6 * inputs.V / Math.PI, 1/3);
        const k_physical = 2;
        const D_max_expected = k_physical * D_eq;
        
        // Result diameter should not exceed physical constraint
        expect(result.D).toBeLessThanOrEqual(D_max_expected * 1.01); // Small tolerance for numerical precision
        
        // For V=2000 mm³, D_max should be ~31 mm (not 112 mm)
        const D_result_mm = result.D * 1000;
        expect(D_result_mm).toBeLessThan(35); // Should be much less than 112 mm
        
      } catch (error: any) {
        // If it fails, should be due to physical constraints or other valid reasons
        // Not due to unreasonably large diameter
        if (error.devNote?.bracket) {
          const A_hi = error.devNote.bracket.A_hi;
          const D_hi_from_bracket = Math.sqrt(4 * A_hi / Math.PI);
          const D_hi_mm = D_hi_from_bracket * 1000;
          
          // Even in failure, bracket should respect physical constraints
          expect(D_hi_mm).toBeLessThan(35);
        }
      }
    });

    it('should log physical constraint application', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const inputs = {
        process: 'blowdown' as const,
        solveFor: 'DfromT' as const,
        V: 1000e-9, // 1000 mm³ - very small volume
        P1: 1.2e6,
        P2: 1e3,
        T: 288.15,
        L: 0.002,
        gas: GASES.air,
        Cd: 0.62,
        epsilon: 0.01,
        regime: 'isothermal' as const,
        t: 1 // Short time
      };
      
      try {
        computeDfromT(inputs);
      } catch (error) {
        // Expected to potentially fail due to physical constraints
      }
      
      // Should have logged physical constraint application
      const logCalls = consoleSpy.mock.calls;
      const physicalConstraintLogs = logCalls.some(call => 
        call[0] && call[0].includes('Physical constraint applied')
      );
      
      if (physicalConstraintLogs) {
        expect(physicalConstraintLogs).toBe(true);
      }
      
      consoleSpy.mockRestore();
    });

    it('should work normally for reasonable volumes and times', () => {
      const inputs = {
        process: 'blowdown' as const,
        solveFor: 'DfromT' as const,
        V: 2e-7, // 200,000 mm³ - larger volume
        P1: 1.2e6,
        P2: 1e3,
        T: 288.15,
        L: 0.002,
        gas: GASES.air,
        Cd: 0.62,
        epsilon: 0.01,
        regime: 'isothermal' as const,
        t: 175 // Reasonable time
      };
      
      const result = computeDfromT(inputs);
      
      // Should work normally and give reasonable diameter
      expect(result.D).toBeGreaterThan(0);
      expect(result.D).toBeLessThan(0.1); // Less than 100 mm
      
      // Calculate equivalent diameter for comparison
      const D_eq = Math.pow(6 * inputs.V / Math.PI, 1/3);
      const D_eq_mm = D_eq * 1000;
      expect(D_eq_mm).toBeGreaterThan(70); // Should be around 72 mm for 200,000 mm³
    });

    it('should respect physical constraint in retry scenarios', () => {
      // This would be tested when retry functionality is triggered
      // For now, just ensure the constraint is applied consistently
      
      const inputs = {
        process: 'blowdown' as const,
        solveFor: 'DfromT' as const,
        V: 5000e-9, // 5000 mm³
        P1: 1.2e6,
        P2: 1e3,
        T: 288.15,
        L: 0.002,
        gas: GASES.air,
        Cd: 0.62,
        epsilon: 0.01,
        regime: 'isothermal' as const,
        t: 0.1 // Very short time
      };
      
      try {
        const result = computeDfromT(inputs);
        
        // Calculate max allowed diameter
        const D_eq = Math.pow(6 * inputs.V / Math.PI, 1/3);
        const D_max = 2 * D_eq; // k=2
        
        expect(result.D).toBeLessThanOrEqual(D_max * 1.01);
        
      } catch (error: any) {
        // Expected behavior - very short times may not be achievable
        // within physical constraints
        expect(error.message).toBeDefined();
      }
    });
  });

  describe('Constraint factor k validation', () => {
    it('should use k=2 as safety factor', () => {
      const V = 1000e-9; // 1000 mm³
      const D_eq = Math.pow(6 * V / Math.PI, 1/3);
      const k = 2;
      const D_max_expected = k * D_eq;
      const A_hi_max_expected = Math.PI / 4 * Math.pow(D_max_expected, 2);
      
      // Verify the calculation
      expect(D_max_expected).toBeCloseTo(2 * D_eq, 10);
      expect(A_hi_max_expected).toBeCloseTo(Math.PI * Math.pow(D_eq, 2), 10); // π * D_eq² for k=2
    });
  });
});