import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UnitInput } from './UnitInput';
import { parseDecimalFlexible, validateInputForComputation } from '@/lib/decimal-utils';

/**
 * Demo component showing flexible decimal input handling
 * This demonstrates the new decimal input features:
 * - Accepts both comma and dot as decimal separators
 * - Validates on blur, not during typing
 * - Shows appropriate errors for invalid inputs
 * - Mobile-friendly decimal keypad
 */
export const DecimalInputDemo: React.FC = () => {
  const [volume, setVolume] = useState<number>(100);
  const [volumeUnit, setVolumeUnit] = useState<string>('L');
  const [pressure, setPressure] = useState<number>(10.5);
  const [pressureUnit, setPressureUnit] = useState<string>('bar');
  
  const [testResults, setTestResults] = useState<Array<{input: string, result: number | null}>>([]);
  
  const testInputs = [
    '123.45',    // Standard decimal with dot
    '123,45',    // European decimal with comma
    '123',       // Integer
    '0.001',     // Small decimal
    '1,234.56',  // This should fail (mixed separators)
    'abc',       // Invalid text
    '',          // Empty string
    '12.34.56',  // Multiple dots (invalid)
  ];
  
  const runTests = () => {
    const results = testInputs.map(input => ({
      input,
      result: parseDecimalFlexible(input)
    }));
    setTestResults(results);
  };
  
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Flexible Decimal Input Demo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Live Input Examples */}
        <div className="space-y-4">
          <h3 className="font-semibold">Try entering decimals with commas or dots:</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UnitInput
              label="Volume (try: 123,45 or 123.45)"
              type="volume"
              value={volume}
              unit={volumeUnit}
              onChange={setVolume}
              onUnitChange={setVolumeUnit}
              min={0}
            />
            
            <UnitInput
              label="Pressure (try: 10,5 or 10.5)"
              type="pressure"
              value={pressure}
              unit={pressureUnit}
              onChange={setPressure}
              onUnitChange={setPressureUnit}
              min={0}
            />
          </div>
          
          <div className="p-3 bg-secondary/50 rounded">
            <p className="text-sm">
              <strong>Current values:</strong> Volume = {volume} {volumeUnit}, Pressure = {pressure} {pressureUnit}
            </p>
          </div>
        </div>
        
        {/* Parsing Test Results */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Decimal Parsing Tests</h3>
            <button 
              onClick={runTests}
              className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
            >
              Run Tests
            </button>
          </div>
          
          {testResults.length > 0 && (
            <div className="space-y-2">
              {testResults.map(({ input, result }, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-background border rounded">
                  <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                    "{input}"
                  </code>
                  <span className={`text-sm font-mono ${result !== null ? 'text-green-600' : 'text-red-500'}`}>
                    {result !== null ? result.toString() : 'null (invalid)'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Mobile Instructions */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded">
          <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
            Mobile Features:
          </h4>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>• Decimal keypad automatically appears on mobile devices</li>
            <li>• Type validation happens on blur, not during typing</li>
            <li>• Both comma (,) and dot (.) work as decimal separators</li>
            <li>• Error messages guide you to correct format</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};