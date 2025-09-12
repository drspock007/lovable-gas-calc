import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ModeSelector, CalculationMode } from '@/components/ModeSelector';
import { InputForm, FormData } from '@/components/InputForm';
import { ResultsDisplay } from '@/components/ResultsDisplay';
import { ExplanationCard } from '@/components/ExplanationCard';
import { BottomActionBar } from '@/components/BottomActionBar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useI18n } from '@/i18n/context';
import { UnitSystem, loadUnitPreferences, saveUnitPreferences, convertToSI } from '@/lib/units';
import { calculateOrificeFlow, CalculationResults, COMMON_GASES } from '@/lib/physics';
import { Calculator as CalculatorIcon, Settings } from 'lucide-react';

export const Calculator: React.FC = () => {
  const { t, language, setLanguage } = useI18n();
  const { toast } = useToast();
  
  const [mode, setMode] = useState<CalculationMode>('diameter');
  const [units, setUnits] = useState<UnitSystem>(loadUnitPreferences);
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [currentFormData, setCurrentFormData] = useState<FormData | null>(null);

  const handleUnitsChange = (newUnits: UnitSystem) => {
    setUnits(newUnits);
    saveUnitPreferences(newUnits);
  };

  const handleCalculate = async (data: FormData) => {
    setLoading(true);
    setError('');
    setCurrentFormData(data);

    try {
      // Convert all inputs to SI units
      const pressure1SI = convertToSI.pressure(data.pressure1, units.pressure);
      const pressure2SI = convertToSI.pressure(data.pressure2, units.pressure);
      const volumeSI = convertToSI.volume(data.volume, units.volume);
      const temperatureSI = convertToSI.temperature(data.temperature, units.temperature);
      
      // Get gas properties
      const gas = data.gasType && COMMON_GASES[data.gasType] 
        ? COMMON_GASES[data.gasType]
        : { 
            molecularWeight: (data.molecularWeight || 29) / 1000, // Convert g/mol to kg/mol
            gammaRatio: 1.4 
          };

      const calculationInputs = {
        vessel: {
          pressure1: pressure1SI,
          pressure2: pressure2SI,
          volume: volumeSI,
          temperature: temperatureSI,
        },
        gas,
        ...(mode === 'diameter' 
          ? { time: convertToSI.time((data as any).time, units.time) }
          : { diameter: convertToSI.length((data as any).diameter, units.length) }
        ),
      };

      // Validate inputs
      if (pressure1SI <= pressure2SI) {
        throw new Error('Initial pressure must be greater than final pressure');
      }

      if (temperatureSI <= 0) {
        throw new Error(t.calculator.errors.invalidTemperature);
      }

      const calculationResults = calculateOrificeFlow(calculationInputs);
      setResults(calculationResults);
      
      toast({
        title: "Calculation Complete",
        description: mode === 'diameter' 
          ? "Orifice diameter calculated successfully"
          : "Transfer time calculated successfully",
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t.calculator.errors.calculationError;
      setError(errorMessage);
      setResults(null);
      
      toast({
        title: t.common.error,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setResults(null);
    setError('');
    setCurrentFormData(null);
    toast({
      title: "Cleared",
      description: "All inputs and results have been cleared",
    });
  };

  const handleExport = () => {
    if (!results || !currentFormData) return;

    const exportData = {
      mode,
      inputs: currentFormData,
      units,
      results,
      timestamp: new Date().toISOString(),
    };

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

    toast({
      title: "Exported",
      description: "Calculation results exported successfully",
    });
  };

  const handleLanguageToggle = () => {
    const languages: Array<'en' | 'fr' | 'it'> = ['en', 'fr', 'it'];
    const currentIndex = languages.indexOf(language);
    const nextLanguage = languages[(currentIndex + 1) % languages.length];
    setLanguage(nextLanguage);
  };

  return (
    <div className="min-h-screen bg-gradient-surface">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gradient-to-r from-background/95 to-background/90 backdrop-blur-sm border-b border-border">
        <div className="mobile-container">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-primary rounded-lg">
                <CalculatorIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold gradient-text">
                  {t.calculator.title}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {t.calculator.subtitle}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mobile-container pb-32 space-y-section">
        <ModeSelector mode={mode} onModeChange={setMode} />
        
        <InputForm
          mode={mode}
          units={units}
          onUnitsChange={handleUnitsChange}
          onSubmit={handleCalculate}
          loading={loading}
        />
        
        <ResultsDisplay
          results={results}
          mode={mode}
          units={units}
          error={error}
        />
        
        <ExplanationCard />
      </main>

      {/* Bottom Action Bar */}
      <BottomActionBar
        onCalculate={() => currentFormData && handleCalculate(currentFormData)}
        onClear={handleClear}
        onExport={handleExport}
        onLanguageToggle={handleLanguageToggle}
        loading={loading}
        hasResults={!!results}
      />
    </div>
  );
};