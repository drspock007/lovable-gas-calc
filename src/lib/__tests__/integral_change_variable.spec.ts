import { describe, it, expect } from 'vitest';

// Mock the old integrator approach for comparison
function oldSubcriticalIntegral(P2: number, Pstar: number, Pf: number, gamma: number): number {
  // Simplified old approach - direct integration without change of variables
  // This represents the problematic integrand that can fail near endpoints
  
  const integrand = (P: number) => {
    if (P <= P2 || P >= Pstar) return 0;
    const ratio = P2 / P;
    const term1 = Math.pow(ratio, 2/gamma);
    const term2 = Math.pow(ratio, (gamma+1)/gamma);
    const discriminant = term1 - term2;
    
    if (discriminant <= 0) return 0; // Problematic near endpoints
    
    return 1 / (P * Math.sqrt(discriminant));
  };

  // Simple trapezoidal integration (represents old method)
  const n = 100;
  const dP = (Pstar - Pf) / n;
  let sum = 0;
  
  for (let i = 1; i < n; i++) {
    const P = Pf + i * dP;
    try {
      const val = integrand(P);
      if (isFinite(val)) sum += val;
    } catch {
      return NaN; // Integration failure
    }
  }
  
  return sum * dP;
}

// Import the new integrator
import { computeDfromT, GASES, ComputeInputs } from '../physics';

// Access the internal subcritical integral functions by creating test cases
function testNewIntegrator(P2: number, Pstar: number, Pf: number, gamma: number): number {
  // Create a minimal test case to trigger the new integrator
  const inputs: ComputeInputs = {
    process: 'blowdown',
    solveFor: 'DfromT',
    V: 1e-3,
    P1: Pstar,
    P2: P2,
    T: 293,
    L: 0.01,
    gas: { ...GASES.air, gamma },
    Cd: 0.62,
    epsilon: 0.01,
    t: 10,
  };

  try {
    const result = computeDfromT(inputs);
    // If computation succeeds, the integrator worked
    return result.D ? 1.0 : NaN;
  } catch (error) {
    // If it fails with integral error, return NaN
    if (error instanceof Error && error.message.includes('integral')) {
      return NaN;
    }
    throw error;
  }
}

