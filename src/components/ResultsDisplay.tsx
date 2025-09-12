import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { useI18n } from '@/i18n/context';
import { CalculationResults } from '@/lib/physics';
import { UnitSystem, convertFromSI } from '@/lib/units';
import { CalculationMode } from './ModeSelector';

interface ResultsDisplayProps {
  results: CalculationResults | null;
  mode: CalculationMode;
  units: UnitSystem;
  error?: string;
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  results,
  mode,
  units,
  error,
}) => {
  const { t } = useI18n();

  if (error) {
    return (
      <Card className="engineering-card border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            {t.common.error}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!results) {
    return (
      <Card className="engineering-card opacity-50">
        <CardHeader>
          <CardTitle className="gradient-text">{t.common.results}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-muted-foreground">
            <Info className="w-5 h-5 mr-2" />
            <p>{t.common.calculate}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="engineering-card border-success">
      <CardHeader>
        <CardTitle className="text-success flex items-center">
          <CheckCircle className="w-5 h-5 mr-2" />
          {t.common.results}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Result */}
        {mode === 'diameter' && results.diameter && (
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <h3 className="font-semibold text-primary mb-2">
              {t.calculator.results.calculatedDiameter}
            </h3>
            <p className="text-2xl font-bold gradient-text">
              {convertFromSI.length(results.diameter, units.length).toFixed(2)} {t.calculator.units[units.length]}
            </p>
          </div>
        )}

        {mode === 'time' && results.time && (
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <h3 className="font-semibold text-primary mb-2">
              {t.calculator.results.calculatedTime}
            </h3>
            <p className="text-2xl font-bold gradient-text">
              {convertFromSI.time(results.time, units.time).toFixed(1)} {t.calculator.units[units.time]}
            </p>
          </div>
        )}

        {/* Additional Results */}
        <div className="grid grid-cols-1 gap-3">
          <div className="flex justify-between items-center p-3 bg-secondary/50 rounded">
            <span className="text-sm font-medium">{t.calculator.results.massFlowRate}</span>
            <span className="font-semibold">{(results.massFlowRate * 1000).toFixed(3)} g/s</span>
          </div>

          <div className="flex justify-between items-center p-3 bg-secondary/50 rounded">
            <span className="text-sm font-medium">Discharge Coefficient</span>
            <span className="font-semibold">{results.dischargeCoefficient.toFixed(3)}</span>
          </div>

          <div className="flex justify-between items-center p-3 bg-secondary/50 rounded">
            <span className="text-sm font-medium">Flow Regime</span>
            <Badge variant={results.chokedFlow ? 'destructive' : 'default'}>
              {results.chokedFlow ? 'Choked' : 'Unchoked'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};