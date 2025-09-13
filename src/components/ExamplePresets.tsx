import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { BookOpen, Play, Download, Atom, Settings } from 'lucide-react';
import { useI18n } from '@/i18n/context';
import { useToast } from '@/hooks/use-toast';
import { GASES } from '@/lib/physics';
import type { InputValues } from './InputsCard';

interface ExamplePreset {
  id: string;
  name: string;
  description: string;
  category: 'blowdown' | 'filling' | 'capillary';
  inputs: Partial<InputValues>;
  expectedResult?: string;
  learningPoints: string[];
}

interface ExamplePresetsProps {
  onLoadPreset: (inputs: Partial<InputValues>, process?: 'blowdown' | 'filling', solveFor?: 'DfromT' | 'TfromD') => void;
}

const EXAMPLE_PRESETS: ExamplePreset[] = [
  {
    id: 'air-blowdown-orifice',
    name: 'Air Blowdown - Thin Plate',
    description: 'Small pressure vessel with thin orifice plate - demonstrates choked flow',
    category: 'blowdown',
    inputs: {
      // Process settings (not part of InputValues)
      // process: 'blowdown',
      // solveFor: 'DfromT',
      V: 50,           // 50L small tank
      V_unit: 'liter',
      P1: 10,          // 10 bar initial
      P1_unit: 'bar',
      P2: 1,           // 1 bar final (atmospheric)
      P2_unit: 'bar',
      T: 20,           // 20°C
      T_unit: 'celsius',
      L: 2,            // 2mm thin plate (L/D < 10)
      L_unit: 'mm',
      t: 30,           // 30 seconds
      t_unit: 'second',
      gasType: 'air',
      regime: 'isothermal',
      Cd: 0.62,
      epsilon: 0.01,
    },
    expectedResult: 'D ≈ 3-5 mm',
    learningPoints: [
      'Thin plate (L/D < 10) → Orifice model dominant',
      'High pressure ratio → Choked flow likely', 
      'Fast blowdown → Check Re validity',
      'Cd = 0.62 typical for sharp-edged orifice'
    ]
  },
  {
    id: 'n2-capillary-path',
    name: 'N₂ Capillary Flow',
    description: 'Long capillary tube with nitrogen - demonstrates viscous flow',
    category: 'capillary',
    inputs: {
      // Process settings
      // process: 'filling', 
      // solveFor: 'TfromD',
      V: 10,           // 10L vessel
      V_unit: 'liter',
      P1: 1,           // 1 bar initial
      P1_unit: 'bar',
      P2: 5,           // 5 bar final
      P2_unit: 'bar',
      Ps: 6,           // 6 bar supply
      Ps_unit: 'bar',
      T: 25,           // 25°C
      T_unit: 'celsius',
      L: 100,          // 100mm long capillary
      L_unit: 'mm',
      D: 1,            // 1mm diameter (L/D = 100 ≫ 10)
      D_unit: 'mm',
      gasType: 'N2',
      regime: 'isothermal',
      Cd: 0.62,
      epsilon: 0.01,
    },
    expectedResult: 't ≈ 5-15 minutes',
    learningPoints: [
      'Long tube (L/D = 100 ≫ 10) → Capillary model valid',
      'Low Re expected → Laminar flow dominates',
      'Viscous losses significant → Slower than orifice',
      'N₂ properties affect flow rate vs air'
    ]
  },
  {
    id: 'ch4-filling-adiabatic',
    name: 'CH₄ Adiabatic Filling',
    description: 'Methane vessel filling with temperature effects - demonstrates adiabatic process',
    category: 'filling',
    inputs: {
      // Process settings
      // process: 'filling',
      // solveFor: 'TfromD',
      V: 200,          // 200L larger vessel
      V_unit: 'liter',
      P1: 2,           // 2 bar initial
      P1_unit: 'bar',
      P2: 15,          // 15 bar final (high pressure)
      P2_unit: 'bar',
      Ps: 20,          // 20 bar supply
      Ps_unit: 'bar',
      T: 15,           // 15°C (cool temperature)
      T_unit: 'celsius',
      L: 10,           // 10mm thick wall
      L_unit: 'mm',
      D: 8,            // 8mm diameter
      D_unit: 'mm',
      gasType: 'CH4',
      regime: 'adiabatic',  // Key difference!
      Cd: 0.62,
      epsilon: 0.01,
    },
    expectedResult: 't ≈ 2-8 minutes',
    learningPoints: [
      'Adiabatic process → Temperature changes during filling',
      'CH₄ properties (γ=1.32) → Different from air',
      'High pressure filling → Compressibility effects',
      'Compare with isothermal case to see temperature impact'
    ]
  }
];

