/**
 * Results display component for time from diameter calculations
 * Shows calculated time with unit conversion and optional debug information
 */

import { Card } from "@/components/ui/card";

interface ResultsTimeFromDProps {
  result?: {
    t_SI_s: number;
    D_SI_m: number;
    A_SI_m2: number;
    model: "orifice" | "capillary";
  };
  debug?: boolean;
  unitTime?: "s" | "min" | "h";
}

export function ResultsTimeFromD({ result, debug, unitTime = "s" }: ResultsTimeFromDProps) {
  if (!result) {
    return (
      <Card className="p-6">
        <div className="text-muted-foreground">No results available</div>
      </Card>
    );
  }

  // 1) t = valeur SI du moteur
  const t_s = result.t_SI_s;
  const shown = unitTime === "s" ? t_s : unitTime === "min" ? t_s / 60 : t_s / 3600;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-primary">
            {shown.toFixed(3)} {unitTime}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Calculated time ({result.model} model)
          </div>
        </div>
        
        {debug && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <div className="text-xs text-muted-foreground space-y-1">
              <div>D_SI = {result.D_SI_m.toExponential(3)} m</div>
              <div>A_SI = {result.A_SI_m2.toExponential(3)} m²</div>
              <div>t_check = {result.t_SI_s.toFixed(6)} s</div>
              <div>Model: {result.model}</div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}