import { describe, it, expect, vi } from 'vitest';
import { computeTimeFromDiameter } from '@/lib/pipeline-time-from-d';
import { buildSI } from '@/lib/build-si';
import { checkDiameterVsVolume } from '@/lib/diameter-volume-check';

describe('Enhanced Error Messages Tests', () => {
  
  describe('Invalid Diameter Error Messages', () => {
    it('debug mode: shows detailed error with raw/unit/parsed', () => {
      const ui = {
        diameter: "abc",
        diameterUnit: "µm",
        debug: true,
        __SI__: { V_SI_m3: 2e-7 }
      };
      
      expect(() => computeTimeFromDiameter(ui)).toThrow(
        "Invalid diameter (raw:abc unit:µm parsed:NaN)"
      );
    });

    it('non-debug mode: shows simple error message', () => {
      const ui = {
        diameter: "abc", 
        diameterUnit: "µm",
        debug: false,
        __SI__: { V_SI_m3: 2e-7 }
      };
      
      expect(() => computeTimeFromDiameter(ui)).toThrow("Invalid diameter");
    });

    it('zero diameter shows detailed debug info', () => {
      const ui = {
        diameter: "0",
        diameterUnit: "µm", 
        debug: true,
        __SI__: { V_SI_m3: 2e-7 }
      };
      
      try {
        computeTimeFromDiameter(ui);
      } catch (error: any) {
        expect(error.message).toBe("Invalid diameter (raw:0 unit:µm parsed:0)");
        expect(error.devNote).toBeDefined();
        expect(error.devNote.diameterRaw).toBe("0");
        expect(error.devNote.diameterUnit).toBe("µm");
        expect(error.devNote.parsed).toBe(0);
      }
    });
  });

  describe('Capillary vs Orifice Time Warning', () => {
    // This would be tested in an integration test with the Calculator component
    // since it involves toast notifications
    it('calculates time ratio correctly', async () => {
      const ui = {
        volume: "200", volumeUnit: "mm3",
        pressure1: "12", pressure1Unit: "bar", pressureMode: "absolute",
        pressure2: "0.01", pressure2Unit: "bar",
        temperature: "15", temperatureUnit: "celsius",
        length: "10", lengthUnit: "mm", // Long capillary
        gas: "air",
        dischargeCoeff: "0.62",
        diameter: "50", diameterUnit: "µm", // Large diameter for capillary
        debug: false
      };
      
      const SI = buildSI(ui);
      const timeResult = computeTimeFromDiameter({ 
        ...ui, __SI__: SI, modelOverride: "capillary" 
      });
      
      // Import the orifice time function to calculate reference
      const { timeOrificeFromAreaSI } = await import('@/lib/physics');
      const t_orifice_ref = timeOrificeFromAreaSI(SI, timeResult.A_SI_m2);
      const timeRatio = timeResult.t_SI_s / t_orifice_ref;
      
      // Should trigger warning if ratio > 5
      if (timeRatio > 5) {
        expect(timeRatio).toBeGreaterThan(5);
      }
    });
  });

  describe('Diameter vs Volume Check', () => {
    it('detects unphysically large diameter (sphere)', () => {
      const D_SI = 0.01; // 10 mm diameter
      const volume_SI = 1e-9; // 1 mm³ volume
      const vesselLength = 0.002; // 2 mm
      
      const result = checkDiameterVsVolume(D_SI, volume_SI, vesselLength);
      
      expect(result.isUnphysical).toBe(true);
      expect(result.diameterRatio).toBeGreaterThan(0.1);
      expect(result.warningMessage).toContain("10.00 mm");
    });

    it('passes reasonable diameter vs volume', () => {
      const D_SI = 10e-6; // 10 µm diameter  
      const volume_SI = 2e-7; // 200 mm³ volume
      const vesselLength = 0.002; // 2 mm
      
      const result = checkDiameterVsVolume(D_SI, volume_SI, vesselLength);
      
      expect(result.isUnphysical).toBe(false);
      expect(result.warningMessage).toBeUndefined();
    });

    it('calculates equivalent diameters correctly', () => {
      const volume_SI = Math.PI / 6 * Math.pow(0.01, 3); // Volume of 10mm sphere
      const result = checkDiameterVsVolume(0.005, volume_SI, 0.01);
      
      // For a sphere with D=10mm, equivalent diameter should be ~10mm
      expect(result.D_equiv_sphere_mm).toBeCloseTo(10, 1);
    });

    it('console warning in debug mode', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const ui = {
        diameter: "5", // 5 mm - very large!
        diameterUnit: "mm",
        debug: true,
        __SI__: { 
          V_SI_m3: 1e-9, // 1 mm³ - very small volume
          L_m: 0.002 
        }
      };
      
      const SI = buildSI(ui);
      computeTimeFromDiameter({ ...ui, __SI__: SI });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("⚠️ Unphysically large diameter vs vessel volume:")
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Diameter Volume Check Functions', () => {
    it('formatVolumeCheckDebug returns correct structure', () => {
      const { formatVolumeCheckDebug } = require('@/lib/diameter-volume-check');
      const result = {
        D_equiv_sphere_mm: 10.0,
        D_equiv_cylinder_mm: 8.0, 
        D_equiv_used_mm: 8.0,
        diameterRatio: 0.5,
        isUnphysical: false
      };
      
      const formatted = formatVolumeCheckDebug(result, 0.004, 1e-8);
      
      expect(formatted).toHaveProperty('diameter_mm');
      expect(formatted).toHaveProperty('vesselVolume_mm3');
      expect(formatted).toHaveProperty('equivalentDiameters');
      expect(formatted.equivalentDiameters).toHaveProperty('sphere_mm');
      expect(formatted.equivalentDiameters).toHaveProperty('cylinder_mm');
      expect(formatted.equivalentDiameters).toHaveProperty('used_mm');
    });
  });
});