export const ExamplePresets: React.FC<ExamplePresetsProps> = ({ onLoadPreset }) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedPreset, setExpandedPreset] = useState<string | null>(null);

  const filteredPresets = selectedCategory === 'all' 
    ? EXAMPLE_PRESETS 
    : EXAMPLE_PRESETS.filter(preset => preset.category === selectedCategory);

  const handleLoadPreset = (preset: ExamplePreset) => {
    // Extract process and solveFor from preset category and description
    const process = preset.category === 'blowdown' ? 'blowdown' : 'filling';
    const solveFor = preset.name.includes('Time') || preset.id.includes('TfromD') ? 'TfromD' : 'DfromT';
    
    onLoadPreset(preset.inputs, process, solveFor);
    
    // Cache preset for offline use
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_PRESET',
        preset: preset
      });
    }
    
    toast({
      title: t('success.calculated'),
      description: `Loaded preset: ${preset.name}`,
      duration: 3000,
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'blowdown': return '⬇️';
      case 'filling': return '⬆️';
      case 'capillary': return '🧪';
      default: return '📋';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'blowdown': return 'destructive';
      case 'filling': return 'default';
      case 'capillary': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <Card className="engineering-card">
      <CardHeader>
        <CardTitle className="gradient-text flex items-center">
          <BookOpen className="w-5 h-5 mr-2" />
          {t('equations.title')} - Example Presets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t('gasType')}:</span>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Examples</SelectItem>
              <SelectItem value="blowdown">Blowdown</SelectItem>
              <SelectItem value="filling">Filling</SelectItem>
              <SelectItem value="capillary">Capillary</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Presets List */}
        <div className="space-y-3">
          {filteredPresets.map((preset) => (
            <div key={preset.id} className="border rounded-lg p-4 space-y-3">
              {/* Preset Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{getCategoryIcon(preset.category)}</span>
                    <h3 className="font-semibold">{preset.name}</h3>
                    <Badge variant={getCategoryColor(preset.category) as any}>
                      {preset.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {preset.description}
                  </p>
                  {preset.expectedResult && (
                    <p className="text-xs text-primary font-medium">
                      Expected: {preset.expectedResult}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedPreset(expandedPreset === preset.id ? null : preset.id)}
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleLoadPreset(preset)}
                    className="flex items-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Load
                  </Button>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedPreset === preset.id && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    {/* Input Summary */}
                    <div>
                      <h4 className="font-medium text-sm mb-2">Key Parameters:</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>Gas: <span className="font-mono">{preset.inputs.gasType}</span></div>
                        <div>Volume: <span className="font-mono">{preset.inputs.V} {preset.inputs.V_unit}</span></div>
                        <div>Regime: <span className="font-mono">{preset.inputs.regime}</span></div>
                        {preset.inputs.P1 && <div>P₁: <span className="font-mono">{preset.inputs.P1} {preset.inputs.P1_unit}</span></div>}
                        {preset.inputs.P2 && <div>P₂: <span className="font-mono">{preset.inputs.P2} {preset.inputs.P2_unit}</span></div>}
                        {preset.inputs.L && <div>L: <span className="font-mono">{preset.inputs.L} {preset.inputs.L_unit}</span></div>}
                        {preset.inputs.D && <div>D: <span className="font-mono">{preset.inputs.D} {preset.inputs.D_unit}</span></div>}
                      </div>
                    </div>

                    {/* Learning Points */}
                    <div>
                      <h4 className="font-medium text-sm mb-2">Learning Points:</h4>
                      <ul className="text-xs space-y-1">
                        {preset.learningPoints.map((point, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Educational Note */}
        <div className="mt-6 p-3 bg-muted/50 rounded border border-primary/20">
          <div className="flex items-start gap-2">
            <Atom className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">💡 Engineering Tips:</p>
              <p>These presets demonstrate different flow regimes and model validity. Compare results between isothermal/adiabatic, capillary/orifice, and different gases to understand the physics.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};