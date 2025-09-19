/**
 * Results display component for time from diameter calculations
 * Shows calculated time with unit conversion and optional debug information
 */

import { Card } from "@/components/ui/card";
import DevDump from "@/components/DevDump";
import { useDebug } from "@/lib/debug-context";

export function ResultsTimeFromD({ result, error, devNote, unitTime="s", computeDisabledReason }: any) {
  const { debug } = useDebug();
  const t = result?.t_SI_s;
  const shown = unitTime==="s" ? t : unitTime==="min" ? t/60 : t/3600;
  
  // Unified devNote - prioritize result debugNote, then devNote prop, then error devNote
  const note = result?.debugNote ?? devNote ?? error?.devNote ?? null;
  
  return (
    <>
      <section className="card p-4">
        {Number.isFinite(shown) ? (
          <>
            <div className="text-2xl font-bold">{shown.toFixed(3)} {unitTime}</div>
            {result?.model && (
              <div className="text-sm text-muted-foreground mt-1">Model: {result.model}</div>
            )}
          </>
        ) : (
          <div className="text-red-600">
            <div className="text-lg font-semibold">Calculation failed</div>
            <div className="text-sm mt-1">
              {error?.message || "Check input parameters and debug information below"}
            </div>
          </div>
        )}
        
        {/* Debug info for disabled compute button */}
        {debug && computeDisabledReason && (
          <div className="text-xs text-muted-foreground mt-2 border-t pt-2">
            disabled=true · reason={computeDisabledReason}
          </div>
        )}
      </section>
      
      {/* DevDump - Always shown when debug is ON and note exists, regardless of success/failure */}
      {debug && note && (
        <DevDump 
          title="Time-from-D Debug" 
          note={note} 
        />
      )}
    </>
  );
}