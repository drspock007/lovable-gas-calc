import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ModeSelector, ProcessType, SolveForType, ModelSelectionType } from '@/components/ModeSelector';
import { InputsCard, InputValues } from '@/components/InputsCard';
import { ResultsCard } from '@/components/ResultsCard';
import { ResultsTimeFromD } from '@/components/ResultsTimeFromD';
import { ExplainCard } from '@/components/ExplainCard';
import { ExamplePresets } from '@/components/ExamplePresets';
import { StickyBottomBar } from '@/components/StickyBottomBar';
import { SafetyFooter } from '@/components/SafetyFooter';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { PWAUpdateManager } from '@/components/PWAUpdateManager';
import { PWAInstructions, LighthousePWAScore } from '@/components/PWAInstructions';
import SEOHead from '@/components/SEOHead';
import { useI18n } from '@/i18n/context';
import { deserializeInputsFromURL } from '@/lib/export';
import { 
  computeDfromT, 
  computeTfromD, 
  ComputeOutputs, 
  GASES, 
  ComputeInputs,
  BracketError,
  IntegralError,
  solveOrificeDfromTWithRetry
} from '@/lib/physics';
import { computeTimeFromD } from '@/actions/compute-time-from-d';
import { 
  pressureToSI, 
  volumeToSI, 
  temperatureToSI, 
  lengthToSI, 
  timeToSI 
} from '@/lib/units';
import { PressureUnit, toSI_Pressure, absFromGauge, gaugeFromAbs, patmFromAltitude, clampAbs } from '@/lib/pressure-units';
import { Calculator as CalculatorIcon, Zap } from 'lucide-react';
import { DebugPanel } from '@/components/DebugPanel';

