import { useState, useEffect, useRef, ReactNode } from 'react';
import Button, { ButtonVariant } from './Button.js';

export type ConfirmVariant = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  confirmVariant?: ButtonVariant;
  isLoading?: boolean;
  requireConfirmation?: boolean;
  confirmationText?: string;
  destructive?: boolean;
}

const variantConfig: Record<ConfirmVariant, { icon: ReactNode; iconBg: string; titleColor: string }> = {
  danger: {
    icon: (
      <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
    iconBg: 'bg-red-500/10',
    titleColor: 'text-red-400',
  },
  warning: {
    icon: (
      <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    iconBg: 'bg-amber-500/10',
    titleColor: 'text-amber-400',
  },
  info: {
    icon: (
      <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    iconBg: 'bg-blue-500/10',
    titleColor: 'text-blue-400',
  },
  success: {
    icon: (
      <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    iconBg: 'bg-green-500/10',
    titleColor: 'text-green-400',
  },
};

export default function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  confirmVariant,
  isLoading = false,
  requireConfirmation = false,
  confirmationText = 'CONFIRM',
  destructive = false,
}: ConfirmationDialogProps) {
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [internalLoading, setInternalLoading] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const loading = isLoading || internalLoading;
  const config = variantConfig[variant];
  const isConfirmed = !requireConfirmation || typedConfirmation === confirmationText;

  // Focus management and escape key
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      // Focus cancel button by default for safety
      setTimeout(() => cancelButtonRef.current?.focus(), 0);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        } else if (e.key === 'Enter' && isConfirmed && !loading) {
          handleConfirm();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    } else {
      // Restore focus when closing
      if (previousActiveElement.current) {
        setTimeout(() => previousActiveElement.current?.focus(), 0);
      }
    }
  }, [isOpen, isConfirmed, loading]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setTypedConfirmation('');
      setInternalLoading(false);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (!isConfirmed || loading) return;

    setInternalLoading(true);
    try {
      await onConfirm();
    } finally {
      setInternalLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={description ? 'confirm-dialog-description' : undefined}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-all duration-200"
          aria-label="Close dialog"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 ${config.iconBg} rounded-xl flex items-center justify-center shrink-0`}>
              {config.icon}
            </div>
            <div className="flex-1 pr-8">
              <h3 id="confirm-dialog-title" className={`text-lg font-semibold ${config.titleColor} mb-1`}>
                {title}
              </h3>
              {description && (
                <p id="confirm-dialog-description" className="text-gray-400 text-sm leading-relaxed">
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Custom content */}
          {children && <div className="mt-4">{children}</div>}

          {/* Confirmation text input for destructive actions */}
          {requireConfirmation && (
            <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <p className="text-sm text-gray-400 mb-3">
                This action cannot be undone. To confirm, type{' '}
                <span className="text-white font-mono bg-gray-700 px-1.5 py-0.5 rounded">{confirmationText}</span>{' '}
                below:
              </p>
              <input
                type="text"
                value={typedConfirmation}
                onChange={(e) => setTypedConfirmation(e.target.value)}
                placeholder={`Type ${confirmationText} to confirm`}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/30"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isConfirmed) {
                    handleConfirm();
                  }
                }}
              />
            </div>
          )}

          {/* Warning for destructive actions without confirmation */}
          {destructive && !requireConfirmation && (
            <div className="mt-4 flex items-start gap-2 text-amber-400 text-sm">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>This action cannot be undone.</span>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex gap-3 justify-end">
            <Button
              ref={cancelButtonRef}
              onClick={onClose}
              variant="secondary"
              disabled={loading}
            >
              {cancelText}
            </Button>
            <Button
              ref={confirmButtonRef}
              onClick={handleConfirm}
              variant={confirmVariant || (variant === 'danger' ? 'danger' : variant === 'success' ? 'success' : 'primary')}
              isLoading={loading}
              disabled={!isConfirmed}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for easy dialog usage
export function useConfirmationDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<Omit<ConfirmationDialogProps, 'isOpen' | 'onClose' | 'onConfirm'>>({
    title: '',
  });
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = (dialogConfig: Omit<ConfirmationDialogProps, 'isOpen' | 'onClose' | 'onConfirm'>) => {
    setConfig(dialogConfig);
    setIsOpen(true);

    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  };

  const handleClose = () => {
    setIsOpen(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  };

  const handleConfirm = async () => {
    setIsOpen(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
  };

  const dialogComponent = (
    <ConfirmationDialog
      {...config}
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
    />
  );

  return { confirm, dialogComponent, isOpen };
}

// Preset dialogs for common use cases
export const confirmDelete = async (
  itemName: string,
  options?: Partial<Omit<ConfirmationDialogProps, 'isOpen' | 'onClose' | 'onConfirm' | 'title' | 'description'>>
) => {
  // This would be used with the hook in a component context
  return { itemName, variant: 'danger' as const, ...options };
};

export const confirmAction = async (
  title: string,
  description: string,
  options?: Partial<Omit<ConfirmationDialogProps, 'isOpen' | 'onClose' | 'onConfirm' | 'title' | 'description'>>
) => {
  return { title, description, ...options };
};
