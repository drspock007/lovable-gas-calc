import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BookOpen, Lightbulb } from 'lucide-react';
import { useI18n } from '@/i18n/context';
import 'katex/dist/katex.min.css';

// For now, we'll use styled math until KaTeX is fully integrated
const MathEquation: React.FC<{ children: string; className?: string }> = ({ 
  children, 
  className = "" 
}) => (
  <div className={`bg-muted/30 p-4 rounded-lg font-mono text-sm overflow-x-auto ${className}`}>
    {children}
  </div>
);

const InlineMath: React.FC<{ children: string }> = ({ children }) => (
  <code className="bg-muted/30 px-1 py-0.5 rounded text-sm font-mono">{children}</code>
);

export const ExplainCard: React.FC = () => {
  const { t } = useI18n();

  return (
    <Card className="engineering-card">
      <CardHeader>
        <CardTitle className="gradient-text flex items-center">
          <BookOpen className="w-5 h-5 mr-2" />
          Physics & Theory
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overview */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center">
            <Lightbulb className="w-4 h-4 mr-2" />
            Model Overview
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            This calculator uses two complementary models to predict gas transfer through orifices and capillaries:
            viscous Poiseuille flow for small channels and compressible orifice flow for large openings.
          </p>
        </div>

        <Separator />

        {/* Capillary Flow */}
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center">
            <Badge variant="outline" className="mr-2">Capillary</Badge>
            Poiseuille Flow Model
          </h3>
          
          <div>
            <h4 className="font-medium mb-2">Blowdown (Vessel Empties)</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Isothermal viscous flow with pressure-squared driving force:
            </p>
            <MathEquation>
              dP/dt = -(π D⁴)/(256 μ L V) × (P² - P₂²)
            </MathEquation>
            <p className="text-xs text-muted-foreground mt-2">
              Integrating from P₁ to Pf = P₂(1+ε) gives closed-form diameter:
            </p>
            <MathEquation className="mt-2">
              D = [128 μ L V / (π t P₂) × ln((P₁-P₂)(Pf+P₂) / (P₁+P₂)(Pf-P₂))]^(1/4)
            </MathEquation>
          </div>

          <div>
            <h4 className="font-medium mb-2">Filling (Vessel Fills)</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Supply pressure Ps drives flow into vessel:
            </p>
            <MathEquation>
              dP/dt = +(π D⁴)/(256 μ L V) × (Ps² - P²)
            </MathEquation>
            <MathEquation className="mt-2">
              D = [128 μ L V / (π t Ps) × ln((Ps-P₁)(Pf+Ps) / (Ps+P₁)(Pf-Ps))]^(1/4)
            </MathEquation>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded border border-blue-200 dark:border-blue-800">
            <h5 className="font-medium text-sm mb-2">Validity Requirements:</h5>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Reynolds number Re ≤ 2000 (laminar flow)</li>
              <li>• Length-to-diameter ratio L/D ≥ 10 (developed flow)</li>
              <li>• Pressure ratio P₁/P₂ ≤ 2 (incompressible assumption)</li>
            </ul>
          </div>
        </div>

        <Separator />

        {/* Orifice Flow */}
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center">
            <Badge variant="secondary" className="mr-2">Orifice</Badge>
            Compressible Flow Model
          </h3>

          <div>
            <h4 className="font-medium mb-2">Critical Flow Conditions</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Flow becomes sonic (choked) when downstream pressure drops below critical ratio:
            </p>
            <MathEquation>
              r* = (2/(γ+1))^(γ/(γ-1))
            </MathEquation>
            <p className="text-xs text-muted-foreground mt-2">
              For air (γ = 1.4): r* ≈ 0.528
            </p>
          </div>

          <div>
            <h4 className="font-medium mb-2">Mass Flow Rate</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Sonic flow (P₂/P₁ ≤ r*):
            </p>
            <MathEquation>
              ṁ = Cd × A × P₁ × C* where C* = √(γ/RT) × (2/(γ+1))^((γ+1)/(2(γ-1)))
            </MathEquation>
            
            <p className="text-sm text-muted-foreground mb-3 mt-4">
              Subsonic flow (P₂/P₁ &gt; r*):
            </p>
            <MathEquation>
              ṁ = Cd × A × P₁ × K × √[(P₂/P₁)^(2/γ) - (P₂/P₁)^((γ+1)/γ)]
            </MathEquation>
            <p className="text-xs text-muted-foreground mt-2">
              where K = √[2γ/(RT(γ-1))]
            </p>
          </div>

          <div>
            <h4 className="font-medium mb-2">Tank Pressure Evolution</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Mass conservation gives pressure rate:
            </p>
            <MathEquation>
              dP/dt = ±(RT/V) × ṁ
            </MathEquation>
            <p className="text-xs text-muted-foreground mt-2">
              Positive for filling, negative for blowdown
            </p>
          </div>

          <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded border border-orange-200 dark:border-orange-800">
            <h5 className="font-medium text-sm mb-2">Model Features:</h5>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Handles sonic and subsonic flow regimes</li>
              <li>• Accounts for compressibility effects</li>
              <li>• Split-phase integration for initially choked flows</li>
              <li>• Isothermal and adiabatic temperature models</li>
            </ul>
          </div>
        </div>

        <Separator />

        {/* Key Parameters */}
        <div className="space-y-3">
          <h3 className="font-semibold">Key Parameters</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <h5 className="font-medium">Symbols</h5>
              <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                <li><InlineMath>D</InlineMath> = Orifice diameter [m]</li>
                <li><InlineMath>P₁,P₂</InlineMath> = Initial, final pressure [Pa]</li>
                <li><InlineMath>V</InlineMath> = Vessel volume [m³]</li>
                <li><InlineMath>T</InlineMath> = Temperature [K]</li>
                <li><InlineMath>L</InlineMath> = Orifice length [m]</li>
              </ul>
            </div>
            <div>
              <h5 className="font-medium">Properties</h5>
              <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                <li><InlineMath>μ</InlineMath> = Dynamic viscosity [Pa⋅s]</li>
                <li><InlineMath>γ</InlineMath> = Heat capacity ratio [-]</li>
                <li><InlineMath>R</InlineMath> = Specific gas constant [J/kg⋅K]</li>
                <li><InlineMath>Cd</InlineMath> = Discharge coefficient [-]</li>
                <li><InlineMath>ε</InlineMath> = Convergence tolerance [-]</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded border border-yellow-200 dark:border-yellow-800">
          <h5 className="font-medium text-sm mb-2 flex items-center">
            ⚠️ Important Notes
          </h5>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• All pressures are absolute (gauge + atmospheric)</li>
            <li>• Models assume ideal gas behavior</li>
            <li>• Temperature effects on gas properties neglected</li>
            <li>• Sharp-edged orifice assumed (Cd ≈ 0.62)</li>
            <li>• Entrance/exit losses may require correction factors</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};