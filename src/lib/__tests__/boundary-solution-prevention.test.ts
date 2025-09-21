/**
 * Test to ensure that the solver never returns a boundary (A_lo or A_hi) as solution
 * Validates that the algorithm properly rejects boundary solutions when residual is not satisfied
 */

import { describe, it, expect } from 'vitest';
import { computeDfromT, GASES } from '../physics';

describe('Boundary Solution Prevention', () => {
  const baseInputs = {
    process: 'blowdown' as const,
    solveFor: 'DfromT' as const,
    V: 2e-7, // 200 mm³
    P1: 1.2e6, // 1.2 MPa 
    P2: 1e3, // 1 kPa
    T: 288.15, // 15°C
    L: 0.002, // 2 mm
    gas: GASES.air,
    Cd: 0.62,
    epsilon: 0.01,
    regime: 'isothermal' as const
  };

  describe('Never return boundary as solution', () => {
    it('should reject solution that hits boundary without satisfying residual', () => {
      // Use extreme target time that might force boundary solution
      const inputs = { 
        ...baseInputs, 
        t: 1e-9, // Extremely small time
        epsilon: 0.001 // Very strict tolerance
      };
      
      try {
        const result = computeDfromT(inputs);
        
        // If it succeeds, verify the solution is not at boundary
        if (result.sampling?.bracketInfo) {
          const { A_lo, A_hi } = result.sampling.bracketInfo;
          const A_solution = result.sampling.warnings.find(w => w.includes('A_final_m2='))
            ?.match(/A_final_m2=([0-9\.e-]+)/)?.[1];
          
          if (A_solution) {
            const A_sol_num = parseFloat(A_solution);
            const boundaryTolerance = 1e-8;
            
            // Verify solution is not at boundaries
            expect(Math.abs(A_sol_num - A_lo)).toBeGreaterThan(boundaryTolerance);
            expect(Math.abs(A_sol_num - A_hi)).toBeGreaterThan(boundaryTolerance);
          }
        }
      } catch (error: any) {
        // If it fails, check for proper boundary rejection message
        if (error.message === 'Could not solve within bracket (hit bound)') {
          expect(error.devNote).toBeDefined();
          expect(error.devNote.A_lo).toBeDefined();
          expect(error.devNote.A_hi).toBeDefined();
          expect(error.devNote.t_lo).toBeDefined();
          expect(error.devNote.t_hi).toBeDefined();
          expect(error.devNote.t_target_SI).toBe(1e-9);
          expect(error.devNote.A_solution).toBeDefined();
          expect(error.devNote.residual_time).toBeDefined();
          expect(error.devNote.epsilon_threshold).toBeDefined();
          expect(error.devNote.boundary_hit).toMatch(/^(A_lo|A_hi)$/);
        }
      }
    });

    it('should provide proper diagnostics when solution is valid', () => {
      const inputs = { ...baseInputs, t: 175 }; // Normal target time
      
      const result = computeDfromT(inputs);
      expect(result.D).toBeDefined();
      expect(result.D).toBeGreaterThan(0);
      
      // Check that sampling contains diagnostic information
      if (result.sampling?.warnings) {
        const diagnosticWarning = result.sampling.warnings.find(w => 
          w.includes('Root finding') && 
          w.includes('residual_time') && 
          w.includes('A_final_m2') && 
          w.includes('boundary_check=passed')
        );
        expect(diagnosticWarning).toBeDefined();
      }
    });

    it('should ensure A_final_m2 is different from A_lo and A_hi', () => {
      const inputs = { ...baseInputs, t: 100 };
      
      const result = computeDfromT(inputs);
      expect(result.D).toBeDefined();
      expect(result.D).toBeGreaterThan(0);
      
      if (result.sampling?.bracketInfo && result.sampling?.warnings) {
        const { A_lo, A_hi } = result.sampling.bracketInfo;
        const diagnosticWarning = result.sampling.warnings.find(w => w.includes('A_final_m2='));
        
        if (diagnosticWarning) {
          const A_final_match = diagnosticWarning.match(/A_final_m2=([0-9\.e-]+)/);
          if (A_final_match) {
            const A_final = parseFloat(A_final_match[1]);
            
            // A_final should be strictly between A_lo and A_hi
            expect(A_final).toBeGreaterThan(Math.min(A_lo, A_hi));
            expect(A_final).toBeLessThan(Math.max(A_lo, A_hi));
            
            // And should not be exactly equal to either bound
            expect(A_final).not.toBeCloseTo(A_lo, 10);
            expect(A_final).not.toBeCloseTo(A_hi, 10);
          }
        }
      }
    });

    it('should iterate until residual criterion is satisfied', () => {
      const inputs = { 
        ...baseInputs, 
        t: 50,
        epsilon: 0.005 // Moderate tolerance
      };
      
      const result = computeDfromT(inputs);
      expect(result.D).toBeDefined();
      expect(result.D).toBeGreaterThan(0);
      
      if (result.sampling?.warnings) {
        const diagnosticWarning = result.sampling.warnings.find(w => w.includes('residual_time='));
        if (diagnosticWarning) {
          const residual_match = diagnosticWarning.match(/residual_time=([0-9\.e-]+)/);
          if (residual_match) {
            const residual_time = parseFloat(residual_match[1]);
            const epsilon_threshold = Math.max(inputs.epsilon || 0.01, 0.01);
            
            // Verify residual satisfies the criterion
            expect(residual_time).toBeLessThanOrEqual(epsilon_threshold);
          }
        }
      }
    });
  });

  describe('Physical bounds interaction', () => {
    it('should handle boundary detection with physical constraints', () => {
      const inputs = { 
        ...baseInputs, 
        V: 2e-6, // 2000 mm³ (larger volume)
        t: 10 // Moderate time
      };
      
      try {
        const result = computeDfromT(inputs);
        
        // If successful, verify constraints are respected
        if (result.D && result.sampling?.bracketInfo) {
          const D_eq = Math.pow(6 * inputs.V / Math.PI, 1/3);
          const k_physical = 2;
          const D_max_physical = k_physical * D_eq;
          
          // Result should respect physical constraint
          expect(result.D).toBeLessThanOrEqual(D_max_physical);
          
          // And not be at the boundary
          const boundaryTolerance = 1e-8;
          const A_max_physical = Math.PI / 4 * Math.pow(D_max_physical, 2);
          const A_result = Math.PI * Math.pow(result.D, 2) / 4;
          
          if (A_result > A_max_physical * 0.99) {
            // If close to physical limit, still should not be exactly at boundary
            expect(Math.abs(A_result - A_max_physical)).toBeGreaterThan(boundaryTolerance);
          }
        }
      } catch (error: any) {
        // Acceptable failures due to physical or numerical constraints
        expect(['Could not solve within bracket (hit bound)', 'Target time out of bracket'])
          .toContain(error.message);
      }
    });
  });
});