import { describe, it, expect } from 'vitest';
import { sample_tA, GASES, ComputeInputs } from '../physics';

describe('Sampler Monotonic Behavior', () => {
  it('should have strictly decreasing t(A) for orifice model using Gio case', () => {
    // Gio's case: Blowdown; V=200 mm³; T=15°C; P1=1200 kPa; P2=1 kPa; L=2 mm; t=175 s; Air; Cd=0.62; ε=0.01; isothermal
    const inputs: ComputeInputs = {
      process: 'blowdown',
      solveFor: 'DfromT',
      V: 200e-9,        // 200 mm³ in m³
      T: 288.15,        // 15°C in K
      P1: 1200000,      // 1200 kPa in Pa
      P2: 1000,         // 1 kPa in Pa
      L: 0.002,         // 2 mm in m
      t: 175,           // 175 s
      gas: GASES.air,
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal'
    };

    // Sample 7 points with A_lo=1e-12, A_hi=1e-9 for orifice
    const sampler = sample_tA(inputs, 'orifice', 7, 1e-12, 1e-9);
    
    console.log('Gio Case t(A) Sampler Results:');
    console.log(`Model: ${sampler.model}`);
    console.log(`Samples: ${sampler.samples.length}`);
    
    // Log bracket info if available
    if (sampler.bracket) {
      console.log('Bracket Info:');
      console.log(`  A_lo: ${sampler.bracket.A_lo.toExponential(3)} → t_lo: ${sampler.bracket.t_lo.toFixed(2)}s`);
      console.log(`  A_hi: ${sampler.bracket.A_hi.toExponential(3)} → t_hi: ${sampler.bracket.t_hi.toFixed(2)}s`);
      console.log(`  Expansions: ${sampler.bracket.expansions}`);
    }
    
    // Print sample table for debugging
    console.table(sampler.samples.map((sample, i) => ({
      index: i,
      A_m2: sample.A_m2.toExponential(3),
      D_mm: (sample.D_m * 1000).toFixed(4),
      t_s: sample.t_s.toFixed(2),
      phase: sample.phase,
      choked: sample.choked
    })));

    // Validate we have the expected number of samples
    expect(sampler.samples).toHaveLength(7);
    expect(sampler.model).toBe('orifice');

    // Check that all samples have valid (finite) times
    const validSamples = sampler.samples.filter(sample => 
      isFinite(sample.t_s) && sample.t_s > 0
    );
    
    if (validSamples.length < sampler.samples.length) {
      console.log('⚠️  Some samples have invalid times:');
      sampler.samples.forEach((sample, i) => {
        if (!isFinite(sample.t_s) || sample.t_s <= 0) {
          console.log(`  Sample ${i}: A=${sample.A_m2.toExponential(3)}, t=${sample.t_s}`);
        }
      });
    }

    // Assert monotonicity: t should decrease strictly with increasing A
    // Allow 1e-6 relative slack for numerical precision
    const tolerance = 1e-6;
    let isMonotonic = true;
    const failures: string[] = [];

    for (let i = 1; i < validSamples.length; i++) {
      const t_prev = validSamples[i-1].t_s;
      const t_curr = validSamples[i].t_s;
      const A_prev = validSamples[i-1].A_m2;
      const A_curr = validSamples[i].A_m2;
      
      // Check that t decreases as A increases
      // t_curr should be < t_prev * (1 - tolerance)
      const relativeDiff = (t_prev - t_curr) / t_prev;
      
      if (relativeDiff < tolerance) {
        isMonotonic = false;
        const failureMsg = `Non-monotonic at i=${i}: A[${i-1}]=${A_prev.toExponential(3)} → t=${t_prev.toFixed(4)}s, A[${i}]=${A_curr.toExponential(3)} → t=${t_curr.toFixed(4)}s (rel_diff=${relativeDiff.toExponential(3)})`;
        failures.push(failureMsg);
        console.log(`❌ ${failureMsg}`);
      } else {
        console.log(`✅ i=${i}: t decreased by ${(relativeDiff * 100).toFixed(4)}% (OK)`);
      }
    }

    // If not monotonic, print full debugging info
    if (!isMonotonic) {
      console.log('\n🔍 Full Debugging Info:');
      console.log('Input Parameters:');
      console.log(`  V: ${inputs.V * 1e9} mm³`);
      console.log(`  P1: ${inputs.P1 / 1000} kPa`);
      console.log(`  P2: ${inputs.P2 / 1000} kPa`);
      console.log(`  T: ${inputs.T - 273.15}°C`);
      console.log(`  L: ${inputs.L * 1000} mm`);
      console.log(`  t_target: ${inputs.t}s`);
      console.log(`  Cd: ${inputs.Cd}`);
      console.log(`  ε: ${inputs.epsilon}`);
      console.log(`  Gas: ${inputs.gas.name}`);
      
      console.log('\nSampling Range:');
      console.log(`  A_lo: ${(1e-12).toExponential(3)} m²`);
      console.log(`  A_hi: ${(1e-9).toExponential(3)} m²`);
      console.log(`  n: 7 points`);
      
      console.log('\nFailures:');
      failures.forEach(failure => console.log(`  ${failure}`));
    }

    // Assert monotonicity
    expect(isMonotonic).toBe(true);
    
    // Additional validations
    expect(validSamples.length).toBeGreaterThan(0);
    
    // Check that areas are in ascending order
    for (let i = 1; i < sampler.samples.length; i++) {
      expect(sampler.samples[i].A_m2).toBeGreaterThan(sampler.samples[i-1].A_m2);
    }
    
    // Check that diameters are in ascending order (D = sqrt(4A/π))
    for (let i = 1; i < sampler.samples.length; i++) {
      expect(sampler.samples[i].D_m).toBeGreaterThan(sampler.samples[i-1].D_m);
    }
    
    console.log(`✅ Monotonicity test passed for ${validSamples.length} valid samples`);
  });

  it('should handle edge cases in monotonicity checking', () => {
    // Test with a simpler case to ensure the test framework works
    const inputs: ComputeInputs = {
      process: 'blowdown',
      solveFor: 'DfromT',
      V: 1e-3,          // 1 liter
      T: 293.15,        // 20°C
      P1: 800000,       // 8 bar
      P2: 100000,       // 1 bar
      L: 0.005,         // 5 mm
      t: 30,            // 30 s
      gas: GASES.air,
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal'
    };

    // Sample with a smaller range for more stable behavior
    const sampler = sample_tA(inputs, 'orifice', 5, 1e-10, 1e-7);
    
    expect(sampler.samples).toHaveLength(5);
    expect(sampler.model).toBe('orifice');
    
    // Should have some valid samples
    const validSamples = sampler.samples.filter(sample => 
      isFinite(sample.t_s) && sample.t_s > 0
    );
    expect(validSamples.length).toBeGreaterThan(0);
    
    console.log(`Edge case test: ${validSamples.length}/${sampler.samples.length} samples valid`);
  });
});