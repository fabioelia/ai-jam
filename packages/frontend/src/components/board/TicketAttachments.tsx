import { useState, useRef } from 'react';

interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: string;
}

interface TicketAttachmentsProps {
  attachments: Attachment[];
  onUpload: (files: File[]) => Promise<void>;
  onDelete: (attachmentId: string) => Promise<void>;
  readOnly?: boolean;
}

export default function TicketAttachments({
  attachments,
  onUpload,
  onDelete,
  readOnly = false,
}: TicketAttachmentsProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (type: string): string => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎥';
    if (type.startsWith('audio/')) return '🎵';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
    if (type.includes('powerpoint') || type.includes('presentation')) return '📽️';
    if (type.includes('zip') || type.includes('compressed')) return '📦';
    if (type.includes('code') || type.endsWith('.js') || type.endsWith('.ts') || type.endsWith('.py')) return '💻';
    return '📎';
  };

  const isPreviewable = (type: string): boolean => {
    return type.startsWith('image/') || type.startsWith('video/') || type.includes('pdf');
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (readOnly || uploading) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await handleUpload(files);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await handleUpload(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async (files: File[]) => {
    try {
      setUploading(true);
      await onUpload(files);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachmentId: string) => {
    try {
      await onDelete(attachmentId);
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-300">Attachments ({attachments.length})</h3>

      {/* Upload area */}
      {!readOnly && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
            ${dragActive ? 'border-indigo-500 bg-indigo-500/5' : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/50'}
            ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />
          <div className="flex flex-col items-center gap-2">
            {uploading ? (
              <>
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-400">Uploading...</p>
              </>
            ) : (
              <>
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-300">Drop files here or click to upload</p>
                  <p className="text-xs text-gray-500 mt-1">Images, documents, code files supported</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Attachments list */}
      {attachments.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </div>
            <p className="text-xs text-gray-600">No attachments yet</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <AttachmentItem
              key={attachment.id}
              attachment={attachment}
              onDelete={handleDelete}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AttachmentItem({
  attachment,
  onDelete,
  readOnly,
}: {
  attachment: Attachment;
  onDelete: (id: string) => Promise<void>;
  readOnly: boolean;
}) {
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const loadPreview = async () => {
    if (attachment.type.startsWith('image/')) {
      try {
        const response = await fetch(attachment.url);
        const blob = await response.blob();
        setPreviewImage(URL.createObjectURL(blob));
      } catch (error) {
        console.error('Failed to load preview:', error);
      }
    }
  };

  const handlePreviewClick = () => {
    if (!previewExpanded && attachment.type.startsWith('image/')) {
      loadPreview();
    }
    setPreviewExpanded(!previewExpanded);
  };

  return (
    <div
      className={`
        relative bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden transition-all
        ${previewExpanded ? 'p-4' : 'p-3'}
      `}
    >
      {/* Main content */}
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center shrink-0">
          <span className="text-lg">{attachment.type.startsWith('image/') ? '🖼️' : '📎'}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-white truncate">{attachment.name}</h4>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{formatFileSize(attachment.size)}</span>
            <span>•</span>
            <span>{new Date(attachment.uploadedAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {attachment.type.startsWith('image/') && (
            <button
              onClick={handlePreviewClick}
              className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-all"
              title="Preview"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          )}

          <a
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-all"
            title="Download"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>

          {!readOnly && (
            <button
              onClick={() => onDelete(attachment.id)}
              className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a2 2 0 012-2h2a2 2 0 012 2v2M7 7h10" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Image preview */}
      {previewExpanded && previewImage && (
        <div className="mt-3 animate-in fade-in slide-in-from-top duration-200">
          <img
            src={previewImage}
            alt={attachment.name}
            className="max-w-full max-h-96 rounded-lg mx-auto"
          />
        </div>
      )}
    </div>
  );
}
