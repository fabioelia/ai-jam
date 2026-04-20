import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface DragFeedbackProps {
  id: string;
  children: React.ReactNode;
  type?: string;
  data?: any;
  disabled?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export default function DragFeedback({
  id,
  children,
  type = 'TICKET',
  data,
  disabled = false,
  onDragStart,
  onDragEnd,
}: DragFeedbackProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id,
    data: { type, ...data },
    disabled,
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    cursor: 'grabbing',
  } : {
    cursor: 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`relative transition-transform duration-75 ease-out ${isDragging ? 'z-50' : ''}`}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {children}

      {/* Dragging indicator */}
      {isDragging && (
        <>
          {/* Glow effect */}
          <div className="absolute inset-0 bg-indigo-500/10 rounded-xl animate-pulse pointer-events-none" />

          {/* Shadow */}
          <div className="absolute -inset-1 bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl pointer-events-none blur-xl" />

          {/* Floating badge */}
          <div className="absolute -top-3 -right-3 bg-indigo-500 text-white text-xs font-medium px-2 py-1 rounded-lg shadow-lg animate-bounce pointer-events-none">
            Moving
          </div>

          {/* Ghost trail effect */}
          <div className="absolute top-2 left-2 w-4 h-4 bg-indigo-500/30 rounded-full blur-md pointer-events-none" />
          <div className="absolute top-6 left-6 w-3 h-3 bg-indigo-500/20 rounded-full blur-sm pointer-events-none" />
          <div className="absolute top-10 left-10 w-2 h-2 bg-indigo-500/10 rounded-full blur-xs pointer-events-none" />
        </>
      )}

      {/* Hover grab indicator (only show when not dragging) */}
      {!isDragging && !disabled && (
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          {/* Top border hint */}
          <div className="absolute top-0 left-2 right-2 h-0.5 bg-indigo-500/30 rounded-full" />

          {/* Grab icon hint */}
          <div className="absolute top-1/2 right-1/2 -translate-y-1/2 -translate-x-1/2 p-1.5 bg-indigo-500 rounded-full opacity-0 hover:opacity-100 transition-opacity duration-200">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 12v4m0-4h-4M12 8V4m0 0h4M12 12v4m0-4h-4M20 8V4m0 0h4M20 12v4m0-4h-4" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

// Drop zone feedback component
interface DropZoneFeedbackProps {
  onDrop: (item: any) => void;
  isActive?: boolean;
  isOver?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function DropZoneFeedback({
  onDrop,
  isActive = false,
  isOver = false,
  children,
  className = '',
}: DropZoneFeedbackProps) {
  const { setNodeRef } = useDraggable({ id: 'drop-zone' });

  const getFeedbackClass = () => {
    if (!isActive) return '';
    if (!isOver) return 'border-dashed border-gray-700/30';
    return 'border-2 border-indigo-500 bg-indigo-500/10';
  };

  return (
    <div
      ref={setNodeRef}
      className={`relative transition-all duration-300 ease-out ${getFeedbackClass()} ${className}`}
    >
      {children}

      {/* Drop feedback overlays */}
      {isActive && isOver && (
        <>
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-xl animate-pulse pointer-events-none" />

          {/* Corner indicators */}
          <div className="absolute -top-1 -left-1 w-6 h-6 border-l-2 border-t-2 border-indigo-500 rounded-tl-xl pointer-events-none animate-bounce" style={{ animationDelay: '0.1s' }} />
          <div className="absolute -top-1 -right-1 w-6 h-6 border-r-2 border-t-2 border-indigo-500 rounded-tr-xl pointer-events-none animate-bounce" style={{ animationDelay: '0.2s' }} />
          <div className="absolute -bottom-1 -left-1 w-6 h-6 border-l-2 border-b-2 border-indigo-500 rounded-bl-xl pointer-events-none animate-bounce" style={{ animationDelay: '0.3s' }} />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 border-r-2 border-b-2 border-indigo-500 rounded-br-xl pointer-events-none animate-bounce" style={{ animationDelay: '0.4s' }} />

          {/* Center message */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-indigo-500 text-white px-4 py-2 rounded-lg shadow-xl animate-bounce text-sm font-medium">
              Drop here
            </div>
          </div>

          {/* Animated ring */}
          <div className="absolute inset-0 rounded-xl pointer-events-none">
            <div className="absolute inset-0 border-2 border-indigo-500/30 rounded-xl animate-ping" />
          </div>
        </>
      )}

      {/* Empty drop zone hint */}
      {isActive && !isOver && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-gray-600 text-xs font-medium bg-gray-900/90 px-3 py-2 rounded-lg border border-gray-700/50">
            Drag tickets here
          </div>
        </div>
      )}
    </div>
  );
}
