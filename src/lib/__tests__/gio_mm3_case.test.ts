import { describe, test, expect } from 'vitest';
import { toSI_Volume, fromSI_Volume } from '../units';
import { computeDfromT, GASES } from '../physics';
import type { ComputeInputs } from '../physics';

describe('Gio mm³ Case Tests', () => {
  
  test('volume_mm3_roundtrip: 200 mm³ -> 2e-7 m³ -> 200 mm³', () => {
    // Test the round-trip conversion for mm³
    const originalVolume = 200; // mm³
    
    // Convert to SI (m³)
    const volumeSI = toSI_Volume(originalVolume, 'mm3');
    expect(volumeSI).toBeCloseTo(2e-7, 10); // Should be exactly 2e-7 m³
    
    // Convert back to mm³
    const volumeBack = fromSI_Volume(volumeSI, 'mm3');
    expect(volumeBack).toBeCloseTo(originalVolume, 6); // Should be exactly 200 mm³
    
    // Explicit assertion for the expected value
    expect(volumeSI).toBe(200 * 1e-9); // 200 * 1e-9 = 2e-7
  });

  test('gio_mm3_case: micrometric diameter expectations and residual check', () => {
    // Gio's test case parameters
    const inputs: ComputeInputs = {
      process: 'blowdown',
      solveFor: 'DfromT',
      V: 200 * 1e-9,      // 200 mm³ in m³ (2e-7 m³)
      P1: 1200 * 1000,    // 1200 kPa in Pa
      P2: 1 * 1000,       // 1 kPa in Pa  
      T: 15 + 273.15,     // 15°C in K
      L: 2 * 1e-3,        // 2 mm in m
      t: 175,             // 175 seconds
      gas: GASES.air,
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal'
    };

    // Calculate sphere-equivalent diameter for sanity check
    const D_eq = Math.pow(6 * inputs.V / Math.PI, 1/3);
    
    // Run the computation
    const result = computeDfromT(inputs);
    
    // Should have a valid diameter result
    expect(result.D).toBeDefined();
    expect(result.D).not.toBeNull();
    
    const D = result.D!;
    
    // Expect micrometric diameter: 1e-6 m < D < 1e-4 m (1 μm to 100 μm)
    expect(D).toBeGreaterThan(1e-6); // > 1 μm
    expect(D).toBeLessThan(1e-4);    // < 100 μm
    
    // Diameter should not exceed the tank's equivalent sphere diameter
    expect(D).toBeLessThanOrEqual(D_eq);
    
    // Check residual if t_check is available in diagnostics
    if (result.diagnostics.t_check && typeof result.diagnostics.t_check === 'number') {
      const t_check = result.diagnostics.t_check as number;
      const residualError = Math.abs(t_check - inputs.t!) / inputs.t!;
      
      // Residual check: |t_check - 175|/175 < 2%
      expect(residualError).toBeLessThan(0.02); // < 2%
    }
    
    // Log results for debugging (will appear in test output)
    console.log(`Gio mm³ case results:`);
    console.log(`  Volume: ${(inputs.V * 1e9).toFixed(0)} mm³`);
    console.log(`  Computed diameter: ${(D * 1e6).toFixed(1)} μm`);
    console.log(`  D_eq (sphere): ${(D_eq * 1e6).toFixed(1)} μm`);
    console.log(`  D/D_eq ratio: ${(D/D_eq).toFixed(3)}`);
    console.log(`  Verdict: ${result.verdict}`);
    
    if (result.diagnostics.t_check && typeof result.diagnostics.t_check === 'number') {
      const t_check = result.diagnostics.t_check as number;
      console.log(`  t_check: ${t_check.toFixed(1)} s (target: ${inputs.t} s)`);
      console.log(`  Residual error: ${((Math.abs(t_check - inputs.t!) / inputs.t!) * 100).toFixed(2)}%`);
    }
  });

  test('volume unit conversion assertions', () => {
    // Additional unit conversion tests for confidence
    
    // 1 mm³ = 1e-9 m³
    expect(toSI_Volume(1, 'mm3')).toBe(1e-9);
    
    // 1000 mm³ = 1e-6 m³ = 0.001 L
    expect(toSI_Volume(1000, 'mm3')).toBe(1e-6);
    expect(toSI_Volume(0.001, 'L')).toBe(1e-6);
    
    // Verify the constant used in physics
    const testVolume = 1; // mm³
    const volumeSI = toSI_Volume(testVolume, 'mm3');
    
    // This should match the constant used in the physics calculations
    expect(volumeSI).toBe(1e-9); // Assert exactly 1e-9, not approximately
  });
});