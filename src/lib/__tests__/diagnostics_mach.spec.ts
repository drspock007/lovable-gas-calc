import { describe, it, expect } from 'vitest';
import { computeDfromT, computeTfromD, GASES, ComputeInputs, criticalPressureRatio } from '../physics';

describe('Diagnostics Mach Number Tests', () => {
  it('should have Mach === 1 when choked=true for blowdown', () => {
    // Create conditions that guarantee choked flow
    const testCases = [
      // High pressure ratio case
      {
        process: 'blowdown' as const,
        V: 1e-3,
        P1: 10e5, // 10 bar
        P2: 1e5,  // 1 bar - high ratio
        T: 293,
        L: 0.01,
        gas: GASES.air,
        description: 'High pressure ratio air'
      },
      
      // Helium case (different gamma)
      {
        process: 'blowdown' as const,
        V: 2e-3,
        P1: 6e5,
        P2: 1e5,
        T: 293,
        L: 0.005,
        gas: GASES.He,
        description: 'Helium blowdown'
      },
      
      // CO2 case (low gamma)
      {
        process: 'blowdown' as const,
        V: 1.5e-3,
        P1: 8e5,
        P2: 1e5,
        T: 293,
        L: 0.015,
        gas: GASES.CO2,
        description: 'CO2 blowdown'
      },
      
      // Methane case
      {
        process: 'blowdown' as const,
        V: 1e-3,
        P1: 15e5,
        P2: 1e5,
        T: 293,
        L: 0.008,
        gas: GASES.CH4,
        description: 'Methane blowdown'
      }
    ];

    testCases.forEach(({ description, ...baseInputs }) => {
      console.log(`Testing ${description}...`);
      
      // Calculate critical pressure ratio for this gas
      const rc = criticalPressureRatio(baseInputs.gas.gamma);
      const Pstar = baseInputs.P2 / rc;
      
      console.log(`  Critical pressure: ${(Pstar/1e5).toFixed(2)} bar`);
      console.log(`  Initial pressure: ${(baseInputs.P1/1e5).toFixed(2)} bar`);
      console.log(`  Expected choked: ${baseInputs.P1 > Pstar}`);

      // Test with DfromT
      const inputsDfromT: ComputeInputs = {
        ...baseInputs,
        solveFor: 'DfromT',
        Cd: 0.62,
        epsilon: 0.01,
        t: 30, // 30 seconds
      };

      const resultDfromT = computeDfromT(inputsDfromT);
      
      expect(resultDfromT.diagnostics).toBeDefined();
      const choked = resultDfromT.diagnostics.choked as boolean;
      const mach = resultDfromT.diagnostics.Mach as number;
      
      console.log(`  DfromT - Choked: ${choked}, Mach: ${mach?.toFixed(6) || 'undefined'}`);
      
      expect(mach).toBeDefined();
      expect(Number.isFinite(mach)).toBe(true);
      
      if (choked) {
        // When choked, Mach must be exactly 1
        expect(mach).toBe(1.0);
        console.log(`  ✓ Choked flow: Mach = ${mach} (exactly 1)`);
      } else {
        // When not choked, Mach should be < 1
        expect(mach).toBeLessThan(1.0);
        expect(mach).toBeGreaterThan(0);
        console.log(`  ✓ Subsonic flow: Mach = ${mach.toFixed(3)} < 1`);
      }

      // Test with TfromD if we got a diameter
      if (resultDfromT.D) {
        const inputsTfromD: ComputeInputs = {
          ...baseInputs,
          solveFor: 'TfromD',
          Cd: 0.62,
          epsilon: 0.01,
          D: resultDfromT.D,
        };

        const resultTfromD = computeTfromD(inputsTfromD);
        
        const choked2 = resultTfromD.diagnostics.choked as boolean;
        const mach2 = resultTfromD.diagnostics.Mach as number;
        
        console.log(`  TfromD - Choked: ${choked2}, Mach: ${mach2?.toFixed(6) || 'undefined'}`);
        
        // Should give consistent results
        expect(choked2).toBe(choked);
        
        if (choked2) {
          expect(mach2).toBe(1.0);
        } else {
          expect(mach2).toBeLessThan(1.0);
          expect(mach2).toBeGreaterThan(0);
        }
      }
    });
  });

  it('should have Mach === 1 when choked=true for filling', () => {
    const testCases = [
      // High supply pressure case
      {
        process: 'filling' as const,
        V: 1e-3,
        P1: 1e5,  // 1 bar initial
        P2: 8e5,  // 8 bar target
        Ps: 12e5, // 12 bar supply - high ratio
        T: 293,
        L: 0.01,
        gas: GASES.air,
        description: 'High supply pressure air'
      },
      
      // Nitrogen filling
      {
        process: 'filling' as const,
        V: 1.5e-3,
        P1: 2e5,
        P2: 10e5,
        Ps: 15e5,
        T: 293,
        L: 0.012,
        gas: GASES.N2,
        description: 'Nitrogen filling'
      },
      
      // Helium filling (high gamma)
      {
        process: 'filling' as const,
        V: 0.8e-3,
        P1: 1e5,
        P2: 6e5,
        Ps: 10e5,
        T: 293,
        L: 0.008,
        gas: GASES.He,
        description: 'Helium filling'
      }
    ];

    testCases.forEach(({ description, ...baseInputs }) => {
      console.log(`Testing ${description}...`);
      
      // Calculate critical pressure ratio for this gas
      const rc = criticalPressureRatio(baseInputs.gas.gamma);
      const Pstar = rc * baseInputs.Ps!;
      
      console.log(`  Critical pressure: ${(Pstar/1e5).toFixed(2)} bar`);
      console.log(`  Initial pressure: ${(baseInputs.P1/1e5).toFixed(2)} bar`);
      console.log(`  Supply pressure: ${(baseInputs.Ps!/1e5).toFixed(2)} bar`);
      console.log(`  Expected choked: ${baseInputs.P1 < Pstar}`);

      // Test with DfromT
      const inputsDfromT: ComputeInputs = {
        ...baseInputs,
        solveFor: 'DfromT',
        Cd: 0.62,
        epsilon: 0.01,
        t: 45, // 45 seconds
      };

      const resultDfromT = computeDfromT(inputsDfromT);
      
      const choked = resultDfromT.diagnostics.choked as boolean;
      const mach = resultDfromT.diagnostics.Mach as number;
      
      console.log(`  Choked: ${choked}, Mach: ${mach?.toFixed(6) || 'undefined'}`);
      
      expect(mach).toBeDefined();
      expect(Number.isFinite(mach)).toBe(true);
      
      if (choked) {
        // When choked, Mach must be exactly 1
        expect(mach).toBe(1.0);
        console.log(`  ✓ Choked flow: Mach = ${mach} (exactly 1)`);
      } else {
        // When not choked, Mach should be < 1
        expect(mach).toBeLessThan(1.0);
        expect(mach).toBeGreaterThan(0);
        console.log(`  ✓ Subsonic flow: Mach = ${mach.toFixed(3)} < 1`);
      }
    });
  });

  it('should transition correctly at critical pressure ratio', () => {
    // Test cases right at the critical pressure ratio boundary
    const gas = GASES.air;
    const rc = criticalPressureRatio(gas.gamma);
    
    console.log(`Critical pressure ratio for air: ${rc.toFixed(6)}`);
    
    const baseCase = {
      process: 'blowdown' as const,
      solveFor: 'DfromT' as const,
      V: 1e-3,
      P2: 1e5, // 1 bar
      T: 293,
      L: 0.01,
      gas: gas,
      Cd: 0.62,
      epsilon: 0.01,
      t: 20,
    };

    // Test just above critical (should be choked)
    const P1_choked = baseCase.P2 / rc * 1.01; // Just above critical
    const inputsChoked: ComputeInputs = {
      ...baseCase,
      P1: P1_choked,
    };

    const resultChoked = computeDfromT(inputsChoked);
    console.log(`P1/P2 = ${(P1_choked/baseCase.P2).toFixed(3)} (> 1/rc = ${(1/rc).toFixed(3)})`);
    console.log(`Choked: ${resultChoked.diagnostics.choked}, Mach: ${resultChoked.diagnostics.Mach}`);
    
    expect(resultChoked.diagnostics.choked).toBe(true);
    expect(resultChoked.diagnostics.Mach).toBe(1.0);

    // Test just below critical (should not be choked)
    const P1_subsonic = baseCase.P2 / rc * 0.99; // Just below critical
    const inputsSubsonic: ComputeInputs = {
      ...baseCase,
      P1: P1_subsonic,
    };

    const resultSubsonic = computeDfromT(inputsSubsonic);
    console.log(`P1/P2 = ${(P1_subsonic/baseCase.P2).toFixed(3)} (< 1/rc = ${(1/rc).toFixed(3)})`);
    console.log(`Choked: ${resultSubsonic.diagnostics.choked}, Mach: ${resultSubsonic.diagnostics.Mach}`);
    
    expect(resultSubsonic.diagnostics.choked).toBe(false);
    expect(resultSubsonic.diagnostics.Mach as number).toBeLessThan(1.0);
    expect(resultSubsonic.diagnostics.Mach as number).toBeGreaterThan(0);
  });

  it('should maintain Mach=1 consistency across different epsilon values', () => {
    // Test that Mach=1 is maintained regardless of epsilon when choked
    const baseInputs: ComputeInputs = {
      process: 'blowdown',
      solveFor: 'DfromT',
      V: 1e-3,
      P1: 10e5, // High pressure to ensure choking
      P2: 1e5,
      T: 293,
      L: 0.01,
      gas: GASES.air,
      Cd: 0.62,
      t: 25,
    };

    const epsilonValues = [0.001, 0.01, 0.05, 0.1];
    
    epsilonValues.forEach(epsilon => {
      const inputs = { ...baseInputs, epsilon };
      const result = computeDfromT(inputs);
      
      console.log(`Epsilon: ${epsilon}, Choked: ${result.diagnostics.choked}, Mach: ${result.diagnostics.Mach}`);
      
      if (result.diagnostics.choked) {
        expect(result.diagnostics.Mach).toBe(1.0);
      }
    });
  });

  it('should provide correct throat properties when choked', () => {
    // Test that throat properties are correctly calculated for choked flow
    const inputs: ComputeInputs = {
      process: 'blowdown',
      solveFor: 'DfromT',
      V: 1e-3,
      P1: 8e5,
      P2: 1e5,
      T: 293,
      L: 0.01,
      gas: GASES.air,
      Cd: 0.62,
      epsilon: 0.01,
      t: 30,
    };

    const result = computeDfromT(inputs);
    
    if (result.diagnostics.choked) {
      console.log('Throat properties for choked flow:');
      console.log(`  Mach: ${result.diagnostics.Mach}`);
      console.log(`  Throat velocity: ${result.diagnostics.throat_velocity} m/s`);
      console.log(`  Throat density: ${result.diagnostics.throat_density} kg/m³`);
      
      expect(result.diagnostics.Mach).toBe(1.0);
      expect(result.diagnostics.throat_velocity).toBeDefined();
      expect(result.diagnostics.throat_density).toBeDefined();
      
      const throatVel = result.diagnostics.throat_velocity as number;
      const throatDens = result.diagnostics.throat_density as number;
      
      expect(throatVel).toBeGreaterThan(0);
      expect(Number.isFinite(throatVel)).toBe(true);
      expect(throatDens).toBeGreaterThan(0);
      expect(Number.isFinite(throatDens)).toBe(true);
      
      // Throat velocity should be sonic velocity at throat conditions
      const gamma = inputs.gas.gamma;
      const R = inputs.gas.R;
      const T_throat = inputs.T * 2 / (gamma + 1);
      const a_throat = Math.sqrt(gamma * R * T_throat);
      
      expect(Math.abs(throatVel - a_throat)).toBeLessThan(0.01);
      console.log(`  Expected sonic velocity: ${a_throat.toFixed(1)} m/s`);
      console.log(`  ✓ Throat velocity matches sonic velocity`);
    }
  });
});