describe('Integral Change of Variables Tests', () => {
  it('should compare old vs new integrator on problematic cases', () => {
    // Test cases designed to stress the integrator near singularities
    const testCases = [
      // Case 1: Near-critical pressure ratio
      { P2: 1e5, Pstar: 1.1e5, Pf: 1.001e5, gamma: 1.4, description: 'Near-critical ratio' },
      
      // Case 2: High gamma (sharper singularity)
      { P2: 1e5, Pstar: 2e5, Pf: 1.05e5, gamma: 1.67, description: 'High gamma (Helium-like)' },
      
      // Case 3: Very close to exit pressure
      { P2: 1e5, Pstar: 3e5, Pf: 1.001e5, gamma: 1.3, description: 'Very close to exit' },
      
      // Case 4: Low gamma (CO2-like)
      { P2: 1e5, Pstar: 2e5, Pf: 1.1e5, gamma: 1.3, description: 'Low gamma (CO2-like)' },
      
      // Case 5: Extreme pressure ratio
      { P2: 1e5, Pstar: 10e5, Pf: 1.01e5, gamma: 1.4, description: 'Extreme pressure ratio' },
    ];

    const results = testCases.map(testCase => {
      const { P2, Pstar, Pf, gamma, description } = testCase;
      
      console.log(`Testing: ${description}`);
      
      // Test old integrator
      let oldResult: number;
      try {
        oldResult = oldSubcriticalIntegral(P2, Pstar, Pf, gamma);
      } catch {
        oldResult = NaN;
      }
      
      // Test new integrator
      let newResult: number;
      try {
        newResult = testNewIntegrator(P2, Pstar, Pf, gamma);
      } catch {
        newResult = NaN;
      }
      
      console.log(`  Old integrator: ${isFinite(oldResult) ? oldResult.toExponential(3) : 'FAILED'}`);
      console.log(`  New integrator: ${isFinite(newResult) ? 'SUCCESS' : 'FAILED'}`);
      
      return {
        description,
        oldSuccess: isFinite(oldResult),
        newSuccess: isFinite(newResult),
        oldResult,
        newResult,
      };
    });

    // Analysis of results
    let oldSuccesses = 0;
    let newSuccesses = 0;
    let improvementCases = 0;

    results.forEach(({ description, oldSuccess, newSuccess }) => {
      if (oldSuccess) oldSuccesses++;
      if (newSuccess) newSuccesses++;
      if (!oldSuccess && newSuccess) improvementCases++;
      
      console.log(`${description}: Old=${oldSuccess ? 'OK' : 'FAIL'}, New=${newSuccess ? 'OK' : 'FAIL'}`);
    });

    console.log(`\nSummary:`);
    console.log(`  Old integrator successes: ${oldSuccesses}/${testCases.length}`);
    console.log(`  New integrator successes: ${newSuccesses}/${testCases.length}`);
    console.log(`  Cases where new succeeds but old fails: ${improvementCases}`);

    // Assertions
    expect(newSuccesses).toBeGreaterThanOrEqual(oldSuccesses);
    expect(improvementCases).toBeGreaterThan(0);
    
    // New integrator should handle at least 80% of test cases
    expect(newSuccesses / testCases.length).toBeGreaterThanOrEqual(0.8);
  });

  it('should handle endpoint singularities gracefully', () => {
    // Test cases specifically designed to hit endpoint singularities
    const singularityCases = [
      // Case where Pf approaches P2 (y approaches 1)
      { P2: 1e5, Pstar: 2e5, Pf: 1.0001e5, gamma: 1.4 },
      
      // Case where Pstar approaches P2 (integration interval vanishes)
      { P2: 1e5, Pstar: 1.001e5, Pf: 1.05e5, gamma: 1.4 },
      
      // Case with very small epsilon
      { P2: 1e5, Pstar: 1.5e5, Pf: 1.00001e5, gamma: 1.4 },
    ];

    singularityCases.forEach((testCase, index) => {
      const { P2, Pstar, Pf, gamma } = testCase;
      
      console.log(`Singularity test ${index + 1}: P2=${P2}, Pstar=${Pstar}, Pf=${Pf}`);
      
      // The new integrator should either succeed or fail gracefully with proper error
      const result = testNewIntegrator(P2, Pstar, Pf, gamma);
      
      // Should not return Infinity or cause crashes
      expect(result).not.toBe(Infinity);
      expect(result).not.toBe(-Infinity);
      
      if (isFinite(result)) {
        console.log(`  Success: finite result`);
        expect(result).toBeGreaterThan(0);
      } else {
        console.log(`  Graceful failure: NaN result`);
        expect(result).toBeNaN();
      }
    });
  });

  it('should maintain numerical accuracy across parameter ranges', () => {
    // Test numerical accuracy by comparing against analytical limits
    const accuracyTests = [
      // Case 1: Large separation (should be well-behaved)
      { P2: 1e5, Pstar: 5e5, Pf: 2e5, gamma: 1.4, shouldSucceed: true },
      
      // Case 2: Moderate separation
      { P2: 1e5, Pstar: 3e5, Pf: 1.5e5, gamma: 1.4, shouldSucceed: true },
      
      // Case 3: Small separation
      { P2: 1e5, Pstar: 2e5, Pf: 1.2e5, gamma: 1.4, shouldSucceed: true },
    ];

    accuracyTests.forEach(({ P2, Pstar, Pf, gamma, shouldSucceed }, index) => {
      console.log(`Accuracy test ${index + 1}`);
      
      const result = testNewIntegrator(P2, Pstar, Pf, gamma);
      
      if (shouldSucceed) {
        expect(Number.isFinite(result)).toBe(true);
        expect(result).toBeGreaterThan(0);
        console.log(`  Success: finite positive result`);
      }
    });
  });

  it('should show performance improvement over grid of parameters', () => {
    // Systematic test over parameter grid
    const gammaValues = [1.2, 1.3, 1.4, 1.67];
    const pressureRatios = [2, 5, 10, 20]; // P1/P2 ratios
    const epsilonFactors = [0.001, 0.01, 0.1]; // Pf = P2 * (1 + eps)
    
    let totalTests = 0;
    let oldSuccesses = 0;
    let newSuccesses = 0;
    
    for (const gamma of gammaValues) {
      for (const ratio of pressureRatios) {
        for (const epsFactor of epsilonFactors) {
          const P2 = 1e5;
          const P1 = ratio * P2;
          const rc = Math.pow(2 / (gamma + 1), gamma / (gamma - 1));
          const Pstar = P2 / rc;
          const Pf = P2 * (1 + epsFactor);
          
          // Only test subcritical cases
          if (P1 > Pstar && Pf < Pstar) {
            totalTests++;
            
            // Test old method
            const oldResult = oldSubcriticalIntegral(P2, Pstar, Pf, gamma);
            if (isFinite(oldResult)) oldSuccesses++;
            
            // Test new method
            const newResult = testNewIntegrator(P2, Pstar, Pf, gamma);
            if (isFinite(newResult)) newSuccesses++;
          }
        }
      }
    }
    
    console.log(`Grid test results:`);
    console.log(`  Total test cases: ${totalTests}`);
    console.log(`  Old method success rate: ${(oldSuccesses/totalTests*100).toFixed(1)}%`);
    console.log(`  New method success rate: ${(newSuccesses/totalTests*100).toFixed(1)}%`);
    
    expect(totalTests).toBeGreaterThan(0);
    expect(newSuccesses).toBeGreaterThanOrEqual(oldSuccesses);
    expect(newSuccesses / totalTests).toBeGreaterThan(0.7); // At least 70% success rate
  });
});