/**
 * Results display component for time from diameter calculations
 * Shows calculated time with unit conversion and optional debug information
 */

import { Card } from "@/components/ui/card";

export function ResultsTimeFromD({ result, unitTime="s", debug }: any){
  const t = result?.t_SI_s ?? NaN;
  const shown = unitTime==="s" ? t : unitTime==="min" ? t/60 : t/3600;
  return (
    <div className="card">
      <div className="text-2xl font-bold">{Number.isFinite(shown) ? shown.toFixed(3) : "—"} {unitTime}</div>
      {debug && (
        <div className="mt-1 text-xs opacity-70">
          model={result.model} · D_SI={result.D_SI_m} m · A_SI={result.A_SI_m2} m² · t={result.t_SI_s} s
        </div>
      )}
    </div>
  );
}