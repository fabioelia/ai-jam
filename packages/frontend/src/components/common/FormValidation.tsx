import { ReactNode } from 'react';

export interface ValidationRule {
  validate: (value: string) => boolean;
  message: string;
}

export interface FormField<T extends Record<string, unknown>> {
  name: keyof T;
  value: string;
  rules?: ValidationRule[];
  touched: boolean;
  error?: string;
}

export function validateField(value: string, rules?: ValidationRule[]): string | undefined {
  if (!rules || rules.length === 0) return undefined;

  for (const rule of rules) {
    if (!rule.validate(value)) {
      return rule.message;
    }
  }
  return undefined;
}

export function validateForm<T extends Record<string, unknown>>(
  fields: Record<keyof T, FormField<T>>
): Record<keyof T, string | undefined> {
  const errors: Partial<Record<keyof T, string>> = {};

  for (const [key, field] of Object.entries(fields)) {
    const error = validateField(field.value, field.rules);
    if (error) {
      errors[key as keyof T] = error;
    }
  }

  return errors as Record<keyof T, string | undefined>;
}

export const commonRules = {
  required: (fieldName = 'This field'): ValidationRule => ({
    validate: (value) => value.trim().length > 0,
    message: `${fieldName} is required`,
  }),

  minLength: (min: number, fieldName = 'This field'): ValidationRule => ({
    validate: (value) => value.trim().length >= min,
    message: `${fieldName} must be at least ${min} characters`,
  }),

  maxLength: (max: number, fieldName = 'This field'): ValidationRule => ({
    validate: (value) => value.trim().length <= max,
    message: `${fieldName} must not exceed ${max} characters`,
  }),

  email: (): ValidationRule => ({
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message: 'Please enter a valid email address',
  }),

  url: (): ValidationRule => ({
    validate: (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message: 'Please enter a valid URL',
  }),

  pattern: (regex: RegExp, message: string): ValidationRule => ({
    validate: (value) => regex.test(value),
    message,
  }),
};

interface FormErrorProps {
  error?: string;
  touched?: boolean;
  className?: string;
}

export function FormError({ error, touched, className = '' }: FormErrorProps) {
  if (!error || !touched) return null;

  return (
    <p className={`text-red-400 text-xs mt-1 animate-in fade-in duration-200 ${className}`}>
      {error}
    </p>
  );
}

interface FormFieldWrapperProps {
  label: string;
  error?: string;
  touched?: boolean;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormFieldWrapper({
  label,
  error,
  touched,
  required = false,
  children,
  className = '',
}: FormFieldWrapperProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
      <FormError error={error} touched={touched} />
    </div>
  );
}
