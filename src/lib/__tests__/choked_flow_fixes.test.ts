import { describe, it, expect } from 'vitest';
import { computeDfromT, GASES, ComputeInputs } from '../physics';

describe('Choked Flow Fixes', () => {
  it('should set Mach = 1.0 exactly when choked=true', () => {
    // Create conditions that guarantee choked flow
    const inputs: ComputeInputs = {
      process: 'blowdown',
      solveFor: 'DfromT',
      V: 200e-9, // 200 mm³ in m³
      P1: 1200000, // 1200 kPa in Pa 
      P2: 1000, // 1 kPa in Pa
      T: 288.15, // 15°C in K
      L: 0.002, // 2 mm in m
      gas: GASES.air,
      Cd: 0.62,
      epsilon: 0.01,
      t: 175,
      regime: 'isothermal'
    };

    const result = computeDfromT(inputs);
    
    expect(result.diagnostics.choked).toBe(true);
    expect(result.diagnostics.Mach).toBe(1.0); // Exactly 1.0, not > 1
    
    // Should have throat properties when choked
    expect(result.diagnostics.throat_velocity).toBeDefined();
    expect(result.diagnostics.throat_density).toBeDefined();
    
    console.log('Choked flow test results:');
    console.log(`  Choked: ${result.diagnostics.choked}`);
    console.log(`  Mach: ${result.diagnostics.Mach}`);
    console.log(`  Throat velocity: ${result.diagnostics.throat_velocity} m/s`);
    console.log(`  Computed diameter: ${(result.D! * 1000000).toFixed(1)} μm`);
  });

  it('should have Mach < 1 when not choked', () => {
    // Create conditions for subsonic flow
    const inputs: ComputeInputs = {
      process: 'blowdown',
      solveFor: 'DfromT',
      V: 0.1, // Large volume
      P1: 110000, // Low pressure ratio
      P2: 100000,
      T: 293.15,
      L: 0.001,
      gas: GASES.air,
      Cd: 0.62,
      epsilon: 0.01,
      t: 10,
      regime: 'isothermal'
    };

    const result = computeDfromT(inputs);
    
    expect(result.diagnostics.choked).toBe(false);
    expect(result.diagnostics.Mach).toBeLessThan(1.0);
    expect(result.diagnostics.Mach).toBeGreaterThan(0);
    
    // Should not have throat properties when not choked
    expect(result.diagnostics.throat_velocity).toBeUndefined();
    expect(result.diagnostics.throat_density).toBeUndefined();
    
    console.log('Subsonic flow test results:');
    console.log(`  Choked: ${result.diagnostics.choked}`);
    console.log(`  Mach: ${result.diagnostics.Mach}`);
  });

  it('should handle mm³ volumes correctly', () => {
    // Test the specific case from regression test
    const inputs: ComputeInputs = {
      process: 'blowdown',
      solveFor: 'DfromT',
      V: 200e-9, // 200 mm³
      P1: 1200000, // 1200 kPa
      P2: 1000, // 1 kPa  
      T: 288.15, // 15°C
      L: 0.002, // 2 mm
      gas: GASES.air,
      Cd: 0.62,
      epsilon: 0.01,
      t: 175,
      regime: 'isothermal'
    };

    const result = computeDfromT(inputs);
    
    expect(result.D).toBeDefined();
    expect(result.D!).toBeGreaterThan(1e-6); // > 1 μm
    expect(result.D!).toBeLessThan(1e-4);   // < 100 μm
    
    console.log('mm³ volume test results:');
    console.log(`  Volume: ${inputs.V * 1e9} mm³`);
    console.log(`  Computed diameter: ${(result.D! * 1000000).toFixed(1)} μm`);
    console.log(`  Model: ${result.verdict}`);
  });
});