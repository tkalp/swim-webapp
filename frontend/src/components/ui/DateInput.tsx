// components/ui/DateInput.tsx
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { Calendar, X } from 'lucide-react';
import 'react-day-picker/dist/style.css';

type DateInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
};

export default function DateInput({ value, onChange, placeholder, label }: DateInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Parse date string as local time, not UTC
  const parseLocalDate = (dateStr: string): Date | undefined => {
    if (!dateStr) return undefined;
    // Split yyyy-MM-dd and create date in local timezone
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    value ? parseLocalDate(value) : undefined
  );
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target as Node) &&
        popupRef.current &&
        !popupRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX
      });
    }
  }, [isOpen]);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'));
      setIsOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDate(undefined);
    onChange('');
  };

  return (
    <div className="relative flex flex-col gap-2 flex-1 min-w-0" ref={containerRef}>
      {label && (
        <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
          {label}
        </label>
      )}
      
      <div 
        className="relative flex items-center bg-[var(--color-background-tertiary)] border border-[var(--color-border)] rounded-lg cursor-pointer transition-all hover:border-[var(--color-border-light)] hover:bg-[var(--color-background-secondary)] focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Calendar size={16} className="absolute left-2.5 text-[var(--color-text-muted)] pointer-events-none z-10" />
        <input
          type="text"
          className="w-full bg-transparent border-none text-[var(--color-text-primary)] px-9 py-2 text-sm font-medium outline-none cursor-pointer placeholder:text-[var(--color-text-muted)] placeholder:opacity-60"
          value={selectedDate ? format(selectedDate, 'MMM d, yyyy') : ''}
          placeholder={placeholder || 'Select date'}
          readOnly
        />
        {selectedDate && (
          <button
            className="absolute right-2 w-5 h-5 rounded-full bg-[var(--color-background-secondary)] border-none text-[var(--color-text-muted)] cursor-pointer flex items-center justify-center transition-all hover:bg-[var(--color-background-tertiary)] hover:text-[var(--color-text-primary)] z-10"
            onClick={handleClear}
            type="button"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && createPortal(
        <div 
          ref={popupRef}
          className="fixed z-[9999] bg-[var(--color-background-elevated)] border border-[var(--color-border-light)] rounded-xl shadow-2xl backdrop-blur-sm p-4 animate-[fadeIn_0.15s_ease-out]"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`
          }}
        >
          <style>
            {`
              .rdp-custom {
                --rdp-cell-size: 40px;
                --rdp-accent-color: var(--color-primary);
                --rdp-background-color: var(--color-primary);
                margin: 0;
              }
              
              /* Caption - Month/Year Dropdowns */
              .rdp-custom .rdp-caption {
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 0.75rem 0 1rem 0;
                margin-bottom: 0.5rem;
              }
              .rdp-custom .rdp-caption_dropdowns {
                display: flex;
                gap: 0.75rem;
                justify-content: center;
              }
              .rdp-custom .rdp-dropdown {
                background: var(--color-background-tertiary);
                border: 1px solid var(--color-border);
                border-radius: 0.5rem;
                padding: 0.5rem 0.75rem;
                color: var(--color-text-primary);
                font-size: 0.875rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                min-width: 100px;
              }
              .rdp-custom .rdp-dropdown:hover {
                background: var(--color-background-secondary);
                border-color: var(--color-primary);
                box-shadow: 0 0 0 3px var(--color-primary-alpha-20);
              }
              .rdp-custom .rdp-dropdown:focus {
                outline: none;
                border-color: var(--color-primary);
                box-shadow: 0 0 0 3px var(--color-primary-alpha-20);
              }
              
              /* Hide navigation arrows */
              .rdp-custom .rdp-nav {
                display: none;
              }
              
              /* Table */
              .rdp-custom .rdp-table {
                margin: 0;
              }
              
              /* Header - Day names */
              .rdp-custom .rdp-head_cell {
                color: var(--color-text-muted);
                font-weight: 600;
                font-size: 0.75rem;
                text-transform: uppercase;
                padding: 0.5rem 0;
                letter-spacing: 0.05em;
              }
              
              /* Day cells */
              .rdp-custom .rdp-cell {
                padding: 2px;
              }
              
              /* Day buttons */
              .rdp-custom .rdp-button {
                border: none;
                background: transparent;
                color: var(--color-text-primary);
                font-size: 0.875rem;
                font-weight: 500;
                border-radius: 0.5rem;
                width: 40px;
                height: 40px;
                transition: all 0.2s ease;
                cursor: pointer;
              }
              
              .rdp-custom .rdp-button:hover:not(.rdp-day_selected):not(.rdp-day_disabled) {
                background: var(--color-background-secondary);
                color: var(--color-text-primary);
                transform: scale(1.05);
              }
              
              /* Selected day */
              .rdp-custom .rdp-day_selected {
                background: linear-gradient(135deg, var(--color-primary-dark), var(--color-primary), var(--color-accent)) !important;
                color: white !important;
                font-weight: 700;
                box-shadow: 0 4px 12px var(--color-primary-alpha-30);
              }
              
              .rdp-custom .rdp-day_selected:hover {
                background: linear-gradient(135deg, var(--color-primary-dark), var(--color-primary), var(--color-accent)) !important;
                transform: scale(1.05);
              }
              
              /* Today */
              .rdp-custom .rdp-day_today:not(.rdp-day_selected) {
                background: var(--color-background-tertiary);
                color: var(--color-primary);
                font-weight: 700;
                border: 2px solid var(--color-primary);
              }
              
              /* Outside days (other months) */
              .rdp-custom .rdp-day_outside {
                color: var(--color-text-muted);
                opacity: 0.4;
              }
              
              /* Disabled days */
              .rdp-custom .rdp-day_disabled {
                color: var(--color-text-muted);
                opacity: 0.3;
                cursor: not-allowed;
              }
              
              .rdp-custom .rdp-day_disabled:hover {
                background: transparent;
                transform: none;
              }
            `}
          </style>
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            showOutsideDays
            className="rdp-custom"
            captionLayout="dropdown"
            fromYear={1900}
            toYear={new Date().getFullYear() + 1}
          />
        </div>,
        document.body
      )}
    </div>
  );
}