/**
 * Tests de validation du pipeline Filling - Verrouillage du chemin complet
 * 4 tests critiques pour garantir le bon fonctionnement en mode Filling
 */

import { describe, it, expect } from 'vitest';
import { buildSI } from '@/lib/build-si';
import { timeOrificeFillingFromAreaSI, diameterFromTime_Filling } from '@/lib/physics-wrappers';
import { computeDfromT, GASES } from '@/lib/physics';

describe('Filling Pipeline Validation - Verrouillage', () => {
  
  /**
   * Test 1: buildSI Filling (gauge) - Conversions de pressions correctes
   */
  it('1) buildSI Filling gauge: 4L/15°C/P1g=0/Pfg=600/Psg=1200 → P1≈101325, Pf≈701325, Ps≈1301325 Pa', () => {
    const uiValues = {
      process: 'filling',
      
      // Volume: 4 L
      V: { value: 4, unit: 'liter' },
      
      // Temperature: 15°C
      T: { value: 15, unit: 'C' },
      
      // Pressures en mode gauge
      pressureInputMode: 'gauge',
      P1: { value: 0, unit: 'kPa' },      // Initial = 0 kPag
      P2: { value: 600, unit: 'kPa' },    // Target = 600 kPag  
      Ps: { value: 1200, unit: 'kPa' },   // Supply = 1200 kPag
      
      // Atmospheric pressure standard
      patmMode: 'standard',
      
      // Other inputs
      L: { value: 60, unit: 'mm' },
      gas: GASES.CH4,
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal'
    };

    const SI = buildSI(uiValues);

    // Vérifications des pressions absolues (Patm standard = 101325 Pa)
    expect(SI.P1_Pa).toBeCloseTo(101325, -2); // 0 kPag + 101.325 kPa = 101325 Pa
    expect(SI.Pf_Pa).toBeCloseTo(701325, -2); // 600 kPag + 101.325 kPa = 701325 Pa  
    expect(SI.Ps_Pa).toBeCloseTo(1301325, -2); // 1200 kPag + 101.325 kPa = 1301325 Pa
    
    // Vérifications complémentaires
    expect(SI.V_SI_m3).toBeCloseTo(0.004, 6); // 4 L = 0.004 m³
    expect(SI.T_K).toBeCloseTo(288.15, 2); // 15°C = 288.15 K
    expect(SI.L_SI_m).toBeCloseTo(0.060, 3); // 60 mm = 0.060 m
    
    console.log('✅ Test 1 - buildSI Filling conversions:', {
      P1_Pa: SI.P1_Pa,
      Pf_Pa: SI.Pf_Pa, 
      Ps_Pa: SI.Ps_Pa
    });
  });

  /**
   * Test 2: Forward Filling - Temps calculé avec aire donnée
   */
  it('2) forward Filling: A=6.6e-8 m² (D~0.29mm) → t_fwd ≈ 175s ±15%', () => {
    const SI = {
      V_SI_m3: 0.004,     // 4 L
      T_K: 288.15,        // 15°C
      P1_Pa: 101325,      // 0 kPag
      Pf_Pa: 701325,      // 600 kPag
      Ps_Pa: 1301325,     // 1200 kPag
      L_SI_m: 0.060,      // 60 mm
      gas: GASES.CH4,
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal'
    };

    const A_test = 6.6e-8; // m² (correspond à D ≈ 0.29 mm)
    const D_expected = Math.sqrt(4 * A_test / Math.PI) * 1000; // en mm
    
    const t_fwd = timeOrificeFillingFromAreaSI(SI, A_test);
    
    // Vérifications
    expect(Number.isFinite(t_fwd)).toBe(true);
    expect(t_fwd).toBeGreaterThan(0);
    
    // Tolérance ±15% autour de 175s
    const t_target = 175;
    const tolerance = 0.15;
    const t_min = t_target * (1 - tolerance); // 148.75s
    const t_max = t_target * (1 + tolerance); // 201.25s
    
    expect(t_fwd).toBeGreaterThanOrEqual(t_min);
    expect(t_fwd).toBeLessThanOrEqual(t_max);
    
    console.log('✅ Test 2 - Forward Filling:', {
      A_m2: A_test,
      D_mm: D_expected.toFixed(2),
      t_fwd_s: t_fwd.toFixed(1),
      target_s: t_target,
      tolerance_percent: (tolerance * 100)
    });
  });

  /**
   * Test 3: Inverse D-from-t Filling - Diamètre calculé avec temps cible
   */
  it('3) inverse D-from-t Filling: t_target=175s → D∈[0.25,0.35]mm, residual≤0.03, iter≥1, A*≠borne', () => {
    const SI = {
      V_SI_m3: 0.004,     // 4 L
      T_K: 288.15,        // 15°C  
      P1_Pa: 101325,      // 0 kPag
      Pf_Pa: 701325,      // 600 kPag
      Ps_Pa: 1301325,     // 1200 kPag
      L_SI_m: 0.060,      // 60 mm
      gas: GASES.CH4,
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal'
    };

    const t_target = 175; // secondes
    
    const result = diameterFromTime_Filling(SI, t_target);
    
    // Vérifications principales
    expect(result.D_SI).toBeDefined();
    expect(Number.isFinite(result.D_SI)).toBe(true);
    expect(result.D_SI).toBeGreaterThan(0);
    
    // Diamètre en mm dans la plage attendue [0.25, 0.35] mm
    const D_mm = result.D_SI * 1000;
    expect(D_mm).toBeGreaterThanOrEqual(0.25);
    expect(D_mm).toBeLessThanOrEqual(0.35);
    
    // Résiduel ≤ 3%
    expect(result.residual).toBeLessThanOrEqual(0.03);
    
    // Au moins 1 itération  
    expect(result.debugNote.iterations).toBeGreaterThanOrEqual(1);
    
    // A* ne doit pas être une borne (vérification anti-boundary)
    const A_solution = result.A_SI;
    const A_lo = result.debugNote.A_lo;
    const A_hi = result.debugNote.A_hi;
    const boundaryTolerance = 1e-10;
    
    expect(Math.abs(A_solution - A_lo)).toBeGreaterThan(boundaryTolerance);
    expect(Math.abs(A_solution - A_hi)).toBeGreaterThan(boundaryTolerance);
    
    console.log('✅ Test 3 - Inverse D-from-t Filling:', {
      t_target_s: t_target,
      D_mm: D_mm.toFixed(3),
      residual_percent: (result.residual * 100).toFixed(2),
      iterations: result.debugNote.iterations,
      A_solution_m2: A_solution.toExponential(2),
      A_bounds: `[${A_lo.toExponential(2)}, ${A_hi.toExponential(2)}]`
    });
  });

  /**
   * Test 4: Capillary Safety - Pipeline orifice continue malgré échec capillaire
   */
  it('4) capillary safety: forcer capillaire fail → pipeline orifice continue, warning capturé', () => {
    const inputs = {
      process: 'filling' as const,
      solveFor: 'DfromT' as const,
      V: 0.004,           // 4 L  
      P1: 101325,         // 0 kPag abs
      P2: 701325,         // 600 kPag abs (target)
      T: 288.15,          // 15°C
      L: 0.060,           // 60 mm
      gas: GASES.CH4,
      Cd: 0.62,
      epsilon: 0.01,
      regime: 'isothermal' as const,
      Ps: 1301325,        // 1200 kPag abs (supply)
      t: 175,             // Target time
      modelSelection: 'orifice' as const // Force orifice model
    };

    // Le calcul doit réussir même si capillaire échoue
    let result: any;
    let caughtError: any = null;
    
    try {
      result = computeDfromT(inputs);
    } catch (error) {
      caughtError = error;
    }

    // Le pipeline ne doit PAS échouer quand orifice est forcé
    expect(caughtError).toBeNull();
    expect(result).toBeDefined();
    expect(result.D).toBeDefined();
    expect(Number.isFinite(result.D)).toBe(true);
    expect(result.D).toBeGreaterThan(0);
    
    // Vérification du diamètre dans une plage raisonnable  
    const D_mm = result.D * 1000;
    expect(D_mm).toBeGreaterThan(0.1); // > 0.1 mm
    expect(D_mm).toBeLessThan(1.0);    // < 1.0 mm
    
    // Vérifier que des warnings sont présents (capillaire a échoué)
    expect(result.warnings).toBeDefined();
    expect(Array.isArray(result.warnings)).toBe(true);
    
    // Chercher un warning lié au capillaire  
    const hasCapillaryWarning = result.warnings.some((w: string) => 
      w.toLowerCase().includes('capillary') || w.toLowerCase().includes('warning')
    );
    expect(hasCapillaryWarning).toBe(true);
    
    console.log('✅ Test 4 - Capillary Safety:', {
      D_mm: D_mm.toFixed(3),
      verdict: result.verdict,
      warnings_count: result.warnings?.length || 0,
      has_capillary_warning: hasCapillaryWarning,
      sample_warning: result.warnings?.[0] || 'none'
    });
  });

  /**
   * Test intégration complète - Bout en bout
   */
  it('Integration: UI → buildSI → timeOrificeFillingFromAreaSI → diameterFromTime_Filling', () => {
    // 1) UI Values → SI conversion
    const uiValues = {
      process: 'filling',
      V: { value: 4, unit: 'liter' },
      T: { value: 15, unit: 'C' },
      pressureInputMode: 'gauge',
      P1: { value: 0, unit: 'kPa' },
      P2: { value: 600, unit: 'kPa' },
      Ps: { value: 1200, unit: 'kPa' },
      patmMode: 'standard',
      L: { value: 60, unit: 'mm' },
      gas: GASES.CH4
    };

    const SI = buildSI(uiValues);
    
    // 2) Forward: A → t
    const A_test = 6.6e-8;
    const t_forward = timeOrificeFillingFromAreaSI(SI, A_test);
    
    // 3) Inverse: t → D  
    const result_inverse = diameterFromTime_Filling(SI, t_forward);
    
    // 4) Vérification cohérence round-trip
    const A_recovered = result_inverse.A_SI;
    const relative_error = Math.abs(A_recovered - A_test) / A_test;
    
    expect(relative_error).toBeLessThan(0.05); // Erreur < 5%
    
    console.log('✅ Integration Test - Round-trip coherence:', {
      A_initial: A_test.toExponential(2),
      t_forward_s: t_forward.toFixed(1),
      A_recovered: A_recovered.toExponential(2),
      relative_error_percent: (relative_error * 100).toFixed(2)
    });
  });
});
