import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Atom } from 'lucide-react';
import { GASES } from '@/lib/physics';
import type { GasProps } from '@/lib/physics';

interface GasSelectorProps {
  selectedGas: GasProps;
  onGasChange: (gas: GasProps) => void;
}

interface CustomGasInputs {
  name: string;
  M: string;
  gamma: string;
  mu: string;
}

const GAS_OPTIONS = [
  { value: 'air', label: 'Air', gas: GASES.air },
  { value: 'N2', label: 'Nitrogen (N₂)', gas: GASES.N2 },
  { value: 'O2', label: 'Oxygen (O₂)', gas: GASES.O2 },
  { value: 'CH4', label: 'Methane (CH₄)', gas: GASES.CH4 },
  { value: 'CO2', label: 'Carbon Dioxide (CO₂)', gas: GASES.CO2 },
  { value: 'He', label: 'Helium (He)', gas: GASES.He },
];

export const GasSelector: React.FC<GasSelectorProps> = ({ selectedGas, onGasChange }) => {
  const [selectedOption, setSelectedOption] = useState<string>('air');
  const [isCustom, setIsCustom] = useState(false);
  const [customInputs, setCustomInputs] = useState<CustomGasInputs>({
    name: 'Custom Gas',
    M: '0.029',
    gamma: '1.4',
    mu: '18.1e-6',
  });

  // Load from localStorage on mount
  useEffect(() => {
    const savedGas = localStorage.getItem('gasTransfer-selectedGas');
    if (savedGas) {
      try {
        const parsed = JSON.parse(savedGas);
        if (parsed.isCustom) {
          setIsCustom(true);
          setSelectedOption('custom');
          setCustomInputs(parsed.customInputs);
          onGasChange(parsed.gas);
        } else {
          const builtInOption = GAS_OPTIONS.find(opt => opt.value === parsed.option);
          if (builtInOption) {
            setSelectedOption(parsed.option);
            setIsCustom(false);
            onGasChange(builtInOption.gas);
          }
        }
      } catch (error) {
        console.warn('Failed to load saved gas from localStorage:', error);
      }
    }
  }, [onGasChange]);

  // Save to localStorage whenever gas changes
  useEffect(() => {
    const saveData = {
      option: selectedOption,
      isCustom,
      customInputs: isCustom ? customInputs : undefined,
      gas: selectedGas,
    };
    localStorage.setItem('gasTransfer-selectedGas', JSON.stringify(saveData));
  }, [selectedOption, isCustom, customInputs, selectedGas]);

  const handleGasChange = (value: string) => {
    if (value === 'custom') {
      setIsCustom(true);
      setSelectedOption('custom');
      handleCustomGasUpdate();
    } else {
      setIsCustom(false);
      setSelectedOption(value);
      const selectedGasOption = GAS_OPTIONS.find(opt => opt.value === value);
      if (selectedGasOption) {
        onGasChange(selectedGasOption.gas);
      }
    }
  };

  const handleCustomInputChange = (field: keyof CustomGasInputs, value: string) => {
    setCustomInputs(prev => ({ ...prev, [field]: value }));
  };

  const handleCustomGasUpdate = () => {
    const M = parseFloat(customInputs.M);
    const gamma = parseFloat(customInputs.gamma);
    const mu = parseFloat(customInputs.mu);

    if (isNaN(M) || isNaN(gamma) || isNaN(mu) || M <= 0 || gamma <= 1 || mu <= 0) {
      return; // Invalid inputs
    }

    // Calculate R from M using universal gas constant
    const R = 8.314462618 / M; // J/(kg·K)

    const customGas: GasProps = {
      name: customInputs.name || 'Custom Gas',
      M,
      R,
      gamma,
      mu,
    };

    onGasChange(customGas);
  };

  // Auto-update custom gas when inputs change
  useEffect(() => {
    if (isCustom) {
      handleCustomGasUpdate();
    }
  }, [customInputs, isCustom]);

  const PropertyTooltip: React.FC<{ property: keyof GasProps; value: number; unit: string; description: string }> = ({ 
    property, value, unit, description 
  }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground cursor-help">
            <Info className="w-3 h-3" />
            <span className="font-mono">
              {property === 'M' && 'M'}
              {property === 'R' && 'R'}
              {property === 'gamma' && 'γ'}
              {property === 'mu' && 'μ'}
            </span>
            <span>= {value.toExponential(3)} {unit}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{description}</p>
            <p className="text-xs opacity-80">
              {property === 'M' && 'Molecular weight affects flow rate and density'}
              {property === 'R' && 'Calculated as R = 8.314 / M'}
              {property === 'gamma' && 'Affects compressibility and sonic velocity'}
              {property === 'mu' && 'Affects viscous losses in capillary flow'}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Atom className="w-4 h-4" />
          Gas Properties
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="gas-select">Gas Type</Label>
          <Select value={selectedOption} onValueChange={handleGasChange}>
            <SelectTrigger id="gas-select" className="h-12">
              <SelectValue placeholder="Select gas" />
            </SelectTrigger>
            <SelectContent className="z-[9999]">
              {GAS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom Gas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isCustom ? (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="custom-name">Gas Name</Label>
                <Input
                  id="custom-name"
                  value={customInputs.name}
                  onChange={(e) => handleCustomInputChange('name', e.target.value)}
                  placeholder="e.g., Argon"
                  className="h-10"
                />
              </div>
              
              <div>
                <Label htmlFor="custom-M" className="flex items-center gap-1">
                  Molecular Weight (M)
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Molecular weight in kg/mol</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Input
                  id="custom-M"
                  type="number"
                  step="0.001"
                  value={customInputs.M}
                  onChange={(e) => handleCustomInputChange('M', e.target.value)}
                  placeholder="0.029"
                  className="h-10 font-mono"
                  inputMode="decimal"
                />
                <p className="text-xs text-muted-foreground mt-1">kg/mol</p>
              </div>

              <div>
                <Label htmlFor="custom-gamma" className="flex items-center gap-1">
                  Heat Capacity Ratio (γ)
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Ratio of specific heats Cp/Cv</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Input
                  id="custom-gamma"
                  type="number"
                  step="0.01"
                  value={customInputs.gamma}
                  onChange={(e) => handleCustomInputChange('gamma', e.target.value)}
                  placeholder="1.4"
                  className="h-10 font-mono"
                  inputMode="decimal"
                />
                <p className="text-xs text-muted-foreground mt-1">dimensionless</p>
              </div>

              <div className="col-span-2">
                <Label htmlFor="custom-mu" className="flex items-center gap-1">
                  Dynamic Viscosity (μ)
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Dynamic viscosity at operating temperature</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Input
                  id="custom-mu"
                  type="number"
                  step="1e-7"
                  value={customInputs.mu}
                  onChange={(e) => handleCustomInputChange('mu', e.target.value)}
                  placeholder="18.1e-6"
                  className="h-10 font-mono"
                  inputMode="decimal"
                />
                <p className="text-xs text-muted-foreground mt-1">Pa·s</p>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>• R will be calculated automatically as 8.314 / M</p>
              <p>• Typical γ values: monatomic ~1.67, diatomic ~1.4, polyatomic ~1.3</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <h4 className="font-medium text-sm">{selectedGas.name} Properties</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <PropertyTooltip
                property="M"
                value={selectedGas.M}
                unit="kg/mol"
                description="Molecular Weight"
              />
              <PropertyTooltip
                property="R"
                value={selectedGas.R}
                unit="J/(kg·K)"
                description="Specific Gas Constant"
              />
              <PropertyTooltip
                property="gamma"
                value={selectedGas.gamma}
                unit=""
                description="Heat Capacity Ratio (Cp/Cv)"
              />
              <PropertyTooltip
                property="mu"
                value={selectedGas.mu}
                unit="Pa·s"
                description="Dynamic Viscosity @ 20°C"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};