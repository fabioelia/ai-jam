import { useState } from 'react';
import type { ReactNode } from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

function Modal({ children, onClose, title }: { children: ReactNode; onClose: () => void; title?: string }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[85vh] shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col"
      >
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-white">{title || 'Help'}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-gray-800 p-2 rounded-lg transition-all duration-200 hover:shadow-sm active:bg-gray-700 active:scale-95"
            aria-label="Close help"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}

interface HelpSectionProps {
  title: string;
  children: ReactNode;
}

function HelpSection({ title, children }: HelpSectionProps) {
  return (
    <div className="mb-6 last:mb-0">
      <h3 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}

interface HelpItemProps {
  question: string;
  answer: string | ReactNode;
}

function HelpItem({ question, answer }: HelpItemProps) {
  return (
    <div className="mb-4 last:mb-0">
      <h4 className="text-white font-medium mb-1">{question}</h4>
      <p className="text-gray-400 text-sm leading-relaxed">{answer}</p>
    </div>
  );
}

interface ShortcutProps {
  keys: string[];
  description: string;
}

function Shortcut({ keys, description }: ShortcutProps) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex gap-1 shrink-0">
        {keys.map((key, index) => (
          <div key={key} className="flex items-center gap-0.5">
            <kbd className="text-xs text-gray-300 bg-gray-800 border border-gray-700 px-2 py-1 rounded font-mono shadow-sm">
              {key}
            </kbd>
            {index < keys.length - 1 && (
              <span className="text-gray-500 text-xs">+</span>
            )}
          </div>
        ))}
      </div>
      <span className="text-sm text-gray-400">{description}</span>
    </div>
  );
}

interface FeatureProps {
  title: string;
  description: string;
  icon?: ReactNode;
}

function Feature({ title, description, icon }: FeatureProps) {
  return (
    <div className="flex gap-3 p-3 rounded-lg bg-gray-800/30 border border-gray-700/50 hover:bg-gray-800/50 hover:border-gray-700 transition-all duration-200">
      {icon && (
        <div className="shrink-0 w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center text-indigo-400">
          {icon}
        </div>
      )}
      <div>
        <h4 className="text-white font-medium mb-1">{title}</h4>
        <p className="text-gray-400 text-sm">{description}</p>
      </div>
    </div>
  );
}

export default function HelpModal({ isOpen, onClose, title, children }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <Modal onClose={onClose} title={title}>
      {children}
    </Modal>
  );
}

// Export sub-components for composition
export { HelpSection, HelpItem, Shortcut, Feature };
