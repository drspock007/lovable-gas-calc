import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calculator, Clock } from 'lucide-react';
import { useI18n } from '@/i18n/context';

export type CalculationMode = 'diameter' | 'time';

interface ModeSelectorProps {
  mode: CalculationMode;
  onModeChange: (mode: CalculationMode) => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({ mode, onModeChange }) => {
  const { t } = useI18n();

  return (
    <Card className="engineering-card">
      <CardContent className="p-content">
        <h2 className="text-lg font-semibold mb-4 gradient-text">
          {t.common.mode}
        </h2>
        <div className="grid grid-cols-1 gap-3">
          <Button
            variant={mode === 'diameter' ? 'default' : 'outline'}
            onClick={() => onModeChange('diameter')}
            className="touch-target justify-start"
          >
            <Calculator className="w-5 h-5 mr-3" />
            {t.calculator.modes.calculateDiameter}
          </Button>
          <Button
            variant={mode === 'time' ? 'default' : 'outline'}
            onClick={() => onModeChange('time')}
            className="touch-target justify-start"
          >
            <Clock className="w-5 h-5 mr-3" />
            {t.calculator.modes.calculateTime}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};