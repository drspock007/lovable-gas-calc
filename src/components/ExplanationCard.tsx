import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';
import { useI18n } from '@/i18n/context';
import 'katex/dist/katex.min.css';

// We'll add KaTeX rendering later
const MathEquation: React.FC<{ children: string }> = ({ children }) => (
  <div className="bg-muted p-3 rounded-lg font-mono text-sm">
    {children}
  </div>
);

export const ExplanationCard: React.FC = () => {
  const { t } = useI18n();

  return (
    <Card className="engineering-card">
      <CardHeader>
        <CardTitle className="gradient-text flex items-center">
          <BookOpen className="w-5 h-5 mr-2" />
          {t.common.explanation}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t.calculator.results.explanation}
        </p>
        
        <div>
          <h4 className="font-semibold mb-2">Key Equations:</h4>
          
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium mb-1">Mass Flow Rate (Choked):</p>
              <MathEquation>
                dm/dt = C_d × A × ρ₁ × √(γ × P₁ / ρ₁) × √((2/(γ+1))^((γ+1)/(γ-1)))
              </MathEquation>
            </div>
            
            <div>
              <p className="text-sm font-medium mb-1">Critical Pressure Ratio:</p>
              <MathEquation>
                P_crit/P₁ = (2/(γ+1))^(γ/(γ-1))
              </MathEquation>
            </div>
            
            <div>
              <p className="text-sm font-medium mb-1">Orifice Area:</p>
              <MathEquation>
                A = π × (D/2)²
              </MathEquation>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Where:</strong></p>
          <p>• C_d = Discharge coefficient (≈0.62 for sharp-edged orifice)</p>
          <p>• A = Orifice cross-sectional area</p>
          <p>• ρ₁ = Upstream gas density</p>
          <p>• γ = Heat capacity ratio (Cp/Cv)</p>
          <p>• P₁ = Upstream pressure</p>
          <p>• D = Orifice diameter</p>
        </div>
      </CardContent>
    </Card>
  );
};