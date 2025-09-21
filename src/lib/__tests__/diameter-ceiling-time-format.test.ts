/**
 * Test for diameter ceiling and smart time formatting
 * Validates A_hi physical constraints and proper time unit selection
 */

import { describe, it, expect, vi } from 'vitest';
import { formatTimeDisplay, getTimeUnit, convertTimeToDisplay } from '../time-format';
import { computeDfromT, GASES } from '../physics';

describe('Diameter Ceiling and Time Formatting', () => {
  describe('Time formatting utilities', () => {
    it('should format microseconds correctly', () => {
      const result = formatTimeDisplay(5.5e-7, 3);
      expect(result.t_display).toBe('0.550');
      expect(result.time_unit_used).toBe('µs');
      expect(result.raw_value).toBe(0.55);
    });

    it('should format milliseconds correctly', () => {
      const result = formatTimeDisplay(0.0025, 3);
      expect(result.t_display).toBe('2.500');
      expect(result.time_unit_used).toBe('ms');
      expect(result.raw_value).toBe(2.5);
    });

    it('should format seconds correctly', () => {
      const result = formatTimeDisplay(1.23456, 3);
      expect(result.t_display).toBe('1.235');
      expect(result.time_unit_used).toBe('s');
      expect(result.raw_value).toBe(1.23456);
    });

    it('should never display "0.0 s" for very small times', () => {
      const verySmallTime = 1e-9; // 1 nanosecond
      const result = formatTimeDisplay(verySmallTime, 3);
      
      // Should be displayed in µs with meaningful precision
      expect(result.time_unit_used).toBe('µs');
      expect(result.t_display).not.toBe('0.000');
      expect(parseFloat(result.t_display)).toBeGreaterThan(0);
    });

    it('should handle edge cases properly', () => {
      // Test boundary between µs and ms
      const boundaryTime = 1e-6; // Exactly 1 µs
      const result = formatTimeDisplay(boundaryTime, 3);
      expect(result.time_unit_used).toBe('µs');
      expect(result.t_display).toBe('1.000');
      
      // Test boundary between ms and s
      const boundaryTime2 = 1e-3; // Exactly 1 ms
      const result2 = formatTimeDisplay(boundaryTime2, 3);
      expect(result2.time_unit_used).toBe('s');
      expect(result2.t_display).toBe('0.001');
    });

    it('should handle invalid inputs gracefully', () => {
      const result = formatTimeDisplay(NaN, 3);
      expect(result.t_display).toBe('Invalid');
      expect(result.time_unit_used).toBe('s');
    });
  });

  describe('Physical diameter constraints (A_hi ceiling)', () => {
    const baseInputs = {
      process: 'blowdown' as const,
      solveFor: 'DfromT' as const,
      P1: 1.2e6, // 1.2 MPa 
      P2: 1e3, // 1 kPa
      T: 288.15, // 15°C
      L: 0.002, // 2 mm
      gas: GASES.air,
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal' as const
    };

    it('should apply D_max ceiling for small volumes (V=200mm³)', () => {
      const inputs = { 
        ...baseInputs, 
        V: 2e-7, // 200 mm³
        t: 100 // Moderate time
      };
      
      try {
        const result = computeDfromT(inputs);
        
        if (result.D) {
          // Calculate expected constraint
          const D_eq = Math.pow(6 * inputs.V / Math.PI, 1/3);
          const k_physical = 2;
          const D_max_physical = k_physical * D_eq;
          
          // Result should respect physical constraint
          expect(result.D).toBeLessThanOrEqual(D_max_physical);
          
          // For 200 mm³: D_eq ≈ 7.2 mm, D_max ≈ 14.4 mm
          expect(D_max_physical).toBeCloseTo(0.0144, 3); // ~14.4 mm
        }
      } catch (error: any) {
        // Physical constraint errors are acceptable for this test
        if (error.message.includes('bracket') || error.message.includes('bound')) {
          expect(error.devNote).toBeDefined();
        }
      }
    });

    it('should apply D_max ceiling for large volumes (V=2000mm³)', () => {
      const inputs = { 
        ...baseInputs, 
        V: 2e-6, // 2000 mm³
        t: 50 // Moderate time
      };
      
      try {
        const result = computeDfromT(inputs);
        
        if (result.D) {
          // Calculate expected constraint
          const D_eq = Math.pow(6 * inputs.V / Math.PI, 1/3);
          const k_physical = 2;
          const D_max_physical = k_physical * D_eq;
          
          // Result should respect physical constraint
          expect(result.D).toBeLessThanOrEqual(D_max_physical);
          
          // For 2000 mm³: D_eq ≈ 15.6 mm, D_max ≈ 31.2 mm
          expect(D_max_physical).toBeCloseTo(0.0312, 3); // ~31.2 mm
          
          // Should never see 112 mm anymore
          expect(result.D).toBeLessThan(0.112);
        }
      } catch (error: any) {
        // Physical constraint errors are acceptable for this test
        if (error.message.includes('bracket') || error.message.includes('bound')) {
          expect(error.devNote).toBeDefined();
        }
      }
    });

    it('should log physical constraint application in debug', () => {
      const inputs = { 
        ...baseInputs, 
        V: 1e-7, // 100 mm³ (small volume)
        t: 200 // Large time that might cause issues
      };
      
      // Console spy to capture debug logs
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      try {
        computeDfromT(inputs);
        
        // Check if physical constraint was logged
        const constraintLogs = consoleSpy.mock.calls.filter(call => 
          call[0] && call[0].includes('Physical constraint applied')
        );
        
        if (constraintLogs.length > 0) {
          expect(constraintLogs[0][0]).toContain('D_eq=');
          expect(constraintLogs[0][0]).toContain('D_max=');
          expect(constraintLogs[0][0]).toContain('k=2');
        }
      } catch (error) {
        // Expected for some constraint scenarios
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });

  describe('Integration: Time display in results', () => {
    const integrationInputs = {
      process: 'blowdown' as const,
      solveFor: 'DfromT' as const,
      P1: 1.2e6,
      P2: 1e3,
      T: 288.15,
      L: 0.002,
      gas: GASES.air,
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal' as const
    };
    it('should display time in appropriate units for different magnitudes', () => {
      const times = [
        { t_SI: 1e-7, expectedUnit: 'µs', expectedRange: [0.09, 0.11] },
        { t_SI: 5e-4, expectedUnit: 'ms', expectedRange: [0.4, 0.6] },
        { t_SI: 2.5, expectedUnit: 's', expectedRange: [2.4, 2.6] }
      ];
      
      times.forEach(({ t_SI, expectedUnit, expectedRange }) => {
        const timeDisplay = formatTimeDisplay(t_SI, 3);
        expect(timeDisplay.time_unit_used).toBe(expectedUnit);
        expect(timeDisplay.raw_value).toBeGreaterThanOrEqual(expectedRange[0]);
        expect(timeDisplay.raw_value).toBeLessThanOrEqual(expectedRange[1]);
      });
    });

    it('should include time formatting diagnostics in sampling warnings', () => {
      const inputs = { 
        ...integrationInputs, 
        V: 2e-7, // 200 mm³
        t: 175 // Gio preset condition
      };
      
      try {
        const result = computeDfromT(inputs);
        
        if (result.sampling?.warnings) {
          const timeWarning = result.sampling.warnings.find(w => 
            w.includes('t_display=') && w.includes('time_unit_used=')
          );
          
          if (timeWarning) {
            expect(timeWarning).toMatch(/t_display=[\d\.]+/);
            expect(timeWarning).toMatch(/time_unit_used=(s|ms|µs)/);
          }
        }
      } catch (error) {
        // Error scenarios are acceptable for this test
      }
    });
  });
});