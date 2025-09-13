import { describe, it, expect } from 'vitest';
import { formatLength } from '../length-units';

describe('formatLength', () => {
  it('should format D_SI = 9.314425e-6 m to mm with 3 sig figs as 0.00931', () => {
    const D_SI = 9.314425e-6; // meters
    const result = formatLength(D_SI, 'mm', 3);
    expect(result).toBe(0.00931);
  });

  it('should calculate L/D correctly for D_SI = 1.3889e-5 m and L = 0.002 m', () => {
    const D_SI = 1.3889e-5; // meters
    const L_SI = 0.002; // meters
    const LD_ratio = L_SI / D_SI;
    expect(LD_ratio).toBeCloseTo(144, 0); // ≈ 144
  });

  it('should format D_SI = 1.3889e-5 m to mm with proper precision', () => {
    const D_SI = 1.3889e-5; // meters
    const result = formatLength(D_SI, 'mm', 3);
    expect(result).toBe(0.0139); // 13.9 μm = 0.0139 mm
  });

  it('should handle edge cases', () => {
    expect(formatLength(0, 'mm', 3)).toBe(0);
    expect(formatLength(Infinity, 'mm', 3)).toBeNaN();
    expect(formatLength(-Infinity, 'mm', 3)).toBeNaN();
    expect(formatLength(NaN, 'mm', 3)).toBeNaN();
  });

  it('should format different units correctly', () => {
    const value_SI = 0.001; // 1 mm in SI (meters)
    
    expect(formatLength(value_SI, 'm', 3)).toBe(0.001);
    expect(formatLength(value_SI, 'cm', 3)).toBe(0.1);
    expect(formatLength(value_SI, 'mm', 3)).toBe(1);
  });
});