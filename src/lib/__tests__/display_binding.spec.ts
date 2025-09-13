import { describe, it, expect } from 'vitest';
import { formatLength, toSI_Length, LengthUnit } from '../length-units';

describe('Display Unit Binding', () => {
  it('should properly convert D_SI=8.77e-6 m to mm without dev chip trigger', () => {
    const D_SI_m = 8.77e-6; // meters
    const userUnit: LengthUnit = 'mm';
    
    // Format SI value to user unit
    const displayValue = formatLength(D_SI_m, userUnit);
    
    // Should show approximately 0.00877 mm
    expect(displayValue).toBeCloseTo(0.00877, 5);
    
    // Convert back to SI to check round-trip accuracy
    const backToSI = toSI_Length(displayValue, userUnit);
    
    // Calculate percentage difference
    const percentDiff = Math.abs((backToSI - D_SI_m) / D_SI_m) * 100;
    
    // Should be well under 0.5% (no dev chip trigger)
    expect(percentDiff).toBeLessThan(0.5);
    
    console.log(`Display Binding Test:`);
    console.log(`  D_SI_m = ${D_SI_m.toExponential(3)} m`);
    console.log(`  Display = ${displayValue.toFixed(5)} mm`);
    console.log(`  Back to SI = ${backToSI.toExponential(3)} m`);
    console.log(`  Round-trip error = ${percentDiff.toFixed(3)}% (should be < 0.5%)`);
  });

  it('should test various unit conversions for precision', () => {
    const testCases = [
      { D_SI_m: 1.234e-6, unit: 'mm' as LengthUnit, expectedApprox: 0.001234 },
      { D_SI_m: 5.67e-5, unit: 'mm' as LengthUnit, expectedApprox: 0.0567 },
      { D_SI_m: 8.9e-4, unit: 'mm' as LengthUnit, expectedApprox: 0.89 },
      { D_SI_m: 1.23e-6, unit: 'μm' as LengthUnit, expectedApprox: 1.23 },
      { D_SI_m: 4.56e-5, unit: 'μm' as LengthUnit, expectedApprox: 45.6 },
      { D_SI_m: 7.89e-3, unit: 'm' as LengthUnit, expectedApprox: 0.00789 },
    ];

    testCases.forEach(({ D_SI_m, unit, expectedApprox }) => {
      const displayValue = formatLength(D_SI_m, unit);
      const backToSI = toSI_Length(displayValue, unit);
      const percentDiff = Math.abs((backToSI - D_SI_m) / D_SI_m) * 100;
      
      // Display value should be close to expected
      expect(displayValue).toBeCloseTo(expectedApprox, 4);
      
      // Round-trip error should be minimal (< 0.1%)
      expect(percentDiff).toBeLessThan(0.1);
      
      console.log(`  ${D_SI_m.toExponential(2)} m → ${displayValue.toFixed(6)} ${unit} → ${backToSI.toExponential(2)} m (${percentDiff.toFixed(3)}%)`);
    });
  });

  it('should detect when dev chip should be triggered', () => {
    // Simulate a case where precision loss might trigger dev chip
    const D_SI_m = 1.2345678901234e-6; // High precision value
    const userUnit: LengthUnit = 'mm';
    
    // Format with limited precision (simulate UI rounding)
    const displayValue = parseFloat(formatLength(D_SI_m, userUnit).toFixed(3)); // Truncate to 3 decimals
    const backToSI = toSI_Length(displayValue, userUnit);
    const percentDiff = Math.abs((backToSI - D_SI_m) / D_SI_m) * 100;
    
    console.log(`Dev Chip Test:`);
    console.log(`  Original D_SI_m = ${D_SI_m.toExponential(6)} m`);
    console.log(`  Truncated display = ${displayValue.toFixed(3)} mm`);
    console.log(`  Back to SI = ${backToSI.toExponential(6)} m`);
    console.log(`  Precision loss = ${percentDiff.toFixed(3)}%`);
    
    // This test documents the behavior - chip appears when precision loss > 0.5%
    if (percentDiff > 0.5) {
      console.log(`  → Dev chip would be shown`);
    } else {
      console.log(`  → No dev chip needed`);
    }
  });

  it('should handle edge cases and extreme values', () => {
    const edgeCases = [
      { D_SI_m: 1e-12, unit: 'μm' as LengthUnit }, // Very small
      { D_SI_m: 1e-3, unit: 'mm' as LengthUnit },  // Typical small
      { D_SI_m: 1e-1, unit: 'm' as LengthUnit },   // Large
    ];

    edgeCases.forEach(({ D_SI_m, unit }) => {
      const displayValue = formatLength(D_SI_m, unit);
      const backToSI = toSI_Length(displayValue, unit);
      const percentDiff = Math.abs((backToSI - D_SI_m) / D_SI_m) * 100;
      
      // Basic sanity checks
      expect(displayValue).toBeGreaterThan(0);
      expect(backToSI).toBeGreaterThan(0);
      expect(percentDiff).toBeLessThan(10); // Should not have huge errors
      
      console.log(`Edge case: ${D_SI_m.toExponential(2)} m → ${displayValue.toExponential(3)} ${unit} (${percentDiff.toFixed(2)}%)`);
    });
  });
});