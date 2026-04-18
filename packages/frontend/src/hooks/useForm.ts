import { useState, useCallback, useEffect } from 'react';
import type { ValidationRule } from '../components/common/FormValidation.js';
import { validateField } from '../components/common/FormValidation.js';

interface FormField {
  value: string;
  error?: string;
  touched: boolean;
  rules?: ValidationRule[];
}

interface UseFormOptions<T extends Record<string, unknown>> {
  initialValues: T;
  validationRules?: Partial<Record<keyof T, ValidationRule[]>>;
  onSubmit?: (values: T) => Promise<void> | void;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

export function useForm<T extends Record<string, unknown>>({
  initialValues,
  validationRules = {},
  onSubmit,
  onSuccess,
  onError,
}: UseFormOptions<T>) {
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.keys(initialValues).reduce((acc, key) => {
      acc[key] = String(initialValues[key as keyof T] || '');
      return acc;
    }, {} as Record<string, string>)
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const setValue = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setIsDirty(true);

    // Validate field on change if already touched
    if (touched[name]) {
      const error = validateField(value, validationRules[name as keyof T]);
      setErrors((prev) => ({ ...prev, [name]: error || '' }));
    }
  }, [touched, validationRules]);

  const setFieldTouched = useCallback((name: string, isTouched: boolean = true) => {
    setTouched((prev) => ({ ...prev, [name]: isTouched }));

    // Validate field when touched
    if (isTouched && !touched[name]) {
      const error = validateField(values[name], validationRules[name as keyof T]);
      setErrors((prev) => ({ ...prev, [name]: error || '' }));
    }
  }, [touched, values, validationRules]);

  const validateAll = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    for (const [name, rules] of Object.entries(validationRules)) {
      const error = validateField(values[name], rules);
      if (error) {
        newErrors[name] = error;
        isValid = false;
      }
    }

    setErrors(newErrors);
    setTouched(
      Object.keys(validationRules).reduce((acc, key) => {
        acc[key] = true;
        return acc;
      }, {} as Record<string, boolean>)
    );

    return isValid;
  }, [values, validationRules]);

  const reset = useCallback(() => {
    setValues(
      Object.keys(initialValues).reduce((acc, key) => {
        acc[key] = String(initialValues[key as keyof T] || '');
        return acc;
      }, {} as Record<string, string>)
    );
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
    setIsDirty(false);
  }, [initialValues]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      if (!validateAll()) {
        return;
      }

      setIsSubmitting(true);

      try {
        await onSubmit?.(values as T);
        reset();
        onSuccess?.();
      } catch (error) {
        onError?.(error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, validateAll, onSubmit, onSuccess, onError, reset]
  );

  // Get field props for a specific field
  const getFieldProps = useCallback((name: string) => ({
    name,
    value: values[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setValue(name, e.target.value);
    },
    onBlur: () => setFieldTouched(name),
    error: errors[name],
    touched: touched[name],
  }), [values, errors, touched, setValue, setFieldTouched]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isDirty,
    setValue,
    setFieldTouched,
    validateAll,
    reset,
    handleSubmit,
    getFieldProps,
  };
}
