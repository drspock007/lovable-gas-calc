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
    let SI: any;
    try {
      SI = buildSI(values);
      
      // Garde Filling AVANT le forward Time-from-D (orifice)
      if (values.process === "filling") {
        if (!(SI.Ps_Pa > SI.Pf_Pa && SI.Pf_Pa > SI.P1_Pa && SI.P1_Pa > 0)) {
          throw { 
            message: "Invalid filling inequalities (require Ps_abs > Pf_abs > P1_abs > 0)",
            devNote: { 
              process: "filling", 
              inputs_SI: { Ps_Pa: SI.Ps_Pa, Pf_Pa: SI.Pf_Pa, P1_Pa: SI.P1_Pa } 
            } 
          };
        }
      }
      
      const res = computeTimeFromDiameter({
        ...values,
        __SI__: SI,
        model: values.modelSelection ?? values.model,
        debug,
      });
      setResult(res);
      setDevNote(res.debugNote ?? null);
    } catch (e: any) {
      const message = e?.message || "Calculation failed";
      const devNote = e?.devNote ?? { reason: message, inputs_SI: SI };
      setError(message);
      setDevNote(devNote);
    }
  }

  return { onCompute, result, error, devNote, debug };
}