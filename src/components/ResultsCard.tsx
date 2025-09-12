import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, AlertTriangle, Copy, Download, Share, TrendingUp, Gauge, Zap } from 'lucide-react';
import { useI18n } from '@/i18n/context';
import { ComputeOutputs } from '@/lib/physics';
import { lengthFromSI, timeFromSI } from '@/lib/units';
import { SolveForType } from './ModeSelector';
import { useToast } from '@/hooks/use-toast';

interface ResultsCardProps {
  results: ComputeOutputs | null;
  solveFor: SolveForType;
  error?: string;
  onExport: (format: 'csv' | 'pdf') => void;
  onShare: () => void;
}

export const ResultsCard: React.FC<ResultsCardProps> = ({
  results,
  solveFor,
  error,
  onExport,
  onShare,
}) => {
  const { t } = useI18n();
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    });
  };

  if (error) {
    return (
      <Card className="engineering-card border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Calculation Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive text-sm">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!results) {
    return (
      <Card className="engineering-card opacity-50">
        <CardHeader>
          <CardTitle className="gradient-text">Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Configure inputs and press Compute to see results</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatNumber = (value: number, sigFigs: number = 3): string => {
    return value.toPrecision(sigFigs);
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'capillary': return 'default';
      case 'orifice': return 'secondary';
      case 'both': return 'default';
      default: return 'destructive';
    }
  };

  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case 'capillary': return <Gauge className="w-4 h-4" />;
      case 'orifice': return <Zap className="w-4 h-4" />;
      case 'both': return <CheckCircle className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  return (
    <Card className="engineering-card border-success">
      <CardHeader>
        <CardTitle className="text-success flex items-center justify-between">
          <span className="flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            Results
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard(JSON.stringify(results, null, 2), 'Results')}
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onShare}
            >
              <Share className="w-4 h-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Primary Result */}
        <div className="text-center p-6 bg-gradient-primary rounded-xl text-white">
          {solveFor === 'DfromT' && results.D ? (
            <>
              <h3 className="text-lg font-semibold mb-2">Required Orifice Diameter</h3>
              <div className="text-4xl font-bold mb-2">
                {formatNumber(lengthFromSI(results.D, 'mm'))} mm
              </div>
              <p className="text-sm opacity-90">
                {formatNumber(lengthFromSI(results.D, 'm'), 4)} m
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-white/80 hover:text-white"
                onClick={() => copyToClipboard(formatNumber(lengthFromSI(results.D!, 'mm')), 'Diameter')}
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
            </>
          ) : results.t ? (
            <>
              <h3 className="text-lg font-semibold mb-2">Transfer Time</h3>
              <div className="text-4xl font-bold mb-2">
                {formatNumber(timeFromSI(results.t, 'second'))} s
              </div>
              <p className="text-sm opacity-90">
                {formatNumber(timeFromSI(results.t, 'minute'), 4)} min
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-white/80 hover:text-white"
                onClick={() => copyToClipboard(formatNumber(timeFromSI(results.t!, 'second')), 'Time')}
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
            </>
          ) : (
            <p className="text-center text-muted-foreground">No valid result computed</p>
          )}
        </div>

        {/* Model Verdict */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center">
            Model Verdict
            <Badge variant={getVerdictColor(results.verdict)} className="ml-2">
              {getVerdictIcon(results.verdict)}
              <span className="ml-1 capitalize">{results.verdict}</span>
            </Badge>
          </h3>
          <div className="text-sm text-muted-foreground">
            {results.verdict === 'capillary' && (
              <p>Poiseuille laminar flow model applies. Low Reynolds number, viscous-dominated flow through narrow channels.</p>
            )}
            {results.verdict === 'orifice' && (
              <p>Compressible orifice flow model applies. High Reynolds number, inertial-dominated flow with potential choking.</p>
            )}
            {results.verdict === 'both' && (
              <p>Both models are valid. Capillary model preferred for viscous flow, orifice model for high-speed flow.</p>
            )}
            {results.verdict === 'inconclusive' && (
              <p>Unable to determine appropriate model. Check input parameters and consider model limitations.</p>
            )}
          </div>
        </div>

        <Separator />

        {/* Diagnostics Table */}
        <div className="space-y-3">
          <h3 className="font-semibold">Diagnostics</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {Object.entries(results.diagnostics).map(([key, value]) => (
              <div key={key} className="flex justify-between p-2 bg-secondary/30 rounded">
                <span className="font-medium">{key}</span>
                <span className="text-muted-foreground">
                  {typeof value === 'number' ? formatNumber(value, 3) : String(value)}
                </span>
              </div>
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
                Warnings
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

        {/* Export Actions */}
        <Separator />
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onExport('csv')}
            className="flex-1"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => onExport('pdf')}
            className="flex-1"
          >
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};