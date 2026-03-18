import * as React from 'react';
import { Field, FieldContent, FieldDescription, FieldLabel } from './field';
import { cn } from '@/layers/shared/lib';

interface SettingRowProps {
  /** Label text displayed on the left. */
  label: string;
  /** Description text below the label. */
  description: string;
  /** Control element (Switch, Button, Select, etc.) rendered on the right. */
  children: React.ReactNode;
  /** Optional className for the outer Field wrapper. */
  className?: string;
}

/**
 * Horizontal settings row — label and description on the left, control on the right.
 *
 * Built on Shadcn Field with `orientation="horizontal"` for accessible
 * label/description association.
 */
function SettingRow({ label, description, children, className }: SettingRowProps) {
  return (
    <Field orientation="horizontal" className={cn('items-center justify-between gap-4', className)}>
      <FieldContent className="min-w-0">
        <FieldLabel className="text-sm font-medium">{label}</FieldLabel>
        <FieldDescription className="text-xs">{description}</FieldDescription>
      </FieldContent>
      {children}
    </Field>
  );
}

export { SettingRow };
export type { SettingRowProps };
