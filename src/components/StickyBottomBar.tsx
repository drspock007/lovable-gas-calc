import React from 'react';
import { Button } from '@/components/ui/button';
import { Calculator, RotateCcw, Sparkles } from 'lucide-react';
import { useI18n } from '@/i18n/context';

interface StickyBottomBarProps {
  onCalculate: () => void;
  onClear: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export const StickyBottomBar: React.FC<StickyBottomBarProps> = ({
  onCalculate,
  onClear,
  loading = false,
  disabled = false,
}) => {
  const { t } = useI18n();

  const handleCalculate = () => {
    // Trigger haptic feedback if available
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
    onCalculate();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-background via-background to-background/95 backdrop-blur-sm border-t border-border">
      <div className="max-w-md mx-auto px-4 py-3">
        <div className="flex gap-3">
          <Button
            onClick={onClear}
            variant="outline"
            size="lg"
            className="touch-target flex-shrink-0"
            disabled={loading}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          
          <Button
            onClick={handleCalculate}
            variant="gradient"
            size="lg"
            className="touch-target flex-1 shadow-elevated"
            disabled={disabled || loading}
          >
            {loading ? (
              <>
                <Sparkles className="w-5 h-5 mr-2 animate-spin" />
                Computing...
              </>
            ) : (
              <>
                <Calculator className="w-5 h-5 mr-2" />
                Compute
              </>
            )}
          </Button>
        </div>
      </div>
      
      {/* Safe area for devices with home indicator */}
      <div className="h-safe-bottom"></div>
    </div>
  );
};