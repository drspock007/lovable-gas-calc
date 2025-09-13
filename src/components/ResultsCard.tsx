import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Copy, Download, Share2, CheckCircle, AlertTriangle, Info, FileText, FileDown, RotateCcw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useI18n } from '@/i18n/context';
import { ComputeOutputs, ComputeInputs, BracketError, IntegralError, ResidualError } from '@/lib/physics';
import { exportToCSV, exportToPDF, shareCalculation } from '@/lib/export';
import { useToast } from '@/hooks/use-toast';
import { formatLength, LengthUnit, LENGTH_LABEL, toSI_Length } from '@/lib/length-units';

interface ResultsCardProps {
  results: ComputeOutputs | null;
  solveFor: 'DfromT' | 'TfromD';
  inputs?: ComputeInputs;
  error?: string;
  onRetry?: () => void;
  debugMode?: boolean;
  userLengthUnit?: LengthUnit;
}

// Conversion back helper
function backToSI_VisibleNumber(v: number, u: LengthUnit): number {
  return toSI_Length(v, u);
}

export const ResultsCard: React.FC<ResultsCardProps> = ({
  results,
  solveFor,
  inputs,
  error,
  onRetry,
  debugMode = false,
  userLengthUnit = 'mm',
}) => {
  const { t, language } = useI18n();
  const { toast } = useToast();

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: t('success.copied'),
        description: t('success.copied'),
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleExportCSV = async () => {
    if (!results || !inputs) return;
    
    try {
      exportToCSV(inputs, results, language);
      toast({
        title: t('success.exported'),
        description: 'CSV file downloaded successfully',
      });
    } catch (error) {
      toast({
        title: 'Export Error',
        description: 'Failed to export CSV',
        variant: 'destructive',
      });
    }
  };

  const handleExportPDF = async () => {
    if (!results || !inputs) return;
    
    try {
      await exportToPDF(inputs, results, language);
      toast({
        title: t('success.exported'),
        description: 'PDF file downloaded successfully',
      });
    } catch (error) {
      toast({
        title: 'Export Error',
        description: 'Failed to export PDF',
        variant: 'destructive',
      });
    }
  };

  const handleShare = async () => {
    if (!inputs) return;
    
    try {
      await shareCalculation(inputs, t);
      toast({
        title: t('success.shared'),
        description: 'Link shared successfully',
      });
    } catch (error) {
      // shareCalculation handles clipboard fallback
      toast({
        title: t('success.copied'),
        description: 'Share link copied to clipboard',
      });
    }
  };

  const formatNumber = (value: number, decimals = 3): string => {
    if (value === 0) return '0';
    if (Math.abs(value) < 0.001 || Math.abs(value) >= 1000) {
      return value.toExponential(decimals);
    }
    return value.toFixed(decimals);
  };

  const checkDiameterSanity = (D_SI_m: number, volume: number): boolean => {
    // Sphere-equivalent diameter of the tank: D_eq = (6 * V_SI_m3 / π)^(1/3)
    const D_eq = Math.pow(6 * volume / Math.PI, 1/3);
    
    // If computed diameter is larger than the tank's equivalent diameter, it's unphysical
    return D_SI_m <= D_eq;
  };

  const getVerdictColor = (verdict: string): string => {
    switch (verdict) {
      case 'capillary': return 'text-blue-600';
      case 'orifice': return 'text-green-600';
      case 'both': return 'text-purple-600';
      default: return 'text-orange-600';
    }
  };

  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case 'capillary': return <Info className="w-4 h-4" />;
      case 'orifice': return <CheckCircle className="w-4 h-4" />;
      case 'both': return <CheckCircle className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const formatResultText = (): string => {
    if (!results) return '';
    
    const D_SI_m = results.solverResultSI?.D_SI_m;
    const t_SI_s = results.solverResultSI?.t_SI_s;
    
    const lines = [
      `Gas Transfer Calculation Results`,
      `Model: ${results.verdict}`,
      D_SI_m ? `Diameter: ${formatLength(D_SI_m, userLengthUnit)} ${LENGTH_LABEL[userLengthUnit]}` : '',
      t_SI_s ? `Time: ${t_SI_s.toFixed(1)} s` : '',
      results.diagnostics.rationale ? `Rationale: ${results.diagnostics.rationale}` : '',
    ].filter(Boolean);
    
    return lines.join('\n');
  };

  // Get SI values from solver result
  const D_SI_m = results?.solverResultSI?.D_SI_m;
  const t_SI_s = results?.solverResultSI?.t_SI_s;
  const A_SI_m2 = results?.solverResultSI?.A_SI_m2;

  // Handle computation errors with specific messaging
  if (results?.error) {
    const { error: compError } = results;
    let errorMessage = compError.message;
    let showRetryButton = false;
    
    if (compError.type === 'bracketing') {
      errorMessage = "Solver could not bracket the solution. Try increasing target time, widening A bounds, or set ε=1% (default).";
      showRetryButton = true;
    } else if (compError.type === 'integral') {
      errorMessage = "Integral near target pressure is too stiff. Increase ε (e.g., 1–2%) or choose adiabatic=false (isothermal).";
    } else if (compError.type === 'residual') {
      errorMessage = "Result rejected by residual check; switching to alternative model or ask user to retry.";
      showRetryButton = true;
    }
    
    return (
      <Card className="engineering-card border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Error
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-destructive">{errorMessage}</p>
          
          {compError.suggestions && compError.suggestions.length > 0 && (
            <div className="p-3 bg-warning/10 rounded border border-warning/20">
              <h4 className="font-semibold text-warning mb-2">Suggestions:</h4>
              <ul className="text-sm text-warning space-y-1">
                {compError.suggestions.map((suggestion, index) => (
                  <li key={index}>• {suggestion}</li>
                ))}
              </ul>
            </div>
          )}
          
          {showRetryButton && onRetry && (
            <Button
              variant="outline"
              onClick={onRetry}
              className="flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Auto‑expand search & retry
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

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
        {/* Primary Result */}
        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-primary">
              {t('primaryResult')}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(formatResultText())}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {D_SI_m && (
              <p className="text-2xl font-bold gradient-text">
                {t('orificeDiameter')}: {formatLength(D_SI_m, userLengthUnit)} {LENGTH_LABEL[userLengthUnit]}
              </p>
            )}
            {t_SI_s && (
              <p className="text-2xl font-bold gradient-text">
                {t('transferTime')}: {t_SI_s.toFixed(1)} s
              </p>
            )}
          </div>
          
          {/* Dev-only debug line */}
          {debugMode && (
            <div className="mt-3 p-2 bg-muted/50 rounded text-xs font-mono">
              D_SI = {D_SI_m || 'undefined'} m, A_SI = {A_SI_m2 || 'undefined'} m², t_check = {t_SI_s || 'undefined'} s
            </div>
          )}
          
          {/* UI vs SI validation check */}
          {debugMode && D_SI_m && (() => {
            const visibleValue = formatLength(D_SI_m, userLengthUnit);
            const backToSI = backToSI_VisibleNumber(visibleValue, userLengthUnit);
            const percentDiff = Math.abs((backToSI - D_SI_m) / D_SI_m) * 100;
            
            if (percentDiff > 0.5) {
              return (
                <div className="mt-2">
                  <Badge variant="destructive" className="text-xs">
                    UI≠SI: check wiring of units
                  </Badge>
                </div>
              );
            }
            return null;
          })()}
        </div>

        {/* Diameter Sanity Check Banner */}
        {D_SI_m && inputs?.V && !checkDiameterSanity(D_SI_m, inputs.V) && (
          <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  Unphysically Large Diameter
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  Diameter appears unphysically large for the selected volume. Check units (mm³ vs L).
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-400">
                  Computed: {formatLength(D_SI_m, userLengthUnit)} {LENGTH_LABEL[userLengthUnit]} for {(inputs.V * 1e9).toFixed(0)} mm³ volume (D_eq ≈ {formatLength(Math.pow(6 * inputs.V / Math.PI, 1/3), userLengthUnit)} {LENGTH_LABEL[userLengthUnit]})
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Smart De-prioritization Warning Banner */}
        {results.warnings.some(w => w.includes('de-prioritized')) && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Model Selection Optimization
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {results.warnings.find(w => w.includes('de-prioritized'))}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  This automatic selection improves accuracy for your flow conditions.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Model Verdict */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center">
            {getVerdictIcon(results.verdict)}
            <span className="ml-2">{t('modelVerdict')}</span>
          </h3>
          <div className="p-3 bg-secondary/50 rounded border">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline" className={getVerdictColor(results.verdict)}>
                {t(`verdicts.${results.verdict}`)}
              </Badge>
            </div>
            {results.diagnostics.rationale && (
              <p className="text-sm text-muted-foreground">
                {results.diagnostics.rationale}
              </p>
            )}
          </div>
        </div>

        {/* Diagnostics */}
        <div className="space-y-3">
          <h3 className="font-semibold">{t('diagnostics')}</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(results.diagnostics).map(([key, value]) => (
              key !== 'rationale' && (
                <div key={key} className="p-3 bg-secondary/50 rounded">
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    {key === 'Mach' && results.diagnostics.choked ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help border-b border-dashed">
                              {key}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Mach = 1.0 at throat (choked flow)</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : key === 't_check' ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help border-b border-dashed">
                              t_check
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Forward verification: time computed from solved diameter</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : key === 'D_check' ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help border-b border-dashed">
                              D_check
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Forward verification: diameter computed from solved time</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                     ) : (
                       key
                     )}
                   </div>
                   <span className="text-muted-foreground">
                     {typeof value === 'number' ? formatNumber(value, 3) : String(value)}
                   </span>
                 </div>
               )
             ))}
          </div>
        </div>

        {/* Warnings */}
        {results.warnings.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold text-warning flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2" />
                {t('warnings')}
              </h3>
              <ul className="space-y-2">
                {results.warnings.map((warning, index) => (
                  <li key={index} className="text-sm text-warning bg-warning/10 p-3 rounded border border-warning/20">
                    • {warning}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Export and Share Actions */}
        {results && inputs && (
          <div className="flex flex-wrap gap-2 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(formatResultText())}
              className="flex items-center gap-2"
            >
              <Copy className="w-4 h-4" />
              {t('copy')}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              {t('exportCSV')}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              className="flex items-center gap-2"
            >
              <FileDown className="w-4 h-4" />
              {t('exportPDF')}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="flex items-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              {t('share')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};