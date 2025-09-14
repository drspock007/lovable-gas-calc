import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, ArrowUp, Timer, Ruler, Zap, Waves } from 'lucide-react';
import { useI18n } from '@/i18n/context';

export type ProcessType = 'blowdown' | 'filling';
export type SolveForType = 'DfromT' | 'TfromD';
export type ModelSelectionType = 'orifice' | 'capillary';

interface ModeSelectorProps {
  process: ProcessType;
  solveFor: SolveForType;
  modelSelection: ModelSelectionType;
  onProcessChange: (process: ProcessType) => void;
  onSolveForChange: (solveFor: SolveForType) => void;
  onModelSelectionChange: (model: ModelSelectionType) => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({ 
  process, 
  solveFor, 
  modelSelection,
  onProcessChange, 
  onSolveForChange,
  onModelSelectionChange
}) => {
  const { t } = useI18n();

  return (
    <Card className="engineering-card">
      <CardHeader>
        <CardTitle className="gradient-text flex items-center">
          <Badge variant="outline" className="mr-2">Mode</Badge>
          Process & Calculation Type
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Process Type */}
        <div>
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Process Type</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={process === 'blowdown' ? 'default' : 'outline'}
              onClick={() => onProcessChange('blowdown')}
              className="touch-target justify-center h-16 flex-col"
            >
              <ArrowDown className="w-5 h-5 mb-1" />
              <span className="text-xs">Blowdown</span>
              <span className="text-xs text-muted-foreground">Vessel empties</span>
            </Button>
            <Button
              variant={process === 'filling' ? 'default' : 'outline'}
              onClick={() => onProcessChange('filling')}
              className="touch-target justify-center h-16 flex-col"
            >
              <ArrowUp className="w-5 h-5 mb-1" />
              <span className="text-xs">Filling</span>
              <span className="text-xs text-muted-foreground">Vessel fills</span>
            </Button>
          </div>
        </div>

        {/* Solve For Type */}
        <div>
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Calculate</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={solveFor === 'DfromT' ? 'default' : 'outline'}
              onClick={() => onSolveForChange('DfromT')}
              className="touch-target justify-center h-16 flex-col"
            >
              <Ruler className="w-5 h-5 mb-1" />
              <span className="text-xs">Diameter</span>
              <span className="text-xs text-muted-foreground">from time</span>
            </Button>
            <Button
              variant={solveFor === 'TfromD' ? 'default' : 'outline'}
              onClick={() => onSolveForChange('TfromD')}
              className="touch-target justify-center h-16 flex-col"
            >
              <Timer className="w-5 h-5 mb-1" />
              <span className="text-xs">Time</span>
              <span className="text-xs text-muted-foreground">from diameter</span>
            </Button>
          </div>
        </div>

        {/* Flow Model */}
        <div>
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Flow Model</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={modelSelection === 'orifice' ? 'default' : 'outline'}
              onClick={() => onModelSelectionChange('orifice')}
              className="touch-target justify-center h-16 flex-col"
            >
              <Zap className="w-5 h-5 mb-1" />
              <span className="text-xs">Orifice</span>
              <span className="text-xs text-muted-foreground">Sharp edge</span>
            </Button>
            <Button
              variant={modelSelection === 'capillary' ? 'default' : 'outline'}
              onClick={() => onModelSelectionChange('capillary')}
              className="touch-target justify-center h-16 flex-col"
            >
              <Waves className="w-5 h-5 mb-1" />
              <span className="text-xs">Capillary</span>
              <span className="text-xs text-muted-foreground">Poiseuille</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};