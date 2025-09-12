import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { pressureFromSI, pressureToSI, volumeFromSI, volumeToSI, temperatureFromSI, temperatureToSI, lengthFromSI, lengthToSI, timeFromSI, timeToSI } from '@/lib/units';

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
    { value: 'liter', label: 'L' },
    { value: 'ft3', label: 'ft³' },
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
}) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={value || ''}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          placeholder={placeholder}
          step={step}
          min={min}
          required={required}
          className="flex-1 touch-target px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        <UnitSelect type={type} value={unit} onChange={onUnitChange} />
      </div>
    </div>
  );
};