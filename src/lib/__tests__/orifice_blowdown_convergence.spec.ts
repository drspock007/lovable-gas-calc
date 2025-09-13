import { describe, it, expect } from 'vitest';
import { computeDfromT, GASES, ComputeInputs } from '../physics';

describe('Orifice Blowdown Convergence Tests', () => {
  it('should converge within 100 iterations for standard blowdown case', () => {
    // Test case: Air, V=1e-3 m³, P1=8 bar, P2=1 bar, T=293 K, Cd=0.62, ε=0.01, solve D from t with t=45 s
    const inputs: ComputeInputs = {
      process: 'blowdown',
      solveFor: 'DfromT',
      V: 1e-3, // 1 liter
      P1: 8e5, // 8 bar in Pa
      P2: 1e5, // 1 bar in Pa
      T: 293, // 20°C in K
      L: 0.01, // 10 mm length
      gas: GASES.air,
      Cd: 0.62,
      epsilon: 0.01,
      t: 45, // 45 seconds
    };

    console.log('Running orifice blowdown convergence test...');
    const result = computeDfromT(inputs);

    // Verify convergence succeeded
    expect(result.verdict).not.toBe('inconclusive');
    expect(result.error).toBeUndefined();
    
    // Verify diameter is finite and reasonable
    expect(result.D).toBeDefined();
    expect(Number.isFinite(result.D!)).toBe(true);
    expect(result.D!).toBeGreaterThan(0);
    expect(result.D!).toBeLessThan(0.1); // Less than 10 cm diameter
    
    console.log(`Computed diameter: ${(result.D! * 1000).toFixed(3)} mm`);
    
    // Check if flow is choked and verify Mach <= 1
    const isChoked = result.diagnostics.choked as boolean;
    const mach = result.diagnostics.Mach as number;
    
    console.log(`Flow choked: ${isChoked}, Mach: ${mach.toFixed(3)}`);
    
    expect(Number.isFinite(mach)).toBe(true);
    expect(mach).toBeGreaterThan(0);
    
    if (isChoked) {
      // When choked, Mach should be exactly 1 at the throat
      expect(mach).toBeLessThanOrEqual(1.0);
      expect(Math.abs(mach - 1.0)).toBeLessThan(0.001); // Very close to 1
    } else {
      // When not choked, Mach should be < 1
      expect(mach).toBeLessThan(1.0);
    }
    
    // Verify no warnings about convergence issues
    const convergenceWarnings = result.warnings.filter(w => 
      w.toLowerCase().includes('converge') || 
      w.toLowerCase().includes('bracket') ||
      w.toLowerCase().includes('iteration')
    );
    expect(convergenceWarnings).toHaveLength(0);
  });

  it('should handle edge case with very short time target', () => {
    const inputs: ComputeInputs = {
      process: 'blowdown',
      solveFor: 'DfromT',
      V: 1e-3,
      P1: 10e5, // Higher pressure
      P2: 1e5,
      T: 293,
      L: 0.005, // Shorter length
      gas: GASES.air,
      Cd: 0.62,
      epsilon: 0.01,
      t: 1, // Very fast blowdown - 1 second
    };

    const result = computeDfromT(inputs);
    
    // Should either converge or provide meaningful error
    if (result.error) {
      expect(['bracketing', 'integral', 'convergence']).toContain(result.error.type);
      expect(result.error.suggestions).toBeDefined();
      expect(result.error.suggestions!.length).toBeGreaterThan(0);
    } else {
      expect(result.D).toBeDefined();
      expect(Number.isFinite(result.D!)).toBe(true);
      expect(result.D!).toBeGreaterThan(0);
    }
  });

  it('should handle high pressure ratio cases', () => {
    const inputs: ComputeInputs = {
      process: 'blowdown',
      solveFor: 'DfromT',
      V: 2e-3, // 2 liters
      P1: 20e5, // 20 bar - high pressure
      P2: 1e5, // 1 bar
      T: 293,
      L: 0.02, // 20 mm length
      gas: GASES.air,
      Cd: 0.62,
      epsilon: 0.01,
      t: 30,
    };

    const result = computeDfromT(inputs);
    
    // High pressure ratio should definitely be choked
    expect(result.diagnostics.choked).toBe(true);
    expect(result.diagnostics.Mach).toBeLessThanOrEqual(1.0);
    
    // Should have warnings about high pressure ratio
    const pressureWarnings = result.warnings.filter(w => 
      w.toLowerCase().includes('pressure ratio') ||
      w.toLowerCase().includes('compressibility')
    );
    expect(pressureWarnings.length).toBeGreaterThan(0);
  });

  it('should provide consistent results for different gases', () => {
    const baseInputs = {
      process: 'blowdown' as const,
      solveFor: 'DfromT' as const,
      V: 1e-3,
      P1: 5e5,
      P2: 1e5,
      T: 293,
      L: 0.01,
      Cd: 0.62,
      epsilon: 0.01,
      t: 25,
    };

    // Test with different gases
    const gases = ['air', 'N2', 'CH4', 'He'] as const;
    const results: Array<{ gas: string; D: number; choked: boolean; Mach: number }> = [];

    for (const gasName of gases) {
      const inputs: ComputeInputs = {
        ...baseInputs,
        gas: GASES[gasName],
      };

      const result = computeDfromT(inputs);
      expect(result.D).toBeDefined();
      expect(Number.isFinite(result.D!)).toBe(true);
      
      results.push({
        gas: gasName,
        D: result.D!,
        choked: result.diagnostics.choked as boolean,
        Mach: result.diagnostics.Mach as number,
      });
    }

    // All results should be physically reasonable
    results.forEach(({ gas, D, choked, Mach }) => {
      console.log(`${gas}: D=${(D*1000).toFixed(2)}mm, choked=${choked}, Mach=${Mach.toFixed(3)}`);
      
      expect(D).toBeGreaterThan(0);
      expect(D).toBeLessThan(0.05); // Less than 5 cm
      expect(Mach).toBeGreaterThan(0);
      expect(Mach).toBeLessThanOrEqual(1.0);
      
      if (choked) {
        expect(Math.abs(Mach - 1.0)).toBeLessThan(0.01);
      }
    });

    // Helium should generally require smaller diameter due to higher R
    const airResult = results.find(r => r.gas === 'air')!;
    const heliumResult = results.find(r => r.gas === 'He')!;
    expect(heliumResult.D).toBeLessThan(airResult.D);
  });
});