import { parseDecimalLoose } from "@/lib/num-parse";
import { toSI_Length } from "@/lib/length-units";
import { areaFromDiameterSI } from "@/lib/geometry";

it("0.005 mm is 5e-6 m and computes area", () => {
  const D_raw = parseDecimalLoose("0.005");
  expect(D_raw).toBeCloseTo(0.005, 10);
  const D_SI = toSI_Length(D_raw, "mm");
  expect(D_SI).toBeCloseTo(5e-6, 12);
  const A = areaFromDiameterSI(D_SI);
  expect(A).toBeGreaterThan(1e-12);
  expect(A).toBeLessThan(1e-9);
});