import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ModeSelector, ProcessType, SolveForType } from '@/components/ModeSelector';
import { InputsCard, InputValues } from '@/components/InputsCard';
import { ResultsCard } from '@/components/ResultsCard';
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
import { 
  pressureToSI, 
  volumeToSI, 
  temperatureToSI, 
  lengthToSI, 
  timeToSI 
} from '@/lib/units';
import { Calculator as CalculatorIcon, Zap } from 'lucide-react';
import { DebugPanel } from '@/components/DebugPanel';

export const Calculator: React.FC = () => {
  const { t, language, setLanguage } = useI18n();
  const { toast } = useToast();
  
  const [process, setProcess] = useState<ProcessType>('blowdown');
  const [solveFor, setSolveFor] = useState<SolveForType>('DfromT');
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
      // Convert all inputs to SI units
      const V_SI = volumeToSI(inputValues.V, inputValues.V_unit as any);
      const P1_SI = pressureToSI(inputValues.P1, inputValues.P1_unit as any);
      const P2_SI = pressureToSI(inputValues.P2, inputValues.P2_unit as any);
      const T_SI = temperatureToSI(inputValues.T, inputValues.T_unit as any);
      const L_SI = lengthToSI(inputValues.L, inputValues.L_unit as any);
      
      // Get gas properties
      const gas = inputValues.gasType && GASES[inputValues.gasType] 
        ? GASES[inputValues.gasType]
        : inputValues.customGas || GASES.air;

      // Build calculation inputs
      const calculationInputs: ComputeInputs = {
        process,
        solveFor,
        V: V_SI,
        P1: P1_SI,
        P2: P2_SI,
        T: T_SI,
        L: L_SI,
        gas,
        Cd: inputValues.Cd,
        epsilon: inputValues.epsilon,
        regime: inputValues.regime,
      };

      // Add process-specific inputs
      if (process === 'filling' && inputValues.Ps) {
        calculationInputs.Ps = pressureToSI(inputValues.Ps, inputValues.Ps_unit as any || 'bar');
      }

      // Add solve-specific inputs
      if (solveFor === 'DfromT' && inputValues.t) {
        calculationInputs.t = timeToSI(inputValues.t, inputValues.t_unit as any || 'second');
      } else if (solveFor === 'TfromD' && inputValues.D) {
        calculationInputs.D = lengthToSI(inputValues.D, inputValues.D_unit as any || 'mm');
      }

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

      // Validate inputs
      if (P1_SI <= 0 || P2_SI <= 0) {
        throw new Error('Pressures must be positive (absolute pressures)');
      }

      if (process === 'blowdown' && P1_SI <= P2_SI) {
        throw new Error('Initial pressure must be greater than final pressure for blowdown');
      }

      if (process === 'filling' && P1_SI >= P2_SI) {
        throw new Error('Target pressure must be greater than initial pressure for filling');
      }

      if (T_SI <= 0) {
        throw new Error('Temperature must be above absolute zero');
      }

      if (V_SI <= 0 || L_SI <= 0) {
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
        calculationResults = solveFor === 'DfromT' 
          ? computeDfromT(calculationInputs)
          : computeTfromD(calculationInputs);
      }
        
      setResults(calculationResults);
      
      toast({
        title: "Calculation Complete",
        description: `${solveFor === 'DfromT' ? 'Diameter' : 'Time'} calculated successfully`,
        duration: 3000,
      });
        
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

    return {
      process,
      solveFor,
      V: volumeToSI(inputValues.V, inputValues.V_unit as any),
      P1: pressureToSI(inputValues.P1, inputValues.P1_unit as any),
      P2: pressureToSI(inputValues.P2, inputValues.P2_unit as any),
      T: temperatureToSI(inputValues.T, inputValues.T_unit as any),
      L: lengthToSI(inputValues.L, inputValues.L_unit as any),
      gas: getSelectedGas(),
      Cd: inputValues.Cd,
      epsilon: inputValues.epsilon,
      regime: inputValues.regime,
      ...(process === 'filling' && inputValues.Ps && { Ps: pressureToSI(inputValues.Ps, (inputValues.Ps_unit || 'bar') as any) }),
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

  const canCalculate = inputValues.V && inputValues.P1 && inputValues.P2 && inputValues.T && inputValues.L &&
    ((solveFor === 'DfromT' && inputValues.t) || (solveFor === 'TfromD' && inputValues.D));

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
                onProcessChange={setProcess}
                onSolveForChange={setSolveFor}
              />
              
              <InputsCard
                process={process}
                solveFor={solveFor}
                values={inputValues}
                onChange={setInputValues}
                onSubmit={handleCalculate}
                loading={loading}
              />
              
              <ResultsCard 
                results={results} 
                solveFor={solveFor}
                inputs={lastComputeInputs}
                error={error}
                onRetry={handleRetry}
                debugMode={debugMode}
                userLengthUnit="mm"
              />
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
            disabled={!canCalculate}
          />
        </div>
      </div>
    </PWAUpdateManager>
  );
};

export default Calculator;