export const Calculator: React.FC = () => {
  const { t, language, setLanguage } = useI18n();
  const { toast } = useToast();
  
  const [process, setProcess] = useState<ProcessType>('blowdown');
  const [solveFor, setSolveFor] = useState<SolveForType>('DfromT');
  const [modelSelection, setModelSelection] = useState<ModelSelectionType>('orifice');
  const [inputValues, setInputValues] = useState<InputValues>(() => {
    // Load from localStorage on mount
    const stored = localStorage.getItem('gasTransfer-inputValues');
    if (stored) {
      try {
        return { ...JSON.parse(stored) };
      } catch {
        return {} as InputValues;
      }
    }
    return {} as InputValues;
  });
  const [results, setResults] = useState<ComputeOutputs | null>(null);
  const [timeResult, setTimeResult] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastComputeInputs, setLastComputeInputs] = useState<ComputeInputs | null>(null);
  const [debugMode, setDebugMode] = useState(false);

  // Load shared calculation from URL on mount
  useEffect(() => {
    const sharedInputs = deserializeInputsFromURL();
    if (sharedInputs) {
      setInputValues(prev => ({ ...prev, ...sharedInputs }));
      toast({
        title: t('success.shared'),
        description: 'Shared calculation loaded successfully',
      });
    }

    // Calculate PWA score
    setTimeout(() => {
      const score = calculatePWAScore();
      console.log(`🚀 PWA Lighthouse Score: ${score}/100`);
    }, 2000);
  }, [toast, t]);

  // Persist input values to localStorage
  useEffect(() => {
    localStorage.setItem('gasTransfer-inputValues', JSON.stringify(inputValues));
  }, [inputValues]);

  const handleCalculate = async (expandFactor: number = 1) => {
    setLoading(true);
    setError('');

    try {
      // Parse helper (handle string inputs with comma as decimal)
      const parseFlexible = (s: unknown): number => {
        if (typeof s !== "string") return NaN;
        const t = s.replace(/\s/g, "").replace(",", ".");
        const n = Number(t);
        return Number.isFinite(n) ? n : NaN;
      };

      // Calculate atmospheric pressure in SI
      const Patm_SI = 
        inputValues.patmMode === 'standard' ? 101_325 :
        inputValues.patmMode === 'custom' ? toSI_Pressure(parseFlexible(inputValues.patmValue?.value ?? "101.325"), (inputValues.patmValue?.unit ?? "kPa") as any) :
        patmFromAltitude(parseFlexible(inputValues.altitude_m ?? "0"));

      // Helper to convert UI pressure values to absolute SI
      const toAbsSI = (val: number, unit: string): number => {
        const v = toSI_Pressure(val, unit as any);
        if (!Number.isFinite(v)) return NaN;
        return inputValues.pressureInputMode === 'gauge' ? absFromGauge(v, Patm_SI) : v;
      };

      // Convert pressure inputs to absolute SI
      const P1_abs = toAbsSI(inputValues.P1, inputValues.P1_unit);
      const P2_abs = toAbsSI(inputValues.P2, inputValues.P2_unit);
      const Ps_abs = process === "filling" && inputValues.Ps
        ? toAbsSI(inputValues.Ps, inputValues.Ps_unit)
        : undefined;

      console.info("[ABS CHECK]", { P1_abs, P2_abs, Patm_SI });

      // Convert other inputs to SI units
      const V_SI = volumeToSI(inputValues.V, inputValues.V_unit as any);
      const T_SI = temperatureToSI(inputValues.T, inputValues.T_unit as any);
      const L_SI = lengthToSI(inputValues.L, inputValues.L_unit as any);
      
      // Get gas properties
      const gas = inputValues.gasType && GASES[inputValues.gasType] 
        ? GASES[inputValues.gasType]
        : inputValues.customGas || GASES.air;

      // Build calculation inputs with absolute pressures
      const calculationInputs: ComputeInputs = {
        process,
        solveFor,
        V: V_SI,
        P1: clampAbs(P1_abs),
        P2: clampAbs(P2_abs),
        T: T_SI,
        L: L_SI,
        gas,
        Cd: inputValues.Cd,
        epsilon: inputValues.epsilon,
        regime: inputValues.regime,
        Patm_SI,
      };

      // Add process-specific inputs
      if (process === 'filling' && Ps_abs !== undefined) {
        calculationInputs.Ps = clampAbs(Ps_abs);
      }

      // Add solve-specific inputs
      if (solveFor === 'DfromT' && inputValues.t) {
        calculationInputs.t = timeToSI(inputValues.t, inputValues.t_unit as any || 'second');
      } else if (solveFor === 'TfromD' && inputValues.D) {
        calculationInputs.D = lengthToSI(inputValues.D, inputValues.D_unit as any || 'mm');
      }

      // Add model selection to inputs
      calculationInputs.modelSelection = modelSelection;

      // Store inputs for retry functionality
      setLastComputeInputs(calculationInputs);

      // Debug logging - assert volume conversion
      console.assert(
        Math.abs(volumeToSI(1, 'mm3') - 1e-9) < 1e-15,
        'Volume conversion assertion failed: 1 mm³ should equal 1e-9 m³'
      );

      // Console logging for debug mode
      if (debugMode) {
        const siEchoObject = {
          V_SI_m3: calculationInputs.V,
          P1_Pa: calculationInputs.P1,
          P2_Pa: calculationInputs.P2,
          ...(calculationInputs.Ps && { Ps_Pa: calculationInputs.Ps }),
          T_K: calculationInputs.T,
          L_m: calculationInputs.L,
          mode: `${calculationInputs.process}/${calculationInputs.solveFor}`,
          gas: {
            R: calculationInputs.gas.R,
            gamma: calculationInputs.gas.gamma,
            mu: calculationInputs.gas.mu
          },
          Cd: calculationInputs.Cd || 0.62,
          epsilon: calculationInputs.epsilon || 0.01,
          ...(calculationInputs.t && { t_target: calculationInputs.t }),
          ...(calculationInputs.D && { D_target: calculationInputs.D })
        };
        console.info('[SI ECHO]', JSON.stringify(siEchoObject));
      }

      // Validate inputs - pressures are already converted to absolute SI
      if (!(calculationInputs.P1 > 1) || !(calculationInputs.P2 > 1)) {
        throw new Error('Pressures must be positive (absolute pressures)');
      }

      if (process === 'blowdown' && !(calculationInputs.P1 > calculationInputs.P2)) {
        throw new Error(`Initial pressure must be greater than final pressure for blowdown (P1=${(calculationInputs.P1/1000).toFixed(1)} kPa ≤ P2=${(calculationInputs.P2/1000).toFixed(1)} kPa)`);
      }

      if (process === 'filling' && calculationInputs.Ps) {
        if (!(calculationInputs.P2 > calculationInputs.P1)) {
          throw new Error(`Target pressure must be greater than initial pressure for filling (P2=${(calculationInputs.P2/1000).toFixed(1)} kPa ≤ P1=${(calculationInputs.P1/1000).toFixed(1)} kPa)`);
        }
        if (!(calculationInputs.Ps > calculationInputs.P2)) {
          throw new Error(`Supply pressure must be greater than target pressure for filling (Ps=${(calculationInputs.Ps/1000).toFixed(1)} kPa ≤ P2=${(calculationInputs.P2/1000).toFixed(1)} kPa)`);
        }
      }

      if (!(T_SI > 0)) {
        throw new Error('Temperature must be above absolute zero');
      }

      if (!(V_SI > 0) || !(L_SI > 0)) {
        throw new Error('Volume and length must be positive');
      }

      // Perform calculation with retry support for DfromT
      let calculationResults: ComputeOutputs;
      
      if (solveFor === 'DfromT' && expandFactor > 1) {
        // Use retry solver with expanded bounds
        try {
          const D = solveOrificeDfromTWithRetry(calculationInputs, expandFactor);
          calculationResults = computeDfromT({...calculationInputs, D });
          calculationResults.D = D;
        } catch (retryError) {
          calculationResults = computeDfromT(calculationInputs);
        }
      } else {
        if (solveFor === 'DfromT') {
          calculationResults = computeDfromT(calculationInputs);
        } else {
          // Use new action for Time from Diameter with model selection
          const timeResultData = await computeTimeFromD(calculationInputs);
          setTimeResult(timeResultData);
          
          // Warning: Check if capillary time >> orifice time
          if (timeResultData.model === "capillary") {
            const { timeOrificeFromAreaSI } = await import('@/lib/physics');
            const t_orifice_ref = timeOrificeFromAreaSI(timeResultData.SI, timeResultData.A_SI_m2);
            if (timeResultData.t_SI_s > 5 * t_orifice_ref) {
              toast({
                title: "Model Warning",
                description: "Capillary time >> Orifice time; vérifiez le choix de modèle (Re, L/D).",
                variant: "destructive",
                duration: 8000,
              });
            }
          }
          
          // Convert to ComputeOutputs format for compatibility
          calculationResults = {
            t: timeResultData.t_SI_s,
            verdict: timeResultData.model as any,
            diagnostics: { model: timeResultData.model },
            warnings: []
          };
          
          // Check if auto-detection suggests different model
          if (timeResultData.model !== modelSelection) {
            toast({
              title: "Model Auto-Detection",
              description: `Auto-switched to ${timeResultData.model} model (Re${timeResultData.model === 'capillary' ? '<2000' : '>2000'})`,
              duration: 5000,
            });
          }
        }
      }
      
      setResults(calculationResults);
      
      toast({
        title: "Calculation Complete",
        description: `${solveFor === 'DfromT' ? 'Diameter' : 'Time'} calculated successfully`,
        duration: 3000,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Calculation failed';
      setError(errorMessage);
      setResults(null);
      setTimeResult(null);
      
      toast({
        title: "Calculation Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    const newRetryCount = retryCount + 1;
    setRetryCount(newRetryCount);
    const expandFactor = Math.pow(2, newRetryCount); // 2, 4, 8, 16...
    handleCalculate(expandFactor);
  };

  const getSelectedGas = () => {
    if (inputValues.gasType === 'custom' && inputValues.customGas) {
      return inputValues.customGas;
    }
    return GASES[inputValues.gasType as keyof typeof GASES] || GASES.air;
  };

  const computeInputs: ComputeInputs | undefined = React.useMemo(() => {
    if (!inputValues.V || !inputValues.P1 || !inputValues.P2 || !inputValues.T || !inputValues.L) {
      return undefined;
    }

    // Calculate atmospheric pressure
    const Patm_SI = 
      inputValues.patmMode === 'standard' ? 101325 :
      inputValues.patmMode === 'custom' ? toSI_Pressure(inputValues.patmValue?.value || 101.325, inputValues.patmValue?.unit || 'kPa') :
      patmFromAltitude(inputValues.altitude_m ?? 0);

    // Helper function to convert individual pressure fields to absolute SI
    const toAbsSI = (value: number, unit: string) => {
      const x = toSI_Pressure(value, unit as PressureUnit);
      return inputValues.pressureInputMode === 'gauge' ? absFromGauge(x, Patm_SI) : x;
    };

    const P1_abs = toAbsSI(inputValues.P1, inputValues.P1_unit);
    const P2_abs = toAbsSI(inputValues.P2, inputValues.P2_unit);
    const Ps_abs = process === "filling" && inputValues.Ps ? toAbsSI(inputValues.Ps, inputValues.Ps_unit) : undefined;

    return {
      process,
      solveFor,
      V: volumeToSI(inputValues.V, inputValues.V_unit as any),
      P1: clampAbs(P1_abs),
      P2: clampAbs(P2_abs),
      T: temperatureToSI(inputValues.T, inputValues.T_unit as any),
      L: lengthToSI(inputValues.L, inputValues.L_unit as any),
      gas: getSelectedGas(),
      Cd: inputValues.Cd,
      epsilon: inputValues.epsilon,
      regime: inputValues.regime,
      Patm_SI,
      ...(Ps_abs && { Ps: clampAbs(Ps_abs) }),
      ...(solveFor === 'TfromD' && inputValues.D && { D: lengthToSI(inputValues.D, (inputValues.D_unit || 'mm') as any) }),
      ...(solveFor === 'DfromT' && inputValues.t && { t: timeToSI(inputValues.t, (inputValues.t_unit || 'second') as any) }),
    };
  }, [inputValues, process, solveFor, getSelectedGas]);

  const calculatePWAScore = (): number => {
    const checks = {
      'Has manifest': !!document.querySelector('link[rel="manifest"]'),
      'Service worker': 'serviceWorker' in navigator,
      'Icons': !!document.querySelector('link[rel="apple-touch-icon"]'),
      'Theme color': !!document.querySelector('meta[name="theme-color"]'),
      'Viewport meta': !!document.querySelector('meta[name="viewport"]'),
      'HTTPS': location.protocol === 'https:' || location.hostname === 'localhost',
      'Offline ready': 'serviceWorker' in navigator,
      'Installable': true, // PWA manifest configured
    };

    const passed = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    return Math.round((passed / total) * 100);
  };

  const handleClear = () => {
    setResults(null);
    setTimeResult(null);
    setError('');
    // Reset to default values
    setInputValues({} as InputValues);
    
    toast({
      title: "Cleared",
      description: "All inputs and results have been cleared",
    });
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    if (!results) return;

    const exportData = {
      process,
      solveFor,
      inputs: inputValues,
      results,
      timestamp: new Date().toISOString(),
    };

    if (format === 'csv') {
      // Simple CSV export
      const csvData = Object.entries(results.diagnostics)
        .map(([key, value]) => `${key},${value}`)
        .join('\n');
      
      const blob = new Blob([`Parameter,Value\n${csvData}`], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gas-transfer-results-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // JSON export for PDF processing
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gas-transfer-calculation-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    toast({
      title: "Export Complete",
      description: `Results exported as ${format.toUpperCase()}`,
    });
  };

  const handleShare = () => {
    if (!results) return;

    const shareData = {
      title: 'Gas Transfer Calculator Results',
      text: `${solveFor === 'DfromT' ? 'Diameter' : 'Time'}: ${
        solveFor === 'DfromT' && results.D 
          ? `${(results.D * 1000).toFixed(2)} mm`
          : results.t 
          ? `${results.t.toFixed(1)} s`
          : 'N/A'
      }`,
      url: window.location.href,
    };

    if (navigator.share) {
      navigator.share(shareData);
    } else {
      navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
      toast({
        title: "Link Copied",
        description: "Results link copied to clipboard",
      });
    }
  };

  const handleLanguageToggle = () => {
    const languages: Array<'en' | 'fr' | 'it'> = ['en', 'fr', 'it'];
    const currentIndex = languages.indexOf(language);
    const nextLanguage = languages[(currentIndex + 1) % languages.length];
    setLanguage(nextLanguage);
  };

  // Mode-aware disabled logic - only block on genuine physics impossibility
  const disabled = useMemo(() => {
    console.error("🔥 EVERY VALIDATION:", { P2: inputValues.P2, type: typeof inputValues.P2 });
    if (loading) return true;

    // Basic required fields check - 0 is a valid value for pressure!
    if (inputValues.V == null || inputValues.P1 == null || inputValues.P2 == null || inputValues.T == null || inputValues.L == null) return true;
    if ((solveFor === 'DfromT' && !inputValues.t) || (solveFor === 'TfromD' && !inputValues.D)) return true;

    // Re-evaluate ABSOLUTE pressures with current mode
    try {
      const parse = (s: string) => Number(String(s).replace(/\s/g,"").replace(",","."));
      const unit = inputValues.P1_unit as PressureUnit;
      const Patm =
        inputValues.patmMode === "standard" ? 101325 :
        inputValues.patmMode === "custom" ? toSI_Pressure(parse(String(inputValues.patmValue?.value ?? "101.325")), inputValues.patmValue?.unit ?? "kPa") :
        patmFromAltitude(inputValues.altitude_m ?? 0);

      const toAbs = (valStr: string | number, u: PressureUnit) => {
        const x = toSI_Pressure(parse(String(valStr)), u);
        return inputValues.pressureInputMode === "gauge" ? absFromGauge(x, Patm) : x;
      };

      const P1_abs = toAbs(inputValues.P1, unit);
      const P2_abs = toAbs(inputValues.P2, unit);
      
      console.error("🔥 ABS CALCULATION:", { 
        P1: inputValues.P1, P1_abs, 
        P2: inputValues.P2, P2_abs,
        unit, Patm, 
        pressureInputMode: inputValues.pressureInputMode 
      });

      // Debug spécifique pour P2 = 0
      if (inputValues.P2 === 0) {
        console.error("🔥 P2=0 VALIDATION:", { 
          P2: inputValues.P2, unit, Patm, P2_abs,
          pressureInputMode: inputValues.pressureInputMode,
          P1_abs_ok: P1_abs > 1,
          P2_abs_ok: P2_abs > 1,
          both_ok: P1_abs > 1 && P2_abs > 1
        });
      }

      // Only block on genuine physics impossibility:
      if (!(P1_abs > 1 && P2_abs > 1)) return true;               // need positive absolutes
      if (process === "blowdown" && !(P1_abs > P2_abs)) return true;
      if (process === "filling" && inputValues.Ps) {
        const Ps_abs = toAbs(inputValues.Ps, unit);
        if (!(Ps_abs > P1_abs && P2_abs > P1_abs)) return true;
      }
      return false;
    } catch { 
      return true; 
    }
  }, [inputValues, process, solveFor, loading]);

  return (
    <PWAUpdateManager>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
        <SEOHead />
        
        <div className="container mx-auto px-4 py-8 pb-32">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20">
                <CalculatorIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold gradient-text">{t('appTitle')}</h1>
                <p className="text-muted-foreground">{t('appSubtitle')}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <ModeSelector
                process={process}
                solveFor={solveFor}
                modelSelection={modelSelection}
                onProcessChange={setProcess}
                onSolveForChange={setSolveFor}
                onModelSelectionChange={setModelSelection}
              />
              
              <InputsCard
                process={process}
                solveFor={solveFor}
                values={inputValues}
                onChange={setInputValues}
                onSubmit={handleCalculate}
                loading={loading}
              />
              
              {solveFor === 'TfromD' && timeResult ? (
                <ResultsTimeFromD 
                  result={timeResult} 
                  unitTime="s" 
                  debug={debugMode} 
                />
              ) : (
                <ResultsCard 
                  results={results} 
                  solveFor={solveFor}
                  inputs={lastComputeInputs}
                  error={error}
                  onRetry={handleRetry}
                  debugMode={debugMode}
                  userLengthUnit="mm"
                />
              )}
            </div>

            <div className="space-y-6">
              <ExamplePresets onLoadPreset={(inputs, newProcess, newSolveFor) => {
                if (newProcess) setProcess(newProcess);
                if (newSolveFor) setSolveFor(newSolveFor);
                setInputValues(prev => ({ ...prev, ...inputs }));
              }} />
              <ExplainCard />
              <DebugPanel 
                debugMode={debugMode}
                onDebugToggle={setDebugMode}
                siInputs={computeInputs}
                samplingData={results?.sampling || null}
                results={results}
              />
            </div>
          </div>

          {/* PWA Instructions */}
          <div className="mt-8">
            <PWAInstructions />
          </div>
          {/* Safety Footer */}
          <SafetyFooter />

          {/* Sticky Bottom Bar */}
          <StickyBottomBar
            onCalculate={handleCalculate}
            onClear={handleClear}
            loading={loading}
            disabled={disabled}
          />
        </div>
      </div>
    </PWAUpdateManager>
  );
};

export default Calculator;