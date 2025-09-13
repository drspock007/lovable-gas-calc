import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ComputeInputs, SamplingData } from '@/lib/physics';
import { useI18n } from '@/i18n/context';

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
    </div>
  );
};