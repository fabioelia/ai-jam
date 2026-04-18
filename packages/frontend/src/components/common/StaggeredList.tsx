import React, { ReactNode, cloneElement, isValidElement, CSSProperties } from 'react';

interface StaggeredListProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export default function StaggeredList({ children, className = '', staggerDelay = 50 }: StaggeredListProps) {
  const childArray = React.Children.toArray(children);

  return (
    <div className={className}>
      {childArray.map((child, index) => {
        if (isValidElement(child)) {
          const delay = index * staggerDelay;
          const childProps = child.props as { style?: CSSProperties; className?: string; [key: string]: any };
          const style: CSSProperties = {
            animationDelay: `${delay}ms`,
            ...(childProps.style || {}),
          };

          return cloneElement(child as React.ReactElement<any>, {
            style,
            className: `${childProps.className || ''} animate-fade-in-up`,
          });
        }
        return child;
      })}
    </div>
  );
}
