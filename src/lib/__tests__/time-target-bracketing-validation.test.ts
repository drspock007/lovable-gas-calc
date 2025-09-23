import { describe, it, expect } from 'vitest';
import { computeDfromT, GASES } from '../physics';

describe('Time Target Bracketing and Convergence Validation', () => {
  const baseCase = {
    process: 'filling' as const,
    solveFor: 'DfromT' as const,
    V: 4e-3, // 4 L = 4e-3 m³
    P1: 0, // 0 kPa gauge
    P2: 600e3, // 600 kPa gauge -> 700 kPa abs (approx)
    Ps: 1200e3, // 1200 kPa gauge -> 1300 kPa abs (approx)
    T: 288.15, // 15°C
    L: 0.002,
    gas: GASES.methane,
    Cd: 0.62,
    epsilon: 0.01,
    regime: 'isothermal' as const
  };

  describe('1) Bracket validation', () => {
    it('should achieve valid bracket with inside==true for realistic Filling case', () => {
      const inputs = { ...baseCase, t: 175 };
      
      try {
        const result = computeDfromT(inputs);
        
        // Should succeed and have sampling data
        expect(result.D).toBeDefined();
        expect(result.D).toBeGreaterThan(0);
        expect(result.sampling).toBeDefined();
        
        // Check that bracket was properly established
        const sampling = result.sampling!;
        expect(sampling.bracketInfo).toBeDefined();
        expect(sampling.bracketInfo.A_lo).toBeGreaterThan(0);
        expect(sampling.bracketInfo.A_hi).toBeGreaterThan(sampling.bracketInfo.A_lo);
        
        // Verify that times are in correct order (t_lo >= t_hi for t(A) decreasing)
        expect(sampling.bracketInfo.t_A_lo).toBeGreaterThanOrEqual(sampling.bracketInfo.t_A_hi);
        
        console.log(`Bracket established: A=[${sampling.bracketInfo.A_lo.toExponential(3)}, ${sampling.bracketInfo.A_hi.toExponential(3)}]`);
        console.log(`Times: t_lo=${sampling.bracketInfo.t_A_lo.toFixed(2)}s, t_hi=${sampling.bracketInfo.t_A_hi.toFixed(2)}s`);
        console.log(`Target: t=${inputs.t}s should be inside [${sampling.bracketInfo.t_A_hi.toFixed(2)}, ${sampling.bracketInfo.t_A_lo.toFixed(2)}]`);
        
        // Verify inclusion: t_target should be between t_hi and t_lo
        expect(inputs.t).toBeGreaterThanOrEqual(sampling.bracketInfo.t_A_hi);
        expect(inputs.t).toBeLessThanOrEqual(sampling.bracketInfo.t_A_lo);
        
      } catch (error: any) {
        console.error('Bracketing failed:', error.message);
        if (error.devNote) {
          console.error('DevNote:', error.devNote);
        }
        throw error;
      }
    });
  });

  describe('2) Convergence validation', () => {
    it('should converge to interior solution with iterations >= 1 and candidate_source === "mid"', () => {
      const inputs = { ...baseCase, t: 175 };
      
      const result = computeDfromT(inputs);
      
      expect(result.D).toBeDefined();
      expect(result.sampling?.debugNote).toBeDefined();
      
      const debugNote = result.sampling!.debugNote!;
      
      // Verify convergence metrics
      expect(debugNote.iterations).toBeGreaterThanOrEqual(1);
      expect(debugNote.candidate_source).toBe("mid");
      
      // Verify A_final is not at boundaries
      const sampling = result.sampling!;
      const A_final = debugNote.A_final_m2!;
      const boundaryTolerance = 1e-8;
      
      expect(Math.abs(A_final - sampling.bracketInfo.A_lo)).toBeGreaterThan(boundaryTolerance);
      expect(Math.abs(A_final - sampling.bracketInfo.A_hi)).toBeGreaterThan(boundaryTolerance);
      
      console.log(`Converged in ${debugNote.iterations} iterations`);
      console.log(`candidate_source: ${debugNote.candidate_source}`);
      console.log(`A_final=${A_final.toExponential(3)} m² (interior solution)`);
      console.log(`D_final=${(result.D * 1000).toFixed(3)} mm`);
    });
  });

  describe('3) Residual validation', () => {
    it('should achieve residual <= 0.03 after forward verification', () => {
      const inputs = { ...baseCase, t: 175 };
      
      const result = computeDfromT(inputs);
      
      expect(result.D).toBeDefined();
      expect(result.sampling?.debugNote).toBeDefined();
      
      const debugNote = result.sampling!.debugNote!;
      
      // Check residual time (should be relative error)
      expect(debugNote.residual_time).toBeDefined();
      expect(debugNote.residual_time).toBeLessThanOrEqual(0.03); // 3% max
      
      console.log(`Residual: ${(debugNote.residual_time * 100).toFixed(3)}% <= 3%`);
      console.log(`Target time: ${debugNote.t_target_s}s`);
    });
  });

  describe('4) Boundary sentinel validation', () => {
    it('should throw "Hit bracket bound" for target time too small (out of bracket)', () => {
      // Use a very small target time that should be below the bracket
      const inputs = { ...baseCase, t: 0.001 }; // 1 ms - way too fast for 4L filling
      
      expect(() => computeDfromT(inputs)).toThrow();
      
      try {
        computeDfromT(inputs);
      } catch (error: any) {
        // Should be either "Target time out of bracket" or "Hit bracket bound"
        const isValidError = error.message.includes("Target time out of bracket") || 
                           error.message.includes("Hit bracket bound");
        
        expect(isValidError).toBe(true);
        expect(error.devNote).toBeDefined();
        
        // DevNote should contain diagnostic information
        expect(error.devNote.t_target_s).toBe(0.001);
        expect(error.devNote.A_lo_m2).toBeDefined();
        expect(error.devNote.A_hi_m2).toBeDefined();
        
        if (error.devNote.t_lo && error.devNote.t_hi) {
          // If we have bracket times, verify target is outside
          expect(0.001).toBeLessThan(error.devNote.t_hi); // Target too small
        }
        
        console.log(`Correctly rejected small target: ${error.message}`);
        console.log(`DevNote keys: ${Object.keys(error.devNote).join(', ')}`);
      }
    });

    it('should throw "Hit bracket bound" for target time too large (out of bracket)', () => {
      // Use a very large target time that should be above the bracket
      const inputs = { ...baseCase, t: 10000 }; // 10000s - way too slow for any realistic orifice
      
      expect(() => computeDfromT(inputs)).toThrow();
      
      try {
        computeDfromT(inputs);
      } catch (error: any) {
        const isValidError = error.message.includes("Target time out of bracket") || 
                           error.message.includes("Hit bracket bound");
        
        expect(isValidError).toBe(true);
        expect(error.devNote).toBeDefined();
        expect(error.devNote.t_target_s).toBe(10000);
        
        console.log(`Correctly rejected large target: ${error.message}`);
      }
    });
  });

  describe('5) Edge case validation', () => {
    it('should handle convergence at boundary with proper diagnostic', () => {
      // Test a case that might converge near boundary
      const inputs = { ...baseCase, t: 100, epsilon: 0.1 }; // Looser tolerance
      
      try {
        const result = computeDfromT(inputs);
        
        // If it succeeds, verify it's a valid solution
        expect(result.D).toBeGreaterThan(0);
        
        if (result.sampling?.debugNote?.candidate_source === "lo" || 
            result.sampling?.debugNote?.candidate_source === "hi") {
          // If it converged at boundary, residual should still be acceptable
          expect(result.sampling.debugNote.residual_time).toBeLessThanOrEqual(0.1);
          console.log(`Boundary convergence detected: ${result.sampling.debugNote.candidate_source}`);
        }
        
      } catch (error: any) {
        // If it fails with boundary hit, that's also acceptable
        if (error.message.includes("Hit bracket bound")) {
          expect(error.devNote).toBeDefined();
          console.log(`Boundary sentinel triggered correctly`);
        } else {
          throw error;
        }
      }
    });
  });
});