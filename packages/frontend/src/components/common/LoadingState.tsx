import { LoadingSpinner } from './Skeleton.js';

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function LoadingState({ message = 'Loading...', size = 'md', className = '' }: LoadingStateProps) {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 ${className}`}>
      <div className="relative">
        <LoadingSpinner size={size} className="text-indigo-400 animate-in fade-in duration-300" />
        <div className={`absolute inset-0 ${sizeClasses[size]} rounded-full bg-indigo-500/10 animate-ping`} />
      </div>
      {message && <p className="text-gray-500 text-sm mt-4 animate-in fade-in duration-300 delay-100">{message}</p>}
    </div>
  );
}
