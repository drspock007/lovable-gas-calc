import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseDecimalLoose } from '@/lib/num-parse';
import { normalizeLengthUnit, LENGTH_LABEL, type LengthUnit } from '@/lib/length-units';

interface OrificeDiameterFieldProps {
  label: string;
  value: number;
  unit: string;
  onChange: (value: number) => void;
  onUnitChange: (unit: string) => void;
  placeholder?: string;
  className?: string;
  error?: string;
}

const DIAMETER_UNITS = [
  { value: 'm', label: 'm' },
  { value: 'mm', label: 'mm' },
  { value: 'cm', label: 'cm' },
  { value: 'µm', label: 'µm' },
];

export const OrificeDiameterField: React.FC<OrificeDiameterFieldProps> = ({
  label,
  value,
  unit,
  onChange,
  onUnitChange,
  placeholder,
  className,
  error,
}) => {
  // Internal string state to prevent truncation during typing
  const [inputValue, setInputValue] = useState<string>('');
  const [hasError, setHasError] = useState<boolean>(false);
  
  // Initialize input value from prop
  useEffect(() => {
    if (value !== undefined && value !== null && Number.isFinite(value)) {
      setInputValue(value.toString());
    }
  }, [value]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    setInputValue(rawValue);
    
    // Basic validation - allow partial inputs during typing
    const isValidPartial = /^-?\d*([.,]\d*)?$/.test(rawValue) || rawValue === '';
    setHasError(!isValidPartial && rawValue.trim() !== '');
  };
  
  const handleBlur = () => {
    const parsedValue = parseDecimalLoose(inputValue);
    
    if (Number.isFinite(parsedValue) && parsedValue >= 0) {
      setHasError(false);
      onChange(parsedValue);
      // Update display value to normalized format
      setInputValue(parsedValue.toString());
    } else if (inputValue.trim() === '') {
      // Empty input - use a small default value
      setHasError(false);
      onChange(0.001); // 1mm default
      setInputValue('0.001');
    } else {
      // Invalid format - keep error state
      setHasError(true);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow immediate validation on Enter
    if (e.key === 'Enter') {
      handleBlur();
    }
  };
  
  const handleUnitChange = (newUnit: string) => {
    const normalizedUnit = normalizeLengthUnit(newUnit);
    onUnitChange(normalizedUnit);
  };
  
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="text"
            inputMode="decimal"
            pattern="^-?\\d*([.,]\\d*)?$"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`w-full touch-target px-3 py-2 border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent 
              [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
              hasError || error 
                ? 'border-destructive focus:ring-destructive' 
                : 'border-border'
            }`}
          />
          {(hasError || error) && (
            <p className="text-xs text-destructive mt-1">
              {error || 'Please enter a valid diameter value'}
            </p>
          )}
        </div>
        <Select value={unit} onValueChange={handleUnitChange}>
          <SelectTrigger className="w-20 bg-background border-border z-50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background border-border shadow-elevated z-50">
            {DIAMETER_UNITS.map((option) => (
              <SelectItem key={option.value} value={option.value} className="hover:bg-accent">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
