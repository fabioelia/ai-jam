import { useState, forwardRef, ReactNode } from 'react';
import { FormError } from './FormValidation.js';

export interface FormInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  helperText?: string;
  error?: string;
  touched?: boolean;
  required?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  loading?: boolean;
  clearable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  labelClassName?: string;
  wrapperClassName?: string;
}

const sizeConfig = {
  sm: {
    input: 'px-3 py-1.5 text-sm',
    icon: 'w-4 h-4',
    label: 'text-xs',
    helper: 'text-xs',
    height: 'h-8',
  },
  md: {
    input: 'px-4 py-2.5 text-sm',
    icon: 'w-5 h-5',
    label: 'text-sm',
    helper: 'text-xs',
    height: 'h-10',
  },
  lg: {
    input: 'px-4 py-3 text-base',
    icon: 'w-5 h-5',
    label: 'text-sm',
    helper: 'text-sm',
    height: 'h-12',
  },
};

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  (
    {
      label,
      helperText,
      error,
      touched,
      required = false,
      leftIcon,
      rightIcon,
      loading = false,
      clearable = false,
      size = 'md',
      className = '',
      labelClassName = '',
      wrapperClassName = '',
      type = 'text',
      id,
      value,
      onChange,
      disabled,
      placeholder,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [localType, setLocalType] = useState(type);
    const inputId = id || `input-${Math.random().toString(36).slice(2)}`;

    const showError = error && touched;
    const showSuccess = touched && !error && value;
    const hasValue = value !== undefined && value !== '';

    const handleClear = () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      const input = document.getElementById(inputId) as HTMLInputElement;
      if (input && nativeInputValueSetter) {
        nativeInputValueSetter.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };

    const sizes = sizeConfig[size];

    const getBorderClass = () => {
      if (showError) return 'border-red-500 focus:border-red-500 focus:ring-red-500/30';
      if (showSuccess) return 'border-green-500/50 focus:border-green-500 focus:ring-green-500/30';
      if (isFocused) return 'border-indigo-500 focus:ring-indigo-500/30';
      return 'border-gray-700 hover:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500/30';
    };

    return (
      <div className={`w-full ${wrapperClassName}`}>
        {label && (
          <label
            htmlFor={inputId}
            className={`block font-medium text-gray-300 mb-1.5 ${sizes.label} ${labelClassName}`}
          >
            {label}
            {required && (
              <span className="text-red-400 ml-1" aria-hidden="true">
                *
              </span>
            )}
            {!required && (
              <span className="text-gray-500 ml-1 font-normal" aria-hidden="true">
                (optional)
              </span>
            )}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div
              className={`absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 ${
                isFocused ? 'text-indigo-400' : ''
              } transition-colors ${sizes.icon}`}
              aria-hidden="true"
            >
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type={localType}
            value={value}
            onChange={onChange}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            disabled={disabled || loading}
            placeholder={placeholder}
            className={`
              w-full bg-gray-800 text-white placeholder-gray-500
              border rounded-lg
              transition-all duration-200 ease-out
              focus:outline-none focus:ring-2 focus:ring-offset-0
              disabled:opacity-50 disabled:cursor-not-allowed
              ${leftIcon ? (size === 'lg' ? 'pl-12' : 'pl-10') : sizes.input.split(' ')[0]}
              ${rightIcon || clearable || type === 'password' ? (size === 'lg' ? 'pr-12' : 'pr-10') : sizes.input.split(' ').slice(1).join(' ')}
              ${getBorderClass()}
              ${className}
            `}
            aria-invalid={showError ? 'true' : 'false'}
            aria-describedby={
              showError
                ? `${inputId}-error`
                : helperText
                ? `${inputId}-helper`
                : undefined
            }
            aria-required={required}
            {...props}
          />

          {/* Right side actions */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {loading && (
              <svg
                className={`animate-spin text-gray-500 ${sizes.icon}`}
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}

            {showSuccess && !loading && (
              <svg
                className={`text-green-500 ${sizes.icon}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}

            {clearable && hasValue && !loading && (
              <button
                type="button"
                onClick={handleClear}
                className="text-gray-500 hover:text-gray-300 transition-colors"
                aria-label="Clear input"
              >
                <svg className={sizes.icon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {type === 'password' && !loading && (
              <button
                type="button"
                onClick={() => setLocalType(localType === 'password' ? 'text' : 'password')}
                className="text-gray-500 hover:text-gray-300 transition-colors"
                aria-label={localType === 'password' ? 'Show password' : 'Hide password'}
              >
                {localType === 'password' ? (
                  <svg className={sizes.icon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg className={sizes.icon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                )}
              </button>
            )}

            {rightIcon && !loading && <div className="text-gray-500">{rightIcon}</div>}
          </div>
        </div>

        {/* Helper text or error */}
        {showError ? (
          <p id={`${inputId}-error`} className={`mt-1.5 text-red-400 ${sizes.helper} flex items-start gap-1.5 animate-in fade-in duration-200`} role="alert">
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </p>
        ) : helperText ? (
          <p id={`${inputId}-helper`} className={`mt-1.5 text-gray-500 ${sizes.helper}`}>
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

FormInput.displayName = 'FormInput';

// Textarea variant
export interface FormTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  label?: string;
  helperText?: string;
  error?: string;
  touched?: boolean;
  required?: boolean;
  size?: 'sm' | 'md' | 'lg';
  rows?: number;
  maxLength?: number;
  showCharacterCount?: boolean;
  autoResize?: boolean;
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  (
    {
      label,
      helperText,
      error,
      touched,
      required = false,
      size = 'md',
      rows = 4,
      maxLength,
      showCharacterCount = false,
      className = '',
      onChange,
      value,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const inputId = props.id || `textarea-${Math.random().toString(36).slice(2)}`;

    const showError = error && touched;
    const currentLength = typeof value === 'string' ? value.length : 0;

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (maxLength && e.target.value.length > maxLength) return;
      onChange?.(e);
    };

    const sizes = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-3 text-sm',
      lg: 'px-4 py-4 text-base',
    };

    const getBorderClass = () => {
      if (showError) return 'border-red-500 focus:border-red-500 focus:ring-red-500/30';
      if (isFocused) return 'border-indigo-500 focus:ring-indigo-500/30';
      return 'border-gray-700 hover:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500/30';
    };

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-300 mb-1.5">
            {label}
            {required && <span className="text-red-400 ml-1">*</span>}
            {!required && <span className="text-gray-500 ml-1 font-normal">(optional)</span>}
          </label>
        )}

        <div className="relative">
          <textarea
            ref={ref || textareaRef}
            id={inputId}
            value={value}
            onChange={handleChange}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            rows={rows}
            maxLength={maxLength}
            className={`
              w-full bg-gray-800 text-white placeholder-gray-500
              border rounded-lg
              transition-all duration-200 ease-out
              focus:outline-none focus:ring-2 focus:ring-offset-0
              disabled:opacity-50 disabled:cursor-not-allowed
              resize-y
              ${sizes[size]}
              ${getBorderClass()}
              ${className}
            `}
            aria-invalid={showError ? 'true' : 'false'}
            aria-describedby={showError ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            {...props}
          />
        </div>

        {/* Bottom section with character count and/or helper/error */}
        <div className="flex items-start justify-between mt-1.5 gap-4">
          {showError ? (
            <p id={`${inputId}-error`} className="text-red-400 text-sm flex items-start gap-1.5 animate-in fade-in duration-200 flex-1" role="alert">
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </p>
          ) : helperText ? (
            <p id={`${inputId}-helper`} className="text-gray-500 text-sm flex-1">
              {helperText}
            </p>
          ) : (
            <div />
          )}

          {showCharacterCount && maxLength && (
            <span className={`text-xs shrink-0 ${currentLength > maxLength * 0.9 ? 'text-amber-400' : 'text-gray-500'}`}>
              {currentLength}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  }
);

FormTextarea.displayName = 'FormTextarea';

// Select variant
export interface FormSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  helperText?: string;
  error?: string;
  touched?: boolean;
  required?: boolean;
  size?: 'sm' | 'md' | 'lg';
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ label, helperText, error, touched, required = false, size = 'md', options, placeholder, className = '', ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const inputId = props.id || `select-${Math.random().toString(36).slice(2)}`;
    const showError = error && touched;

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2.5 text-sm',
      lg: 'px-4 py-3 text-base',
    };

    const getBorderClass = () => {
      if (showError) return 'border-red-500 focus:border-red-500 focus:ring-red-500/30';
      if (isFocused) return 'border-indigo-500 focus:ring-indigo-500/30';
      return 'border-gray-700 hover:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500/30';
    };

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-300 mb-1.5">
            {label}
            {required && <span className="text-red-400 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            className={`
              w-full bg-gray-800 text-white
              border rounded-lg appearance-none
              transition-all duration-200 ease-out
              focus:outline-none focus:ring-2 focus:ring-offset-0
              disabled:opacity-50 disabled:cursor-not-allowed
              pr-10
              ${sizes[size]}
              ${getBorderClass()}
              ${className}
            `}
            aria-invalid={showError ? 'true' : 'false'}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>

          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {showError ? (
          <p className="mt-1.5 text-red-400 text-sm flex items-start gap-1.5 animate-in fade-in duration-200" role="alert">
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </p>
        ) : helperText ? (
          <p className="mt-1.5 text-gray-500 text-sm">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

FormSelect.displayName = 'FormSelect';

export default FormInput;
