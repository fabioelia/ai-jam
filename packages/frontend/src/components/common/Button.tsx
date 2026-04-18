import { ButtonLoader } from './Skeleton.js';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white border-transparent hover:shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98]',
  secondary: 'bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-gray-300 border-gray-700 hover:shadow-md hover:shadow-gray-900/10 active:scale-[0.98]',
  danger: 'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white border-transparent hover:shadow-lg hover:shadow-red-500/20 active:scale-[0.98]',
  ghost: 'bg-transparent hover:bg-gray-800 active:bg-gray-700 text-gray-400 hover:text-white border-transparent hover:shadow-sm hover:shadow-gray-900/5 active:scale-[0.98]',
};

const disabledStyles = 'opacity-50 cursor-not-allowed hover:opacity-50';

export default function Button({
  variant = 'primary',
  isLoading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        px-4 py-2 rounded-lg text-sm font-medium border transition-all
        flex items-center justify-center gap-2
        ${variantStyles[variant]}
        ${disabled || isLoading ? disabledStyles : ''}
        ${className}
      `}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <ButtonLoader />}
      {children}
    </button>
  );
}
