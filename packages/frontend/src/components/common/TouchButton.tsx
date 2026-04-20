/**
 * Touch Button Component
 *
 * Enhanced button component with touch-friendly features,
 * proper touch targets, and mobile-specific optimizations.
 */

import React, { forwardRef, useRef, useEffect, useState } from 'react';
import { useIsTouch, useBreakpoint } from '../../hooks/useResponsive.js';

interface TouchButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  ripple?: boolean;
  haptic?: boolean;
  children: React.ReactNode;
}

const variantStyles = {
  primary: 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white border-transparent',
  secondary: 'bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-gray-300 border-gray-700',
  danger: 'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white border-transparent',
  ghost: 'bg-transparent hover:bg-gray-800 active:bg-gray-700 text-gray-400 hover:text-white border-transparent',
  success: 'bg-green-600 hover:bg-green-500 active:bg-green-700 text-white border-transparent',
};

const sizeStyles = {
  xs: 'px-3 py-1.5 text-xs',
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
  xl: 'px-8 py-4 text-lg',
};

const touchMinSizes = {
  xs: 'min-h-[44px]',
  sm: 'min-h-[44px]',
  md: 'min-h-[48px]',
  lg: 'min-h-[48px]',
  xl: 'min-h-[52px]',
};

export const TouchButton = forwardRef<HTMLButtonElement, TouchButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      isLoading = false,
      disabled,
      leftIcon,
      rightIcon,
      ripple = true,
      haptic = true,
      children,
      className = '',
      onClick,
      ...props
    },
    ref
  ) => {
    const isTouch = useIsTouch();
    const { isMobile } = useBreakpoint();
    const [rippleState, setRippleState] = useState<{ x: number; y: number; active: boolean } | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const combinedRef = (node: HTMLButtonElement) => {
      buttonRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    // Handle haptic feedback on touch devices
    const triggerHaptic = () => {
      if (!isTouch || !haptic) return;

      // Vibration API (Chrome/Android)
      if ('vibrate' in navigator && navigator.vibrate) {
        navigator.vibrate(10); // Short, subtle vibration
      }
    };

    // Handle ripple effect
    const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!ripple || isTouch) return;

      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setRippleState({ x, y, active: true });
    };

    const handleMouseUp = () => {
      setRippleState(null);
    };

    const handleMouseLeave = () => {
      setRippleState(null);
    };

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      triggerHaptic();
      onClick?.(e);
    };

    // Clean up ripple effect
    useEffect(() => {
      if (rippleState?.active) {
        const timer = setTimeout(() => {
          setRippleState(null);
        }, 600);

        return () => clearTimeout(timer);
      }
    }, [rippleState]);

    const baseClasses = `
      relative overflow-hidden
      font-medium border rounded-xl
      flex items-center justify-center gap-2
      transition-all duration-200 ease-out
      focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900
      ${variantStyles[variant]}
      ${sizeStyles[size]}
      ${isMobile ? touchMinSizes[size] : ''}
      ${fullWidth ? 'w-full' : ''}
      ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      ${isTouch ? 'active:scale-95' : 'active:scale-[0.98] hover:shadow-lg hover:-translate-y-0.5'}
      ${isMobile ? 'no-mobile-animation' : ''}
      ${className}
    `;

    return (
      <button
        ref={combinedRef}
        className={baseClasses}
        disabled={disabled || isLoading}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {/* Ripple Effect */}
        {rippleState?.active && (
          <span
            className="absolute rounded-full bg-white/30 pointer-events-none animate-ping"
            style={{
              width: '300%',
              height: '300%',
              left: rippleState.x,
              top: rippleState.y,
              transform: 'translate(-50%, -50%)',
            }}
          />
        )}

        {/* Loading Spinner */}
        {isLoading && (
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}

        {/* Left Icon */}
        {!isLoading && leftIcon && (
          <span className="shrink-0" aria-hidden="true">{leftIcon}</span>
        )}

        {/* Content */}
        <span className={isLoading ? 'opacity-70' : ''}>{children}</span>

        {/* Right Icon */}
        {!isLoading && rightIcon && (
          <span className="shrink-0" aria-hidden="true">{rightIcon}</span>
        )}
      </button>
    );
  }
);

TouchButton.displayName = 'TouchButton';

// ============================================
// TOUCH CARD COMPONENT
// ============================================

interface TouchCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  className?: string;
  disabled?: boolean;
  activeScale?: number;
}

export function TouchCard({
  children,
  onPress,
  className = '',
  disabled = false,
  activeScale = 0.97,
}: TouchCardProps) {
  const isTouch = useIsTouch();
  const { isMobile } = useBreakpoint();

  return (
    <div
      className={`
        ${isTouch ? 'active:scale-' + (activeScale * 100) : 'hover:scale-[1.02] hover:shadow-xl'}
        ${isMobile ? 'cursor-pointer' : 'cursor-pointer'}
        transition-transform duration-200
        ${disabled ? 'opacity-50 pointer-events-none' : ''}
        ${className}
      `}
      onClick={() => {
        if (!disabled) {
          onPress?.();
        }
      }}
      role={onPress ? 'button' : undefined}
      tabIndex={onPress ? 0 : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPress?.();
        }
      }}
    >
      {children}
    </div>
  );
}

// ============================================
// TOUCH SWITCH COMPONENT
// ============================================

interface TouchSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export function TouchSwitch({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  label,
}: TouchSwitchProps) {
  const isTouch = useIsTouch();

  const sizeStyles = {
    sm: 'w-10 h-6',
    md: 'w-14 h-8',
    lg: 'w-16 h-9',
  };

  const thumbSizeStyles = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-7 h-7',
  };

  const handleToggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={disabled}
      className={`
        relative inline-flex shrink-0 cursor-pointer
        rounded-full border-2 border-transparent
        transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}
        ${checked ? 'bg-indigo-600' : 'bg-gray-700'}
        ${sizeStyles[size]}
        ${isTouch ? 'active:scale-95' : ''}
      `}
      role="switch"
      aria-checked={checked}
      aria-label={label}
    >
      <span
        className={`
          pointer-events-none inline-block rounded-full bg-white shadow
          transform transition-transform duration-200
          ${thumbSizeStyles[size]}
          ${checked ? 'translate-x-full' : 'translate-x-0'}
        `}
      />
    </button>
  );
}

// ============================================
// TOUCH INPUT COMPONENT
// ============================================

interface TouchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function TouchInput({
  label,
  error,
  helperText,
  className = '',
  ...props
}: TouchInputProps) {
  const { isMobile } = useBreakpoint();

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label
          htmlFor={props.id}
          className="block text-sm font-medium text-gray-300"
        >
          {label}
        </label>
      )}
      <input
        {...props}
        className={`
          w-full
          bg-gray-800 border rounded-xl px-4 py-3
          text-white placeholder-gray-500
          focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500
          transition-all duration-200
          ${isMobile ? 'text-base py-4' : ''}
          ${error ? 'border-red-500 focus:ring-red-500/50 focus:border-red-500' : 'border-gray-700'}
          ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        style={{ minHeight: isMobile ? '48px' : '42px' }}
      />
      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="text-xs text-gray-500">{helperText}</p>
      )}
    </div>
  );
}
