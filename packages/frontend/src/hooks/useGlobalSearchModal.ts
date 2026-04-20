import { useState, useCallback, useEffect } from 'react';

interface UseGlobalSearchModalOptions {
  defaultOpen?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}

export function useGlobalSearchModal(options: UseGlobalSearchModalOptions = {}) {
  const { defaultOpen = false, onOpen, onClose } = options;
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [initialQuery, setInitialQuery] = useState('');

  const open = useCallback((query = '') => {
    setInitialQuery(query);
    setIsOpen(true);
    onOpen?.();
  }, [onOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
    setInitialQuery('');
    onClose?.();
  }, [onClose]);

  const toggle = useCallback(() => {
    setIsOpen(prev => {
      const newState = !prev;
      if (newState) {
        onOpen?.();
      } else {
        onClose?.();
      }
      return newState;
    });
  }, [onOpen, onClose]);

  // Handle keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggle]);

  return {
    isOpen,
    open,
    close,
    toggle,
    initialQuery
  };
}
