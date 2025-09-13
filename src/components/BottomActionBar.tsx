import React from 'react';
import { Button } from '@/components/ui/button';
import { Calculator, RotateCcw, Download, Globe } from 'lucide-react';
import { useI18n } from '@/i18n/context';

interface BottomActionBarProps {
  onCalculate: () => void;
  onClear: () => void;
  onExport: () => void;
  onLanguageToggle: () => void;
  loading?: boolean;
  hasResults?: boolean;
}

export const BottomActionBar: React.FC<BottomActionBarProps> = ({
  onCalculate,
  onClear,
  onExport,
  onLanguageToggle,
  loading = false,
  hasResults = false,
}) => {
  const { t, language } = useI18n();

  const getNextLanguage = () => {
    const languages = ['en', 'fr', 'it'];
    const currentIndex = languages.indexOf(language);
    return languages[(currentIndex + 1) % languages.length];
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background to-background/95 backdrop-blur-sm border-t border-border">
      <div className="mobile-container">
        <div className="grid grid-cols-4 gap-2 py-4">
          <Button
            onClick={onCalculate}
            disabled={loading}
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
      </div>
    </div>
  );
};