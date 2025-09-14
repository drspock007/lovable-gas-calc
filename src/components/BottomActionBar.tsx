import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calculator, RotateCcw, Download, Globe } from 'lucide-react';
import { useI18n } from '@/i18n/context';
import { computeDisabledReason, type DisabledReason } from '@/lib/compute-enabled';
import { toSI_Pressure, absFromGauge, patmFromAltitude } from '@/lib/pressure-units';

interface BottomActionBarProps {
  values: any;
  onCalculate: () => void;
  onClear: () => void;
  onExport: () => void;
  onLanguageToggle: () => void;
  loading?: boolean;
  hasResults?: boolean;
}

export const BottomActionBar: React.FC<BottomActionBarProps> = ({
  values,
  onCalculate,
  onClear,
  onExport,
  onLanguageToggle,
  loading = false,
  hasResults = false,
}) => {
  const { t, language } = useI18n();
  const [reason, setReason] = useState<DisabledReason>("parse-error");

  useEffect(() => {
    const newReason = computeDisabledReason(values, values?.debug);
    setReason(newReason);
    
    // Debug logging when debug mode is enabled
    if (values?.debug) {
      const parseFlexible = (s: unknown): number => {
        if (typeof s !== "string") return NaN;
        const t = s.replace(/\s/g, "").replace(",", ".");
        const n = Number(t);
        return Number.isFinite(n) ? n : NaN;
      };

      const { pressureInputMode, patmMode, patmValue, altitude_m, P1, P2 } = values;
      
      const Patm_SI =
        patmMode === "standard" ? 101_325 :
        patmMode === "custom"
          ? toSI_Pressure(parseFlexible(patmValue?.value ?? "101.325"), (patmValue?.unit ?? "kPa") as any)
          : patmFromAltitude(parseFlexible(altitude_m ?? "0"));

      const toAbs = (valStr: string, u: string) => {
        const x = toSI_Pressure(parseFlexible(valStr), u as any);
        if (!Number.isFinite(x)) return NaN;
        return pressureInputMode === "gauge" ? absFromGauge(x, Patm_SI) : x;
      };

      const P1_abs = toAbs(P1?.value ?? "", P1?.unit ?? "kPa");
      const P2_abs = toAbs(P2?.value ?? "", P2?.unit ?? "kPa");

      console.info("[ABS CHECK]", {
        P1_abs, P2_abs, Patm_SI, reason: newReason
      });
    }
  }, [values]);

  const getNextLanguage = () => {
    const languages = ['en', 'fr', 'it'];
    const currentIndex = languages.indexOf(language);
    return languages[(currentIndex + 1) % languages.length];
  };
  
  const disabled = loading || reason !== "ok";

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background to-background/95 backdrop-blur-sm border-t border-border">
      <div className="mobile-container">
        <div className="grid grid-cols-4 gap-2 py-4">
          <Button
            onClick={onCalculate}
            disabled={disabled}
            variant="gradient"
            className="touch-target flex-col"
          >
            <Calculator className="w-5 h-5 mb-1" />
            <span className="text-xs">{t('calculate')}</span>
          </Button>
          
          <Button
            onClick={onClear}
            variant="outline"
            className="touch-target flex-col"
          >
            <RotateCcw className="w-5 h-5 mb-1" />
            <span className="text-xs">{t('clear')}</span>
          </Button>
          
          <Button
            onClick={onExport}
            variant="outline"
            disabled={!hasResults}
            className="touch-target flex-col"
          >
            <Download className="w-5 h-5 mb-1" />
            <span className="text-xs">{t('export')}</span>
          </Button>
          
          <Button
            onClick={onLanguageToggle}
            variant="ghost"
            className="touch-target flex-col"
          >
            <Globe className="w-5 h-5 mb-1" />
            <span className="text-xs font-semibold">{getNextLanguage().toUpperCase()}</span>
          </Button>
        </div>
        
        {values?.debug && (
          <div className="px-4 pb-2 text-xs opacity-70 text-center">
            disabled={String(disabled)} reason={reason}
          </div>
        )}
      </div>
    </div>
  );
};