/**
 * Results display component for time from diameter calculations
 * Shows calculated time with unit conversion and optional debug information
 */

import { Card } from "@/components/ui/card";
import DevDump from "@/components/DevDump";
import { ResidualDetails } from "@/components/ResidualDetails";
import { ErrorDebugPanel } from "@/components/ErrorDebugPanel";
import { formatTimeDisplay } from "@/lib/time-format";
import { useDebug } from "@/lib/debug-context";

export function ResultsTimeFromD({ result, error, devNote, unitTime="s", computeDisabledReason }: any) {
  const { debug } = useDebug();
  const t = result?.t_SI_s;
  
  // Use smart time formatting instead of manual conversion
  const timeDisplay = t ? formatTimeDisplay(t, 3) : null;
  
  // Unified devNote - prioritize result debugNote, then devNote prop, then error devNote
  const note = result?.debugNote ?? devNote ?? error?.devNote ?? null;
  
  return (
    <>
      <section className="card p-4">
        {timeDisplay && Number.isFinite(timeDisplay.raw_value) ? (
          <>
            <div className="text-2xl font-bold">{timeDisplay.t_display} {timeDisplay.time_unit_used}</div>
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
        
        {/* Error Debug Panel - Always shown when calculation fails and has devNote */}
        {(!timeDisplay || !Number.isFinite(timeDisplay.raw_value)) && (
          <ErrorDebugPanel 
            error={error}
            devNote={devNote}
          />
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