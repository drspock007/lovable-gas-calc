import React from 'react';
import { AlertTriangle, Shield } from 'lucide-react';

export const SafetyFooter: React.FC = () => {
  return (
    <footer className="mt-12 mb-24 border-t border-border bg-muted/20">
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div className="space-y-3">
            <h3 className="font-semibold text-warning flex items-center">
              <Shield className="w-4 h-4 mr-1" />
              Safety Disclaimer
            </h3>
            <div className="text-xs text-muted-foreground space-y-2">
              <p>
                <strong>Engineering Use Only:</strong> This calculator provides theoretical estimates based on simplified models. 
                Results should be validated through testing and professional engineering analysis.
              </p>
              <p>
                <strong>Pressure Safety:</strong> High-pressure gas systems can be dangerous. Ensure proper safety measures, 
                pressure relief devices, and compliance with applicable codes and standards.
              </p>
              <p>
                <strong>Model Limitations:</strong> Calculations assume ideal gas behavior, steady-state conditions, 
                and simplified geometry. Real systems may exhibit significant deviations.
              </p>
              <p>
                <strong>Professional Responsibility:</strong> Users are responsible for verifying the applicability 
                of these models and ensuring safe system design and operation.
              </p>
            </div>
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                Version 1.0 • Last updated: September 2024 • 
                <a href="#" className="text-primary hover:underline">Report Issues</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};