import { useDebug } from "@/lib/debug-context";
import { buildSI } from "@/lib/build-si";
import { computeTimeFromDiameter } from "@/lib/pipeline-time-from-d";
import { useState } from "react";

export function useComputeTimeFromD(values: any) {
  const { debug } = useDebug();
  const [devNote, setDevNote] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function onCompute() {
    setError(null);
    try {
      const SI = buildSI(values);
      const res = computeTimeFromDiameter({
        ...values,
        __SI__: SI,
        modelOverride: values.modelSelection ?? values.model,
        debug,
      });
      setResult(res);
      if (debug) {
        setDevNote({
          diameter: values.diameter,
          diameterUnit: values.diameterUnit,
          D_SI_m: res.D_SI_m,
          A_SI_m2: res.A_SI_m2,
          model: res.model
        });
      }
    } catch (e: any) {
      setError(e?.message ?? "Compute failed");
    }
  }

  return { onCompute, result, error, devNote, debug };
}