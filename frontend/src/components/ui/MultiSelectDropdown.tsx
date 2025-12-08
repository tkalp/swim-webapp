// components/ui/MultiSelectDropdown.tsx
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Check } from 'lucide-react';

export interface MultiSelectOption {
  id: string;
  name: string;
  color?: string;
}

interface MultiSelectDropdownProps {
  options: MultiSelectOption[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  placeholder?: string;
  label?: string;
  maxHeight?: string;
}

export default function MultiSelectDropdown({
  options,
  selectedIds,
  onChange,
  placeholder = 'Select options...',
  label,
  maxHeight = '300px'
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Update dropdown position when opening
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8, // 8px gap (mt-2)
        left: rect.left,
        width: rect.width
      });
    }
  }, [isOpen]);

  // Close dropdown on scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleScroll = () => {
      setIsOpen(false);
    };

    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleOption = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const selectedOptions = options.filter(opt => selectedIds.includes(opt.id));

  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-2">
          {label}
        </label>
      )}
      
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-slate-800/50 border border-slate-700/40 rounded-xl text-slate-100 hover:bg-slate-700/50 hover:border-slate-600/50 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
      >
        <div className="flex-1 flex items-center gap-2 overflow-hidden">
          {selectedOptions.length === 0 ? (
            <span className="text-slate-500">{placeholder}</span>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              {selectedOptions.map(option => (
                <span
                  key={option.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border"
                  style={{
                    backgroundColor: option.color ? `${option.color}20` : 'rgb(51 65 85 / 0.5)',
                    color: option.color || 'rgb(148 163 184)',
                    borderColor: option.color ? `${option.color}40` : 'rgb(71 85 105 / 0.4)',
                  }}
                >
                  {option.name}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleOption(option.id);
                    }}
                    className="hover:opacity-70 transition-opacity cursor-pointer inline-flex items-center"
                    role="button"
                    aria-label={`Remove ${option.name}`}
                  >
                    <X size={12} />
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          {selectedOptions.length > 0 && (
            <span
              onClick={handleClearAll}
              className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer inline-flex items-center"
              role="button"
              aria-label="Clear all"
            >
              <X size={16} />
            </span>
          )}
          <ChevronDown
            size={18}
            className={`text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu - Rendered as Portal */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-slate-800/95 backdrop-blur-xl border border-slate-700/60 rounded-xl shadow-2xl overflow-hidden"
          style={{ 
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            maxHeight,
            zIndex: 9999
          }}
        >
          <div className="overflow-y-auto max-h-full custom-scrollbar">
            {options.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-500 text-center">
                No options available
              </div>
            ) : (
              <div className="py-1">
                {options.map((option) => {
                  const isSelected = selectedIds.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleToggleOption(option.id)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-700/50 transition-colors text-left"
                    >
                      <span
                        className="flex-1 text-sm font-medium"
                        style={{ color: option.color || 'rgb(226 232 240)' }}
                      >
                        {option.name}
                      </span>
                      {isSelected && (
                        <Check
                          size={16}
                          className="shrink-0"
                          style={{ color: option.color || 'rgb(34 211 238)' }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
