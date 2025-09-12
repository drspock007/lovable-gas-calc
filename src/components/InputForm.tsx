import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/i18n/context';
import { UnitSystem, UNIT_SYSTEMS } from '@/lib/units';
import { GASES } from '@/lib/physics';
import { CalculationMode } from './ModeSelector';

const createFormSchema = (mode: CalculationMode) => z.object({
  pressure1: z.number().positive(),
  pressure2: z.number().positive(),
  volume: z.number().positive(),
  temperature: z.number().min(-273.15),
  molecularWeight: z.number().positive().optional(),
  gasType: z.string().optional(),
  ...(mode === 'diameter' ? { time: z.number().positive() } : { diameter: z.number().positive() }),
});

export type FormData = z.infer<ReturnType<typeof createFormSchema>>;

interface InputFormProps {
  mode: CalculationMode;
  units: UnitSystem;
  onUnitsChange: (units: UnitSystem) => void;
  onSubmit: (data: FormData) => void;
  loading?: boolean;
}

export const InputForm: React.FC<InputFormProps> = ({
  mode,
  units,
  onUnitsChange,
  onSubmit,
  loading = false,
}) => {
  const { t } = useI18n();
  const form = useForm<FormData>({
    resolver: zodResolver(createFormSchema(mode)),
    defaultValues: {
      pressure1: 10,
      pressure2: 1,
      volume: 100,
      temperature: 20,
      molecularWeight: 29,
      gasType: 'air',
      ...(mode === 'diameter' ? { time: 60 } : { diameter: 5 }),
    },
  });

  const selectedGas = form.watch('gasType');

  React.useEffect(() => {
    if (selectedGas && GASES[selectedGas]) {
      form.setValue('molecularWeight', GASES[selectedGas].M * 1000); // Convert kg/mol to g/mol
    }
  }, [selectedGas, form]);

  return (
    <Card className="engineering-card">
      <CardHeader>
        <CardTitle className="gradient-text">{t.common.inputs}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Unit System Selector */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {Object.entries(UNIT_SYSTEMS).map(([key, system]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onUnitsChange(system)}
                  className={`p-2 text-xs rounded border transition-colors ${
                    JSON.stringify(units) === JSON.stringify(system)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {key.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Gas Type */}
            <FormField
              control={form.control}
              name="gasType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.calculator.inputs.gasType}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="touch-target">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.keys(GASES).map((gas) => (
                        <SelectItem key={gas} value={gas}>
                          {GASES[gas].name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Pressure 1 */}
            <FormField
              control={form.control}
              name="pressure1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t.calculator.inputs.pressure1} ({t.calculator.units[units.pressure]})
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      className="touch-target"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Pressure 2 */}
            <FormField
              control={form.control}
              name="pressure2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t.calculator.inputs.pressure2} ({t.calculator.units[units.pressure]})
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      className="touch-target"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Volume */}
            <FormField
              control={form.control}
              name="volume"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t.calculator.inputs.volume} ({t.calculator.units[units.volume]})
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      className="touch-target"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Temperature */}
            <FormField
              control={form.control}
              name="temperature"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t.calculator.inputs.temperature} ({t.calculator.units[units.temperature]})
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      className="touch-target"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Mode-specific input */}
            {mode === 'diameter' ? (
              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t.calculator.inputs.time} ({t.calculator.units[units.time]})
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        className="touch-target"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="diameter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t.calculator.inputs.diameter} ({t.calculator.units[units.length]})
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        className="touch-target"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Molecular Weight (optional) */}
            <FormField
              control={form.control}
              name="molecularWeight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t.calculator.inputs.molecularWeight} (g/mol)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.001"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      className="touch-target"
                      placeholder="Auto-filled from gas type"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};