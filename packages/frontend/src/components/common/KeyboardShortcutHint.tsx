import { useEffect, useState } from 'react';

interface KeyboardShortcutHintProps {
  shortcut: string;
  description: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export default function KeyboardShortcutHint({
  shortcut,
  description,
  dismissible = true,
  onDismiss,
}: KeyboardShortcutHintProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  // Show hint only once per session
  useEffect(() => {
    const hasSeen = localStorage.getItem(`shortcut-hint:${shortcut}`);
    if (!hasSeen && !hasShown.current) {
      setIsVisible(true);
      setHasShown(true);
      localStorage.setItem(`shortcut-hint:${shortcut}`, 'true');
    }
  }, [shortcut]);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
    // Auto-dismiss after 30 seconds
    setTimeout(() => {
      localStorage.setItem(`shortcut-hint:${shortcut}`, 'false');
      setHasShown(false);
    }, 30000);
  };

  return (
    <div
      className={`fixed bottom-8 left-8 z-50 animate-in fade-in duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-2xl max-w-sm animate-in zoom-in-95 duration-200">
        <div className="flex items-start gap-3 mb-2">
          <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
            <kbd className="text-lg font-mono text-white font-bold">{shortcut}</kbd>
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-300 font-medium mb-1">{description}</p>
          {dismissible && (
              <button
                onClick={handleDismiss}
                className="text-gray-500 hover:text-gray-300 p-1 rounded-lg text-xs transition-colors hover:bg-gray-800"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook to trigger shortcut hints
interface UseShortcutHintProps {
  shortcut: string;
  description: string;
  context?: string;
  showOnce?: boolean;
}

export function useShortcutHint({ shortcut, description, context = 'global', showOnce = false }: UseShortcutHintProps) {
  const [hasBeenShown, setHasBeenShown] = useState(false);

  return {
    trigger: () => {
      if (!showOnce || !hasBeenShown) {
        setHasBeenShown(true);
        // Create and show hint
        const hintElement = document.createElement('div');
        hintElement.innerHTML = `
          <div class="fixed bottom-8 left-8 z-50 animate-in fade-in duration-300">
            <div class="bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-2xl max-w-sm animate-in zoom-in-95 duration-200">
              <div class="flex items-start gap-3 mb-2">
                <div class="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
                  <kbd class="text-lg font-mono text-white font-bold">${shortcut}</kbd>
                </div>
                <div class="flex-1">
                  <p class="text-sm text-gray-300 font-medium mb-1">${description}</p>
                </div>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(hintElement);

        // Auto-remove after 8 seconds
        setTimeout(() => {
          hintElement.remove();
          setHasBeenShown(false);
        }, 8000);
      }
    },
  };
}
