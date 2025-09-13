import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Settings } from 'lucide-react';
import { useI18n } from '@/i18n/context';
import { UnitInput } from './UnitInput';
import { GasSelector } from './GasSelector';
import { GASES, GasProps } from '@/lib/physics';
import { ProcessType, SolveForType } from './ModeSelector';

export interface InputValues {
  // Core inputs
  V: number;
  V_unit: string;
  P1: number;
  P1_unit: string;
  P2: number;
  P2_unit: string;
  T: number;
  T_unit: string;
  L: number;
  L_unit: string;
  
  // Gas selection
  gasType: string;
  customGas?: GasProps;
  
  // Process-specific
  Ps?: number;
  Ps_unit?: string;
  t?: number;
  t_unit?: string;
  D?: number;
  D_unit?: string;
  
  // Advanced options
  epsilon: number;
  regime: 'isothermal' | 'adiabatic';
  Cd: number;
  mu_override?: number;
  tolerance?: number;
}

interface InputsCardProps {
  process: ProcessType;
  solveFor: SolveForType;
  values: InputValues;
  onChange: (values: InputValues) => void;
  onSubmit: () => void;
  loading?: boolean;
}

const DEFAULT_VALUES: InputValues = {
  V: 100, V_unit: 'liter',
  P1: 10, P1_unit: 'bar',
  P2: 1, P2_unit: 'bar',
  T: 20, T_unit: 'celsius',
  L: 50, L_unit: 'mm',
  gasType: 'air',
  Ps: 15, Ps_unit: 'bar',
  t: 60, t_unit: 'second',
  D: 5, D_unit: 'mm',
  epsilon: 0.01,
  regime: 'isothermal',
  Cd: 0.62,
};

