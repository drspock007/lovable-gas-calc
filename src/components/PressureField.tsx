import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/context';

interface PressureFieldProps {
  label: string;
  value: string;
  unit: string;
  onChange: (value: string) => void;
  onUnitChange: (unit: string) => void;
  placeholder?: string;
  error?: string;
  showToAtmosphereButton?: boolean;
  onToAtmosphere?: () => void;
}

const PRESSURE_UNITS = [
  { value: 'Pa', label: 'Pa' },
  { value: 'kPa', label: 'kPa' },
  { value: 'bar', label: 'bar' },
  { value: 'MPa', label: 'MPa' },
];

export const PressureField: React.FC<PressureFieldProps> = ({
  label,
  value,
  unit,
  onChange,
  onUnitChange,
  placeholder,
  error,
  showToAtmosphereButton = false,
  onToAtmosphere,
}) => {
  const { t } = useI18n();
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };
  
  const handleToAtmosphere = () => {
    onChange('0');
    if (onToAtmosphere) {
      onToAtmosphere();
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
            value={value}
            onChange={handleInputChange}
            placeholder={placeholder}
            className={`w-full touch-target px-3 py-2 border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent 
              [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
              error 
                ? 'border-destructive focus:ring-destructive' 
                : 'border-border'
            }`}
          />
          {error && (
            <p className="text-xs text-destructive mt-1">
              {error}
            </p>
          )}
        </div>
        <Select value={unit} onValueChange={onUnitChange}>
          <SelectTrigger className="w-20 bg-background border-border z-50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background border-border shadow-elevated z-50">
            {PRESSURE_UNITS.map((option) => (
              <SelectItem key={option.value} value={option.value} className="hover:bg-accent">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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