import { areaFromDiameterSI } from "@/lib/geometry";
import { timeOrificeFromAreaSI } from "@/lib/physics";

const SI = { V_SI_m3:2e-7, P1_Pa:1.2e6, P2_Pa:1e3, T_K:288.15,
             L_m:0.002, gas:{R:287.06196, gamma:1.4, mu:1.825e-5}, Cd:0.62, epsilon:0.01 };

it("D=9 µm → t ~ 175 s (±15%)", () => {
  const A = areaFromDiameterSI(9e-6);
  const t = timeOrificeFromAreaSI(SI, A);
  expect(t).toBeGreaterThan(150); expect(t).toBeLessThan(200);
});

it("D=5 µm → t ~ 540 s (±20%)", () => {
  const A = areaFromDiameterSI(5e-6);
  const t = timeOrificeFromAreaSI(SI, A);
  expect(t).toBeGreaterThan(400); expect(t).toBeLessThan(700);
});

// échelle ~1/A
it("scaling: t ∝ 1/A", () => {
  const t1 = timeOrificeFromAreaSI(SI, 2e-11);
  const t2 = timeOrificeFromAreaSI(SI, 1e-11);
  expect(t2/t1).toBeCloseTo(2, 0);
});