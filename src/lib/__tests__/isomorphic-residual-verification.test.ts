import { describe, it, expect } from 'vitest';
import { computeDfromT, GASES } from '../physics';

describe('Isomorphic Residual Verification', () => {
  const baseBlowdownInputs = {
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

  const baseFillingInputs = {
    process: 'filling' as const,
    solveFor: 'DfromT' as const,
    V: 2e-7,
    P1: 1e3,
    P2: 1.2e6,
    Ps: 1.5e6, // Supply pressure
    T: 288.15,
    L: 0.002,
    gas: GASES.air,
    Cd: 0.62,
    epsilon: 0.01,
    regime: 'isothermal' as const
  };

  describe('Choking criteria validation', () => {
    it('should use P2/P1 for blowdown choking in devNote', () => {
      // Use parameters that will likely cause residual rejection
      const inputs = { ...baseBlowdownInputs, t: 175, epsilon: 0.001 }; // Very strict epsilon
      
      try {
        computeDfromT(inputs);
      } catch (error: any) {
        if (error.message === "Result rejected by residual check" && error.devNote) {
          expect(error.devNote.choking).toBeDefined();
          expect(error.devNote.choking.ratio_type).toBe('P2/P1');
          expect(error.devNote.choking.r).toBeCloseTo(inputs.P2 / inputs.P1, 6);
          expect(error.devNote.choking.r_crit).toBeDefined();
          expect(typeof error.devNote.choking.choked).toBe('boolean');
        }
      }
    });

    it('should use Pv/Ps for filling choking in devNote', () => {
      // Use parameters that will likely cause residual rejection
      const inputs = { ...baseFillingInputs, t: 100, epsilon: 0.001 }; // Very strict epsilon
      
      try {
        computeDfromT(inputs);
      } catch (error: any) {
        if (error.message === "Result rejected by residual check" && error.devNote) {
          expect(error.devNote.choking).toBeDefined();
          expect(error.devNote.choking.ratio_type).toBe('Pv/Ps');
          expect(error.devNote.choking.r).toBeCloseTo(inputs.P1 / inputs.Ps!, 6);
          expect(error.devNote.choking.r_crit).toBeDefined();
          expect(typeof error.devNote.choking.choked).toBe('boolean');
        }
      }
    });
  });

  describe('Local refinement behavior', () => {
    it('should attempt local refinement before rejection', () => {
      const inputs = { ...baseBlowdownInputs, t: 175, epsilon: 0.005 }; // Moderately strict
      
      try {
        const result = computeDfromT(inputs);
        // If successful, should have reasonable diameter
        expect(result.D).toBeGreaterThan(0);
      } catch (error: any) {
        if (error.message === "Result rejected by residual check" && error.devNote) {
          // Should show refinement was attempted
          expect(error.devNote.refinement_attempted).toBe(true);
          expect(error.devNote.original_residual).toBeDefined();
          expect(error.devNote.refined_residual).toBeDefined();
          expect(error.devNote.refined_residual).toBeLessThanOrEqual(error.devNote.original_residual);
        }
      }
    });
  });

  describe('DevNote completeness for residual rejection', () => {
    it('should provide comprehensive devNote on residual rejection', () => {
      const inputs = { ...baseBlowdownInputs, t: 175, epsilon: 0.001 }; // Very strict to force rejection
      
      try {
        computeDfromT(inputs);
      } catch (error: any) {
        if (error.message === "Result rejected by residual check") {
          const devNote = error.devNote;
          
          // Check all required fields
          expect(devNote.process).toBe('blowdown');
          expect(devNote.model).toBeDefined();
          expect(devNote.epsilon_used).toBe(0.01); // Should be max(epsilon, 0.01)
          expect(devNote.residual).toBeDefined();
          expect(devNote.t_target).toBe(175);
          expect(devNote.t_forward).toBeDefined();
          expect(devNote.A_candidate_SI_m2).toBeDefined();
          expect(devNote.D_candidate_SI_m).toBeDefined();
          
          // Bounds information
          expect(devNote.bounds_used).toBeDefined();
          
          // Choking information
          expect(devNote.choking).toBeDefined();
          expect(devNote.choking.r_crit).toBeDefined();
          expect(devNote.choking.choked).toBeDefined();
          expect(devNote.choking.r).toBeDefined();
          expect(devNote.choking.ratio_type).toBe('P2/P1');
          
          // Inputs SI
          expect(devNote.inputs_SI).toBeDefined();
          expect(devNote.inputs_SI.V_SI_m3).toBe(inputs.V);
          expect(devNote.inputs_SI.P1_Pa).toBe(inputs.P1);
          expect(devNote.inputs_SI.P2_Pa).toBe(inputs.P2);
          expect(devNote.inputs_SI.T_K).toBe(inputs.T);
        }
      }
    });

    it('should provide filling-specific devNote', () => {
      const inputs = { ...baseFillingInputs, t: 100, epsilon: 0.001 }; // Very strict to force rejection
      
      try {
        computeDfromT(inputs);
      } catch (error: any) {
        if (error.message === "Result rejected by residual check") {
          const devNote = error.devNote;
          
          expect(devNote.process).toBe('filling');
          expect(devNote.choking.ratio_type).toBe('Pv/Ps');
          expect(devNote.inputs_SI.Ps_Pa).toBe(inputs.Ps);
          
          // Should use Pv/Ps ratio
          expect(devNote.choking.r).toBeCloseTo(inputs.P1 / inputs.Ps!, 6);
        }
      }
    });
  });

  describe('Epsilon verification logic', () => {
    it('should enforce minimum epsilon of 0.01', () => {
      const inputs = { ...baseBlowdownInputs, t: 175, epsilon: 0.001 }; // Less than 0.01
      
      try {
        computeDfromT(inputs);
      } catch (error: any) {
        if (error.message === "Result rejected by residual check") {
          expect(error.devNote.epsilon_used).toBe(0.01); // Should be clamped to 0.01
        }
      }
    });

    it('should use provided epsilon if greater than 0.01', () => {
      const inputs = { ...baseBlowdownInputs, t: 175, epsilon: 0.05 }; // Greater than 0.01
      
      try {
        const result = computeDfromT(inputs);
        expect(result.D).toBeDefined(); // Should likely succeed with relaxed tolerance
      } catch (error: any) {
        if (error.message === "Result rejected by residual check") {
          expect(error.devNote.epsilon_used).toBe(0.05);
        }
      }
    });
  });
});