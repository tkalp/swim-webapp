import { useState, useRef, useEffect, useCallback } from 'react';
import { Pencil } from 'lucide-react';

interface WorkoutSectionProps {
  title: string;
  content: string;
  onEdit?: (newContent: string) => void;
  editable?: boolean;
}

export function WorkoutSection({ title, content, onEdit, editable = true }: WorkoutSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing]);

  const handleDone = useCallback(() => {
    onEdit?.(editValue);
    setIsEditing(false);
  }, [editValue, onEdit]);

  const handleCancel = useCallback(() => {
    setEditValue(content);
    setIsEditing(false);
  }, [content]);

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1">
        <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">{title}</h4>
        {editable && !isEditing && (
          <button
            onClick={() => { setEditValue(content); setIsEditing(true); }}
            className="text-slate-500 hover:text-cyan-400 transition-colors"
            aria-label={`Edit ${title}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {isEditing ? (
        <div>
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            className="w-full resize-none rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleDone}
              className="px-3 py-1 text-xs rounded bg-cyan-600 text-white hover:bg-cyan-500"
            >
              Done
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1 text-xs rounded border border-slate-700 text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">{content}</pre>
      )}
    </div>
  );
}
