import { ReactNode } from 'react';

export type BadgeVariant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-800 text-gray-300 border-gray-700',
  primary: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  secondary: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  success: 'bg-green-500/20 text-green-300 border-green-500/30',
  warning: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  danger: 'bg-red-500/20 text-red-300 border-red-500/30',
  info: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

export default function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  dot = false,
}: BadgeProps) {
  if (dot) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 ${sizeStyles[size]} ${className}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${variantStyles[variant].split(' ')[0]}`} />
        <span className={variantStyles[variant].split(' ').slice(1).join(' ')}>
          {children}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center font-medium border rounded-full ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
}

interface StatusBadgeProps {
  status: string;
  size?: BadgeSize;
  className?: string;
}

const statusConfig: Record<string, { variant: BadgeVariant; label: string }> = {
  active: { variant: 'success', label: 'Active' },
  completed: { variant: 'success', label: 'Completed' },
  done: { variant: 'success', label: 'Done' },
  pending: { variant: 'warning', label: 'Pending' },
  in_progress: { variant: 'primary', label: 'In Progress' },
  review: { variant: 'warning', label: 'Review' },
  failed: { variant: 'danger', label: 'Failed' },
  draft: { variant: 'secondary', label: 'Draft' },
  planned: { variant: 'primary', label: 'Planned' },
  planning: { variant: 'info', label: 'Planning' },
  qa: { variant: 'warning', label: 'QA' },
  acceptance: { variant: 'info', label: 'Acceptance' },
  backlog: { variant: 'secondary', label: 'Backlog' },
};

export function StatusBadge({ status, size = 'md', className = '' }: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] || { variant: 'default', label: status };

  return (
    <Badge variant={config.variant} size={size} className={className}>
      {config.label}
    </Badge>
  );
}

interface PriorityBadgeProps {
  priority: string;
  className?: string;
}

const priorityConfig: Record<string, { variant: BadgeVariant; label: string }> = {
  critical: { variant: 'danger', label: 'Critical' },
  high: { variant: 'warning', label: 'High' },
  medium: { variant: 'info', label: 'Medium' },
  low: { variant: 'secondary', label: 'Low' },
};

export function PriorityBadge({ priority, className = '' }: PriorityBadgeProps) {
  const config = priorityConfig[priority.toLowerCase()] || { variant: 'default', label: priority };

  return (
    <Badge variant={config.variant} size="sm" className={className}>
      {config.label}
    </Badge>
  );
}

interface CountBadgeProps {
  count: number;
  max?: number;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
}

export function CountBadge({
  count,
  max = 99,
  variant = 'primary',
  size = 'sm',
  className = '',
}: CountBadgeProps) {
  const displayCount = count > max ? `${max}+` : count;

  return (
    <Badge variant={variant} size={size} className={className}>
      {displayCount}
    </Badge>
  );
}

interface NotificationBadgeProps {
  count: number;
  className?: string;
}

export function NotificationBadge({ count, className = '' }: NotificationBadgeProps) {
  if (count === 0) return null;

  return (
    <span className={`absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-lg animate-badge-pulse ${className}`}>
      {count > 9 ? '9+' : count}
    </span>
  );
}
