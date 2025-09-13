import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { pressureFromSI, pressureToSI, volumeFromSI, volumeToSI, temperatureFromSI, temperatureToSI, lengthFromSI, lengthToSI, timeFromSI, timeToSI } from '@/lib/units';
import { parseDecimalFlexible, isValidDecimalString, normalizeDecimalString } from '@/lib/decimal-utils';
import { useI18n } from '@/i18n/context';

interface UnitSelectProps {
  type: 'pressure' | 'volume' | 'temperature' | 'length' | 'time';
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const UNIT_OPTIONS = {
  pressure: [
    { value: 'Pa', label: 'Pa' },
    { value: 'bar', label: 'bar' },
    { value: 'kPa', label: 'kPa' },
    { value: 'MPa', label: 'MPa' },
    { value: 'psi', label: 'psi' },
  ],
  volume: [
    { value: 'm3', label: 'm³' },
    { value: 'L', label: 'L' },
    { value: 'ft3', label: 'ft³' },
    { value: 'mm3', label: 'mm³' },
  ],
  temperature: [
    { value: 'kelvin', label: 'K' },
    { value: 'celsius', label: '°C' },
    { value: 'fahrenheit', label: '°F' },
  ],
  length: [
    { value: 'm', label: 'm' },
    { value: 'mm', label: 'mm' },
    { value: 'inch', label: 'in' },
  ],
  time: [
    { value: 'second', label: 's' },
    { value: 'minute', label: 'min' },
    { value: 'hour', label: 'h' },
  ],
};

export const UnitSelect: React.FC<UnitSelectProps> = ({ type, value, onChange, className }) => {
  const options = UNIT_OPTIONS[type];

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`w-20 bg-background border-border z-50 ${className}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-background border-border shadow-elevated z-50">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="hover:bg-accent">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

interface UnitInputProps {
  label: string;
  type: 'pressure' | 'volume' | 'temperature' | 'length' | 'time';
  value: number;
  unit: string;
  onChange: (value: number) => void;
  onUnitChange: (unit: string) => void;
  placeholder?: string;
  required?: boolean;
  step?: string;
  min?: number;
  error?: string;
  showToAtmosphereButton?: boolean;
  onToAtmosphere?: () => void;
}

export const UnitInput: React.FC<UnitInputProps> = ({
  label,
  type,
  value,
  unit,
  onChange,
  onUnitChange,
  placeholder,
  required = false,
  step = "0.001",
  min,
  error,
  showToAtmosphereButton = false,
  onToAtmosphere,
}) => {
  const { t } = useI18n();
  // Internal string state to prevent truncation during typing
  const [inputValue, setInputValue] = useState<string>('');
  const [hasError, setHasError] = useState<boolean>(false);
  
  // Initialize input value from prop
  useEffect(() => {
    if (value !== undefined && value !== null) {
      setInputValue(value.toString());
    }
  }, [value]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    setInputValue(rawValue);
    
    // Validate format but don't parse yet
    const isValid = isValidDecimalString(rawValue);
    setHasError(!isValid && rawValue.trim() !== '');
  };
  
  const handleBlur = () => {
    const normalizedValue = normalizeDecimalString(inputValue);
    const parsedValue = parseDecimalFlexible(normalizedValue);
    
    if (parsedValue !== null) {
      // Apply min validation if specified
      if (min !== undefined && parsedValue < min) {
        setHasError(true);
        return;
      }
      
      setHasError(false);
      onChange(parsedValue);
      // Update display value to normalized format
      setInputValue(parsedValue.toString());
    } else if (inputValue.trim() === '') {
      // Empty input is valid, pass 0 or handle as needed
      setHasError(false);
      onChange(0);
      setInputValue('');
    } else {
      // Invalid format
      setHasError(true);
    }
  };
  
  const handleToAtmosphere = () => {
    // Set raw input string to exactly "0"
    setInputValue('0');
    setHasError(false);
    // Trigger onChange with 0
    onChange(0);
    // Call parent callback if provided
    if (onToAtmosphere) {
      onToAtmosphere();
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow immediate calculation on Enter
    if (e.key === 'Enter') {
      handleBlur();
    }
  };
  
  return (
    <div className="space-y-2">
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
            required={required}
            className={`w-full touch-target px-3 py-2 border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent 
              [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
              hasError || error 
                ? 'border-destructive focus:ring-destructive' 
                : 'border-border'
            }`}
          />
          {(hasError || error) && (
            <p className="text-xs text-destructive mt-1">
              {error || 'Please enter a valid decimal number'}
            </p>
          )}
        </div>
        <UnitSelect type={type} value={unit} onChange={onUnitChange} />
        {showToAtmosphereButton && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleToAtmosphere}
            className="whitespace-nowrap self-start"
            type="button"
          >
            {t('chip.toAtmosphere')}
          </Button>
        )}
      </div>
    </div>
  );
};