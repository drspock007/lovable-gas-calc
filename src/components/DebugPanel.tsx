import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ComputeInputs } from '@/lib/physics';
import { useI18n } from '@/i18n/context';

interface DebugPanelProps {
  debugMode: boolean;
  onDebugToggle: (enabled: boolean) => void;
  siInputs?: ComputeInputs | null;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  debugMode,
  onDebugToggle,
  siInputs
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
    </div>
  );
};