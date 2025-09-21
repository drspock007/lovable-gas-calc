import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { useI18n } from '@/i18n/context';
import { ComputeOutputs } from '@/lib/physics';
import { UnitSystem, convertFromSI } from '@/lib/units';
import { formatTimeDisplay } from '@/lib/time-format';
import { SolveForType } from './ModeSelector';

interface ResultsDisplayProps {
  results: ComputeOutputs | null;
  solveFor: SolveForType;
  units: UnitSystem;
  error?: string;
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  results,
  solveFor,
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
            Error
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
          <CardTitle className="gradient-text">{t('results')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-muted-foreground">
            <Info className="w-5 h-5 mr-2" />
            <p>{t('clickCalculate')}</p>
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
          {t('results')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Result */}
        {solveFor === 'DfromT' && results.D && (
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <h3 className="font-semibold text-primary mb-2">
              {t('orificeDiameter')}
            </h3>
            <p className="text-2xl font-bold gradient-text">
              {convertFromSI.length(results.D, units.length).toFixed(2)} {t(`units.${units.length}`)}
            </p>
          </div>
        )}

        {solveFor === 'TfromD' && results.t && (() => {
          // Use the better time formatting instead of convertFromSI
          const timeDisplay = formatTimeDisplay(results.t, 3);
          return (
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <h3 className="font-semibold text-primary mb-2">
                {t('transferTime')}
              </h3>
              <p className="text-2xl font-bold gradient-text">
                {timeDisplay.t_display} {timeDisplay.time_unit_used}
              </p>
            </div>
          );
        })()}

        {/* Additional Results */}
        <div className="grid grid-cols-1 gap-3">
          <div className="flex justify-between items-center p-3 bg-secondary/50 rounded">
            <span className="text-sm font-medium">Flow Regime</span>
            <span className="font-semibold">{results.verdict}</span>
          </div>

          <div className="flex justify-between items-center p-3 bg-secondary/50 rounded">
            <span className="text-sm font-medium">Reynolds Number</span>
            <span className="font-semibold">{results.diagnostics.Re ? (results.diagnostics.Re as number).toFixed(0) : 'N/A'}</span>
          </div>

          <div className="flex justify-between items-center p-3 bg-secondary/50 rounded">
            <span className="text-sm font-medium">L/D Ratio</span>
            <span className="font-semibold">{results.diagnostics['L/D'] ? (results.diagnostics['L/D'] as number).toFixed(1) : 'N/A'}</span>
          </div>

          <div className="flex justify-between items-center p-3 bg-secondary/50 rounded">
            <span className="text-sm font-medium">Choked Flow</span>
            <Badge variant={results.diagnostics.choked ? 'destructive' : 'default'}>
              {results.diagnostics.choked ? 'Yes' : 'No'}
            </Badge>
          </div>
        </div>

        {/* Warnings */}
        {results.warnings.length > 0 && (
          <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded">
            <h4 className="font-semibold text-warning mb-2">Warnings:</h4>
            <ul className="text-sm text-warning space-y-1">
              {results.warnings.map((warning, index) => (
                <li key={index}>• {warning}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};