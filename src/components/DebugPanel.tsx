import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { ComputeInputs, SamplingData, sample_tA, TASampler } from '@/lib/physics';
import { formatLength } from '@/lib/length-units';
import { useI18n } from '@/i18n/context';
import { useToast } from '@/hooks/use-toast';
import { Copy, Download, Table } from 'lucide-react';

interface DebugPanelProps {
  debugMode: boolean;
  onDebugToggle: (enabled: boolean) => void;
  siInputs?: ComputeInputs | null;
  samplingData?: SamplingData | null;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  debugMode,
  onDebugToggle,
  siInputs,
  samplingData
}) => {
  const { t } = useI18n();
  const { toast } = useToast();
  
  // t(A) Sampler state
  const [samplerModel, setSamplerModel] = useState<'orifice' | 'capillary'>('orifice');
  const [samplerALo, setSamplerALo] = useState('1e-12');
  const [samplerAHi, setSamplerAHi] = useState('1e-8');
  const [samplerN, setSamplerN] = useState('5');
  const [samplerResults, setSamplerResults] = useState<TASampler | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  
  const runSampler = async () => {
    if (!siInputs) {
      toast({
        title: 'Error',
        description: 'No SI inputs available for sampling',
        variant: 'destructive',
      });
      return;
    }
    
    setIsRunning(true);
    try {
      const A_lo = parseFloat(samplerALo);
      const A_hi = parseFloat(samplerAHi);
      const n = parseInt(samplerN);
      
      if (isNaN(A_lo) || isNaN(A_hi) || isNaN(n) || A_lo >= A_hi || n < 2) {
        throw new Error('Invalid parameters: A_lo must be < A_hi, n must be ≥ 2');
      }
      
      const results = sample_tA(siInputs, samplerModel, n, A_lo, A_hi);
      setSamplerResults(results);
      
      // Log to console for debugging
      console.table(results.samples);
      console.log('t(A) Sampler Results:', results);
      
      toast({
        title: 'Sampler Complete',
        description: `Generated ${results.samples.length} samples`,
      });
    } catch (error) {
      toast({
        title: 'Sampler Error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };
  
  const exportCSV = () => {
    if (!samplerResults) return;
    
    const headers = ['A_m2', 'D_mm', 't_s', 'phase', 'choked'];
    const rows = samplerResults.samples.map(sample => [
      sample.A_m2.toExponential(6),
      formatLength(sample.D_m, 'mm', 3).toString(),
      sample.t_s.toPrecision(3),
      sample.phase,
      sample.choked.toString()
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tA_sampler_${samplerModel}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: 'CSV Exported',
      description: 'Downloaded t(A) sampler data as CSV',
    });
  };
  
  const exportJSON = () => {
    if (!samplerResults) return;
    
    const jsonContent = JSON.stringify(samplerResults, null, 2);
    
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tA_sampler_${samplerModel}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: 'JSON Exported',
      description: 'Downloaded t(A) sampler data as JSON',
    });
  };
  
  const copyToClipboard = async (content: string, type: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: `${type} Copied`,
        description: `t(A) sampler data copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Debug Toggle */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Dev Panel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Switch
              id="debug-mode"
              checked={debugMode}
              onCheckedChange={onDebugToggle}
            />
            <Label htmlFor="debug-mode" className="text-sm">
              Debug Mode
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* SI Echo Card */}
      {debugMode && siInputs && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-mono">SI Echo</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted/50 p-3 rounded overflow-x-auto">
              <code>
{JSON.stringify({
  V_SI_m3: siInputs.V,
  P1_Pa: siInputs.P1,
  P2_Pa: siInputs.P2,
  ...(siInputs.Ps && { Ps_Pa: siInputs.Ps }),
  T_K: siInputs.T,
  L_m: siInputs.L,
  mode: `${siInputs.process}/${siInputs.solveFor}`,
  gas: {
    R: siInputs.gas.R,
    gamma: siInputs.gas.gamma,
    mu: siInputs.gas.mu
  },
  Cd: siInputs.Cd || 0.62,
  epsilon: siInputs.epsilon || 0.01,
  ...(siInputs.t && { t_target: siInputs.t }),
  ...(siInputs.D && { D_target: siInputs.D })
}, null, 2)}
              </code>
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Sampling Data Table */}
      {debugMode && samplingData && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-mono">Orifice Solver Sampling</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Bracket Info */}
              <div className="text-xs bg-muted/50 p-2 rounded">
                <div className="font-mono space-y-1">
                  <div>A_lo: {samplingData.bracketInfo.A_lo.toExponential(3)} m²</div>
                  <div>A_hi: {samplingData.bracketInfo.A_hi.toExponential(3)} m²</div>
                  <div>t(A_lo): {samplingData.bracketInfo.t_A_lo.toFixed(2)} s</div>
                  <div>t(A_hi): {samplingData.bracketInfo.t_A_hi.toFixed(2)} s</div>
                  <div>Expansions: {samplingData.bracketInfo.expansions}</div>
                </div>
              </div>
              
              {/* Sampling Table */}
              <div className="text-xs">
                <div className="grid grid-cols-3 gap-2 font-mono font-bold mb-2 pb-1 border-b">
                  <div>A [m²]</div>
                  <div>D [mm]</div>
                  <div>t_model [s]</div>
                </div>
                {samplingData.samples.map((sample, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2 font-mono text-xs py-1">
                    <div>{sample.A.toExponential(2)}</div>
                    <div>{sample.D_mm.toFixed(2)}</div>
                    <div>{sample.t_model.toFixed(2)}</div>
                  </div>
                ))}
              </div>
              
              {/* Monotonicity Status */}
              <div className={`text-xs p-2 rounded ${
                samplingData.monotonic 
                  ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300' 
                  : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300'
              }`}>
                Monotonic: {samplingData.monotonic ? '✓ YES' : '✗ NO'}
              </div>
              
              {/* Warnings */}
              {samplingData.warnings.length > 0 && (
                <div className="text-xs">
                  {samplingData.warnings.map((warning, i) => (
                    <div key={i} className="text-orange-600 dark:text-orange-400">
                      ⚠ {warning}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* t(A) Sampler Card */}
      {debugMode && siInputs && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-mono">t(A) Sampler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Controls */}
              <div className="space-y-3">
                {/* Model Selection */}
                <div>
                  <Label className="text-xs font-medium">Model</Label>
                  <RadioGroup
                    value={samplerModel}
                    onValueChange={(value: 'orifice' | 'capillary') => setSamplerModel(value)}
                    className="flex gap-4 mt-1"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="orifice" id="orifice" />
                      <Label htmlFor="orifice" className="text-xs">Orifice</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="capillary" id="capillary" />
                      <Label htmlFor="capillary" className="text-xs">Capillary</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Parameters */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="a-lo" className="text-xs font-medium">A_lo [m²]</Label>
                    <Input
                      id="a-lo"
                      value={samplerALo}
                      onChange={(e) => setSamplerALo(e.target.value)}
                      className="h-8 text-xs font-mono"
                      placeholder="1e-12"
                    />
                  </div>
                  <div>
                    <Label htmlFor="a-hi" className="text-xs font-medium">A_hi [m²]</Label>
                    <Input
                      id="a-hi"
                      value={samplerAHi}
                      onChange={(e) => setSamplerAHi(e.target.value)}
                      className="h-8 text-xs font-mono"
                      placeholder="1e-8"
                    />
                  </div>
                  <div>
                    <Label htmlFor="n-samples" className="text-xs font-medium">n</Label>
                    <Input
                      id="n-samples"
                      value={samplerN}
                      onChange={(e) => setSamplerN(e.target.value)}
                      className="h-8 text-xs"
                      placeholder="5"
                      type="number"
                      min="2"
                    />
                  </div>
                </div>

                {/* Run Button */}
                <Button
                  onClick={runSampler}
                  disabled={isRunning}
                  size="sm"
                  className="w-full"
                >
                  {isRunning ? 'Running...' : 'Run Sampler'}
                </Button>
              </div>

              {/* Results */}
              {samplerResults && (
                <div className="space-y-3 border-t pt-4">
                  {/* Bracket Info */}
                  {samplerResults.bracket && (
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-xs font-mono">
                        A_lo→t_lo: {samplerResults.bracket.A_lo.toExponential(2)}→{samplerResults.bracket.t_lo.toFixed(1)}s
                      </Badge>
                      <Badge variant="outline" className="text-xs font-mono">
                        A_hi→t_hi: {samplerResults.bracket.A_hi.toExponential(2)}→{samplerResults.bracket.t_hi.toFixed(1)}s
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        exp: {samplerResults.bracket.expansions}
                      </Badge>
                    </div>
                  )}

                  {/* Export Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={exportCSV}
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-1 text-xs"
                    >
                      <Download className="w-3 h-3" />
                      Copy CSV
                    </Button>
                    <Button
                      onClick={exportJSON}
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-1 text-xs"
                    >
                      <Copy className="w-3 h-3" />
                      Copy JSON
                    </Button>
                    <Button
                      onClick={() => console.table(samplerResults.samples)}
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-1 text-xs"
                    >
                      <Table className="w-3 h-3" />
                      console.table
                    </Button>
                  </div>

                  {/* Results Table */}
                  <div className="text-xs">
                    <div className="grid grid-cols-5 gap-2 font-mono font-bold mb-2 pb-1 border-b">
                      <div>A [m²]</div>
                      <div>D [mm]</div>
                      <div>t [s]</div>
                      <div>Phase</div>
                      <div>Choked</div>
                    </div>
                    {samplerResults.samples.map((sample, i) => (
                      <div key={i} className="grid grid-cols-5 gap-2 font-mono text-xs py-1">
                        <div>{sample.A_m2.toExponential(2)}</div>
                        <div>{formatLength(sample.D_m, 'mm', 3)}</div>
                        <div>{isFinite(sample.t_s) ? sample.t_s.toPrecision(3) : 'NaN'}</div>
                        <div>
                          <Badge 
                            variant={sample.phase === 'sonic' ? 'destructive' : 
                                   sample.phase === 'mixed' ? 'default' : 'secondary'}
                            className="text-xs px-1 py-0"
                          >
                            {sample.phase}
                          </Badge>
                        </div>
                        <div>{sample.choked ? '✓' : '✗'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};