export const InputsCard: React.FC<InputsCardProps> = ({
  process,
  solveFor,
  values,
  onChange,
  onSubmit,
  loading = false,
}) => {
  const { t } = useI18n();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('gasCalculator_inputs');
    if (stored) {
      try {
        const parsedValues = JSON.parse(stored);
        onChange({ ...DEFAULT_VALUES, ...parsedValues });
      } catch {
        onChange(DEFAULT_VALUES);
      }
    } else {
      onChange(DEFAULT_VALUES);
    }
  }, []);

  // Save to localStorage when values change
  useEffect(() => {
    localStorage.setItem('gasCalculator_inputs', JSON.stringify(values));
  }, [values]);

  const updateValue = (key: keyof InputValues, value: any) => {
    onChange({ ...values, [key]: value });
  };

  const getSelectedGas = (): GasProps => {
    if (values.gasType === 'custom' && values.customGas) {
      return values.customGas;
    }
    return GASES[values.gasType as keyof typeof GASES] || GASES.air;
  };

  const handleGasChange = (gas: GasProps) => {
    if (gas.name === 'Custom Gas' || !Object.values(GASES).find(g => g.name === gas.name)) {
      updateValue('gasType', 'custom');
      updateValue('customGas', gas);
    } else {
      const gasKey = Object.entries(GASES).find(([_, g]) => g.name === gas.name)?.[0] || 'air';
      updateValue('gasType', gasKey);
      updateValue('customGas', undefined);
    }
  };

  return (
    <Card className="engineering-card">
      <CardHeader>
        <CardTitle className="gradient-text flex items-center justify-between">
          <span>Inputs</span>
          <Badge variant={process === 'blowdown' ? 'destructive' : 'default'}>
            {process === 'blowdown' ? 'Vessel Empties' : 'Vessel Fills'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Core Physical Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UnitInput
            label="Vessel Volume"
            type="volume"
            value={values.V}
            unit={values.V_unit}
            onChange={(v) => updateValue('V', v)}
            onUnitChange={(u) => updateValue('V_unit', u)}
            required
            min={0}
            error={values.V <= 0 ? 'Volume must be greater than 0' : undefined}
          />
          
          <UnitInput
            label="Temperature"
            type="temperature"
            value={values.T}
            unit={values.T_unit}
            onChange={(v) => updateValue('T', v)}
            onUnitChange={(u) => updateValue('T_unit', u)}
            required
          />
        </div>

        {/* Pressure Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UnitInput
            label={process === 'blowdown' ? 'Initial Pressure' : 'Initial Pressure'}
            type="pressure"
            value={values.P1}
            unit={values.P1_unit}
            onChange={(v) => updateValue('P1', v)}
            onUnitChange={(u) => updateValue('P1_unit', u)}
            required
            min={0}
          />
          
          <UnitInput
            label={process === 'blowdown' ? 'Final Pressure' : 'Target Pressure'}
            type="pressure"
            value={values.P2}
            unit={values.P2_unit}
            onChange={(v) => updateValue('P2', v)}
            onUnitChange={(u) => updateValue('P2_unit', u)}
            required
            min={0}
          />
        </div>

        {/* Supply Pressure for Filling */}
        {process === 'filling' && (
          <UnitInput
            label="Supply Pressure (Ps)"
            type="pressure"
            value={values.Ps || 15}
            unit={values.Ps_unit || 'bar'}
            onChange={(v) => updateValue('Ps', v)}
            onUnitChange={(u) => updateValue('Ps_unit', u)}
            required
            min={0}
          />
        )}

        {/* Orifice/Capillary Length */}
        <UnitInput
          label="Orifice/Capillary Length"
          type="length"
          value={values.L}
          unit={values.L_unit}
          onChange={(v) => updateValue('L', v)}
          onUnitChange={(u) => updateValue('L_unit', u)}
          required
          min={0}
        />

        {/* Solve-specific input */}
        {solveFor === 'TfromD' ? (
          <UnitInput
            label="Orifice Diameter"
            type="length"
            value={values.D || 5}
            unit={values.D_unit || 'mm'}
            onChange={(v) => updateValue('D', v)}
            onUnitChange={(u) => updateValue('D_unit', u)}
            required
            min={0}
            step="0.01"
          />
        ) : (
          <UnitInput
            label="Transfer Time"
            type="time"
            value={values.t || 60}
            unit={values.t_unit || 'second'}
            onChange={(v) => updateValue('t', v)}
            onUnitChange={(u) => updateValue('t_unit', u)}
            required
            min={0}
          />
        )}

        {/* Gas Selection */}
        <GasSelector
          selectedGas={getSelectedGas()}
          onGasChange={handleGasChange}
        />

        {/* Advanced Options */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between touch-target">
              <span className="flex items-center">
                <Settings className="w-4 h-4 mr-2" />
                Advanced Options
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Convergence Tolerance (ε)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={values.epsilon}
                  onChange={(e) => updateValue('epsilon', parseFloat(e.target.value) || 0.01)}
                  step="0.001"
                  min={0.001}
                  max={0.1}
                  placeholder="0.01"
                  className="w-full touch-target px-3 py-2 border border-border rounded-md bg-background text-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  We stop at P_f = P_2·(1{process === 'blowdown' ? '+' : '−'}ε) to avoid the endpoint singularity.
                </p>
                <p className="text-xs text-blue-600">
                  Default: 0.01 (1%). Increase to 1-2% if integration becomes too stiff.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Discharge Coefficient</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={values.Cd}
                  onChange={(e) => updateValue('Cd', parseFloat(e.target.value) || 0.62)}
                  step="0.01"
                  min={0.1}
                  max={1.0}
                  className="w-full touch-target px-3 py-2 border border-border rounded-md bg-background text-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  Sharp orifice: ~0.62, Rounded: ~0.8
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Thermodynamic Regime</label>
              <Select value={values.regime} onValueChange={(v: 'isothermal' | 'adiabatic') => updateValue('regime', v)}>
                <SelectTrigger className="bg-background border-border z-30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border-border shadow-elevated z-30">
                  <SelectItem value="isothermal" className="hover:bg-accent">
                    Isothermal (T = constant)
                  </SelectItem>
                  <SelectItem value="adiabatic" className="hover:bg-accent">
                    Adiabatic (T∝P^((γ-1)/γ))
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {values.gasType === 'custom' && (
              <div className="p-4 border border-border rounded-lg bg-muted/20">
                <h4 className="font-semibold mb-3">Custom Gas Properties</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">M (kg/mol)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.001"
                      min={0.001}
                      className="w-full touch-target px-3 py-2 border border-border rounded-md bg-background"
                      placeholder="0.029"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">γ (Cp/Cv)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min={1.01}
                      className="w-full touch-target px-3 py-2 border border-border rounded-md bg-background"
                      placeholder="1.4"
                    />
                  </div>
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};