import { timeOrificeFromAreaSI } from "@/lib/physics";

it("scaling 1/A", () => {
  const SI = { V_SI_m3:2e-7, P1_Pa:1.2e6, P2_Pa:1e3, T_K:288.15,
               L_m:0.002, gas:{R:287.06, gamma:1.4, mu:1.825e-5}, Cd:0.62, epsilon:0.01 };
  const t1 = timeOrificeFromAreaSI(SI, 1e-10);
  const t2 = timeOrificeFromAreaSI(SI, 5e-11);
  expect(t2/t1).toBeCloseTo(2, 1); // environ 2 (tolérance large)
});