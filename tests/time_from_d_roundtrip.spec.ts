import { areaFromDiameterSI } from "@/lib/geometry";
import { timeOrificeFromAreaSI } from "@/lib/physics";

it("Time from D (orifice, isothermal): D≈9 µm → t≈175 s", () => {
  const SI = {
    V_SI_m3: 2e-7, P1_Pa: 1.2e6, P2_Pa: 1e3, T_K: 288.15,
    L_m: 0.002, gas: { R: 287.06196, gamma: 1.4, mu: 1.825e-5 },
    Cd: 0.62, epsilon: 0.01, regime: "isothermal"
  };
  const D = 9e-6; // 9 µm
  const A = areaFromDiameterSI(D);
  const t = timeOrificeFromAreaSI(SI, A);
  expect(t).toBeGreaterThan(150);
  expect(t).toBeLessThan(200);
});