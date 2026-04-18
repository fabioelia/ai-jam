import { useState, useRef, useEffect } from 'react';

interface HelpTooltipProps {
  content: string | React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactNode;
  maxWidth?: string;
  showOnHover?: boolean;
  showOnClick?: boolean;
}

export default function HelpTooltip({
  content,
  position = 'top',
  children,
  maxWidth = '250px',
  showOnHover = true,
  showOnClick = false,
}: HelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Position classes
  const positionClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  // Arrow classes
  const arrowClasses: Record<string, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-gray-800 border-r-gray-800 border-b-gray-800 border-t-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-gray-800 border-r-gray-800 border-t-gray-800 border-b-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-gray-800 border-b-gray-800 border-r-gray-800 border-l-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-gray-800 border-b-gray-800 border-l-gray-800 border-r-transparent',
  };

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(event.target as Node) &&
          tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsVisible(false);
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible]);

  // Handle keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        setIsVisible(false);
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible]);

  const handleToggle = () => {
    if (showOnClick) {
      setIsVisible(!isVisible);
    }
  };

  const handleMouseEnter = () => {
    if (showOnHover) {
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    if (showOnHover) {
      setIsVisible(false);
    }
  };

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        onClick={handleToggle}
        className="inline-flex"
      >
        {children}
      </div>

      {isVisible && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 ${positionClasses[position]} animate-in fade-in zoom-in-95 duration-200`}
          style={{ maxWidth }}
        >
          <div className="relative bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3">
            <div className={`absolute w-2 h-2 border-4 ${arrowClasses[position]}`} />
            <div className="text-sm text-gray-200 leading-relaxed">
              {content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
