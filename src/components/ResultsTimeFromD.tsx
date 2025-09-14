/**
 * Results display component for time from diameter calculations
 * Shows calculated time with unit conversion and optional debug information
 */

import { Card } from "@/components/ui/card";
import DevDump from "@/components/DevDump";

export function ResultsTimeFromD({ result, devNote, unitTime="s" }: any) {
  const t = result?.t_SI_s;
  const shown = unitTime==="s" ? t : unitTime==="min" ? t/60 : t/3600;
  return (
    <>
      <section className="card p-4">
        <div className="text-2xl font-bold">{Number.isFinite(shown) ? shown.toFixed(3) : "—"} {unitTime}</div>
      </section>
      <DevDump title="Time-from-D Debug" note={devNote ?? result?.debugNote} />
    </>
  );
}