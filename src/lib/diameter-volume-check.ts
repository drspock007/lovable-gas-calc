/**
 * Utility functions for checking diameter vs vessel volume consistency
 */

export interface VolumeCheckResult {
  D_equiv_sphere_mm: number;
  D_equiv_cylinder_mm: number;
  D_equiv_used_mm: number;
  diameterRatio: number;
  isUnphysical: boolean;
  warningMessage?: string;
}

/**
 * Check if diameter is unphysically large compared to vessel volume
 * @param D_SI_m Diameter in meters
 * @param vesselVolume_m3 Vessel volume in cubic meters
 * @param vesselLength_m Optional vessel length in meters
 * @param threshold Ratio threshold for warning (default: 0.1 = 10%)
 */
export function checkDiameterVsVolume(
  D_SI_m: number,
  vesselVolume_m3: number, 
  vesselLength_m: number = 0.001,
  threshold: number = 0.1
): VolumeCheckResult {
  // Equivalent spherical diameter: D_equiv = (6V/π)^(1/3)
  const D_equiv_sphere = Math.pow(6 * vesselVolume_m3 / Math.PI, 1/3);
  
  // Equivalent cylindrical diameter: D_equiv = (4V/π/L)^(1/2)
  const D_equiv_cylinder = Math.sqrt(4 * vesselVolume_m3 / (Math.PI * vesselLength_m));
  
  // Use the smaller equivalent diameter (more conservative)
  const D_equiv = Math.min(D_equiv_sphere, D_equiv_cylinder);
  const diameterRatio = D_SI_m / D_equiv;
  
  const isUnphysical = diameterRatio > threshold;
  
  return {
    D_equiv_sphere_mm: D_equiv_sphere * 1000,
    D_equiv_cylinder_mm: D_equiv_cylinder * 1000,
    D_equiv_used_mm: D_equiv * 1000,
    diameterRatio,
    isUnphysical,
    warningMessage: isUnphysical 
      ? `Diameter (${(D_SI_m * 1000).toFixed(2)} mm) is ${(diameterRatio * 100).toFixed(1)}% of equivalent vessel diameter (${(D_equiv * 1000).toFixed(2)} mm)`
      : undefined
  };
}

/**
 * Format volume check result for debug display
 */
export function formatVolumeCheckDebug(result: VolumeCheckResult, D_SI_m: number, vesselVolume_m3: number): any {
  return {
    diameter_mm: D_SI_m * 1000,
    vesselVolume_mm3: vesselVolume_m3 * 1e9,
    equivalentDiameters: {
      sphere_mm: result.D_equiv_sphere_mm,
      cylinder_mm: result.D_equiv_cylinder_mm,
      used_mm: result.D_equiv_used_mm
    },
    diameterRatio: result.diameterRatio,
    isUnphysical: result.isUnphysical,
    warning: result.warningMessage
  };
}