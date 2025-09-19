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
        model: values.modelSelection ?? values.model,
        debug,
      });
      setResult(res);
      setDevNote(res.debugNote ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Compute failed");
      setDevNote(e?.devNote ?? null);
    }
  }

  return { onCompute, result, error, devNote, debug };
}