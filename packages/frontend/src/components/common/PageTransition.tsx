import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export default function PageTransition({ children, className = '', delay = 0 }: PageTransitionProps) {
  return (
    <div
      className={`animate-in slide-in-from-bottom duration-300 ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
