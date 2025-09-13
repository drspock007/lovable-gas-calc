import { describe, it, expect } from 'vitest';
import { sample_tA, GASES } from '../physics';

describe('t(A) Sampler Monotonicity', () => {
  it('should show strict monotonic decreasing t(A) for orifice isothermal', () => {
    const inputs = {
      process: 'blowdown' as const,
      solveFor: 'DfromT' as const,
      V: 1e-6, // m³
      P1: 5e5, // Pa
      P2: 1e5, // Pa
      T: 300, // K
      L: 0.001, // m
      gas: GASES.air,
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal' as const
    };

    // Sample 5-7 points
    const numSamples = 6;
    const A_lo = 1e-12; // m²
    const A_hi = 1e-8;  // m²
    
    const result = sample_tA(inputs, 'orifice', A_lo, A_hi, numSamples);
    
    expect(result.samples).toBeDefined();
    expect(result.samples.length).toBe(numSamples);
    
    // Check strict monotonicity (decreasing): t[i] > t[i+1] for all i
    for (let i = 0; i < result.samples.length - 1; i++) {
      const t_current = result.samples[i].t_s;
      const t_next = result.samples[i + 1].t_s;
      
      expect(t_current).toBeGreaterThan(t_next);
      expect(t_current).toBeGreaterThan(0);
      expect(t_next).toBeGreaterThan(0);
    }
    
    console.log('t(A) Monotonicity Test Results:');
    result.samples.forEach((sample, i) => {
      console.log(`  Sample ${i}: A=${sample.A_m2.toExponential(2)} m², D=${sample.D_m.toExponential(2)} m, t=${sample.t_s.toFixed(1)} s`);
    });
    
    // Additional checks
    expect(result.samples[0].t_s).toBeGreaterThan(result.samples[numSamples - 1].t_s);
    
    // Verify reasonable time range (should span multiple orders of magnitude)
    const timeRatio = result.samples[0].t_s / result.samples[numSamples - 1].t_s;
    expect(timeRatio).toBeGreaterThan(10); // Should have significant range
  });

  it('should maintain monotonicity across different gas properties', () => {
    const gases = [GASES.air, GASES.N2, GASES.He];
    
    gases.forEach(gas => {
      const inputs = {
        process: 'blowdown' as const,
        solveFor: 'DfromT' as const,
        V: 5e-7, // m³
        P1: 3e5, // Pa
        P2: 1e5, // Pa
        T: 298.15, // K
        L: 0.0015, // m
        gas,
        Cd: 0.62,
        epsilon: 0.01,
        regime: 'isothermal' as const
      };

      const result = sample_tA(inputs, 'orifice', 1e-12, 1e-9, 5);
      
      expect(result.samples.length).toBe(5);
      
      // Check monotonicity for this gas
      for (let i = 0; i < result.samples.length - 1; i++) {
        expect(result.samples[i].t_s).toBeGreaterThan(result.samples[i + 1].t_s);
      }
      
      console.log(`${gas.name} monotonicity: ${result.samples[0].t_s.toFixed(1)} > ... > ${result.samples[4].t_s.toFixed(1)} s`);
    });
  });

  it('should handle capillary model monotonicity', () => {
    const inputs = {
      process: 'blowdown' as const,
      solveFor: 'DfromT' as const,
      V: 1e-6, // m³
      P1: 2e5, // Pa (low pressure ratio for subcritical)
      P2: 1.5e5, // Pa
      T: 300, // K
      L: 0.01, // m (high L/D to favor capillary)
      gas: GASES.air,
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal' as const
    };

    const result = sample_tA(inputs, 'capillary', 1e-12, 1e-9, 5);
    
    expect(result.samples.length).toBe(5);
    
    // Capillary should also be monotonic decreasing
    for (let i = 0; i < result.samples.length - 1; i++) {
      expect(result.samples[i].t_s).toBeGreaterThan(result.samples[i + 1].t_s);
    }
    
    // All should be subcritical (non-choked)
    result.samples.forEach(sample => {
      expect(sample.choked).toBe(false);
      expect(sample.phase).toBe('sub');
    });
    
    console.log('Capillary monotonicity verified - all subcritical');
  });
});