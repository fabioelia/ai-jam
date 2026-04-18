import { useState, useEffect, useRef } from 'react';

interface TourStep {
  target: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface OnboardingTourProps {
  steps: TourStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onCompleteTour?: () => void;
}

export default function OnboardingTour({
  steps,
  isOpen,
  onClose,
  onComplete,
  onCompleteTour,
}: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Find and position tooltip for current step
  useEffect(() => {
    if (!isOpen || currentStep >= steps.length) return;

    const step = steps[currentStep];
    const element = document.querySelector(step.target) as HTMLElement;

    if (element) {
      setTargetElement(element);
      const rect = element.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;

      let top = 0;
      let left = 0;

      switch (step.position || 'bottom') {
        case 'top':
          top = rect.top + scrollY - 10;
          left = rect.left + scrollX + rect.width / 2;
          break;
        case 'bottom':
          top = rect.bottom + scrollY + 10;
          left = rect.left + scrollX + rect.width / 2;
          break;
        case 'left':
          top = rect.top + scrollY + rect.height / 2;
          left = rect.left + scrollX - 10;
          break;
        case 'right':
          top = rect.top + scrollY + rect.height / 2;
          left = rect.right + scrollX + 10;
          break;
      }

      setPosition({ top, left });

      // Scroll element into view
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Highlight target
      element.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-2', 'ring-offset-gray-950');

      return () => {
        element.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-2', 'ring-offset-gray-950');
      };
    }
  }, [isOpen, currentStep, steps]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep, onClose]);

  function handleNext() {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  }

  function handlePrevious() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }

  function handleComplete() {
    onComplete();
    if (onCompleteTour) {
      onCompleteTour();
    }
  }

  if (!isOpen || currentStep >= steps.length) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const positionTransform: Record<string, string> = {
    top: '-translate-y-full -translate-x-1/2 mb-2',
    bottom: 'translate-x-1/2 mt-2',
    left: '-translate-x-full -translate-y-1/2 mr-2',
    right: '-translate-y-1/2 ml-2',
  };

  const arrowPosition: Record<string, string> = {
    top: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 border-l-gray-800 border-r-gray-800 border-b-gray-800 border-t-transparent rotate-45',
    bottom: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 border-l-gray-800 border-r-gray-800 border-t-gray-800 border-b-transparent rotate-45',
    left: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2 border-t-gray-800 border-b-gray-800 border-r-gray-800 border-l-transparent rotate-45',
    right: 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 border-t-gray-800 border-b-gray-800 border-l-gray-800 border-r-transparent rotate-45',
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 pointer-events-none" />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={`fixed z-50 ${positionTransform[step.position || 'bottom']}`}
        style={{ top: position.top, left: position.left }}
      >
        <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-5 w-80 animate-in fade-in zoom-in-95 duration-200">
          {/* Progress indicator */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500">
              Step {currentStep + 1} of {steps.length}
            </span>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-300 transition-colors"
              aria-label="Close tour"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <h3 className="text-white font-semibold mb-2">{step.title}</h3>
          <p className="text-gray-400 text-sm leading-relaxed mb-4">{step.content}</p>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-800">
            <button
              onClick={handlePrevious}
              disabled={isFirstStep}
              className="text-sm text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Back
            </button>

            {/* Progress dots */}
            <div className="flex gap-1.5">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentStep ? 'bg-indigo-500' : 'bg-gray-700'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg font-medium transition-colors"
            >
              {isLastStep ? 'Finish' : 'Next'}
            </button>
          </div>

          {/* Arrow */}
          <div
            className={`absolute w-3 h-3 bg-gray-900 border-2 ${arrowPosition[step.position || 'bottom']}`}
          />
        </div>
      </div>
    </>
  );
}

// Hook to manage tour state
export function useOnboardingTour(tourKey: string) {
  const [hasSeenTour, setHasSeenTour] = useState(() => {
    return localStorage.getItem(`ai-jam:tour:${tourKey}`) === 'true';
  });

  const markTourComplete = () => {
    localStorage.setItem(`ai-jam:tour:${tourKey}`, 'true');
    setHasSeenTour(true);
  };

  const resetTour = () => {
    localStorage.removeItem(`ai-jam:tour:${tourKey}`);
    setHasSeenTour(false);
  };

  return {
    hasSeenTour,
    markTourComplete,
    resetTour,
  };
}
