// components/ui/TimeInput.tsx
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clock, X, ChevronUp, ChevronDown } from 'lucide-react';

type TimeInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
};

export default function TimeInput({ value, onChange, placeholder = 'Select time', label }: TimeInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hours, setHours] = useState('06');
  const [minutes, setMinutes] = useState('00');
  const [isPM, setIsPM] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Parse value on mount or when it changes
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':');
      const hour24 = parseInt(h);
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      setHours(hour12.toString().padStart(2, '0'));
      setMinutes(m.padStart(2, '0'));
      setIsPM(hour24 >= 12);
    }
  }, [value]);

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
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isOpen]);

  const handleHoursChange = (delta: number) => {
    let newHours = parseInt(hours) + delta;
    if (newHours > 12) newHours = 1;
    if (newHours < 1) newHours = 12;
    const formatted = newHours.toString().padStart(2, '0');
    setHours(formatted);
    
    // Convert to 24-hour format for storage
    let hour24 = newHours;
    if (isPM && newHours !== 12) hour24 += 12;
    if (!isPM && newHours === 12) hour24 = 0;
    onChange(`${hour24.toString().padStart(2, '0')}:${minutes}`);
  };

  const handleMinutesChange = (delta: number) => {
    const newMinutes = (parseInt(minutes) + delta + 60) % 60;
    const formatted = newMinutes.toString().padStart(2, '0');
    setMinutes(formatted);
    
    // Convert to 24-hour format for storage
    let hour24 = parseInt(hours);
    if (isPM && hour24 !== 12) hour24 += 12;
    if (!isPM && hour24 === 12) hour24 = 0;
    onChange(`${hour24.toString().padStart(2, '0')}:${formatted}`);
  };

  const handleHoursInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 2);
    if (val === '') val = '12';
    let num = parseInt(val);
    if (num > 12) num = 12;
    if (num < 1) num = 1;
    const formatted = num.toString().padStart(2, '0');
    setHours(formatted);
    
    // Convert to 24-hour format for storage
    let hour24 = num;
    if (isPM && num !== 12) hour24 += 12;
    if (!isPM && num === 12) hour24 = 0;
    onChange(`${hour24.toString().padStart(2, '0')}:${minutes}`);
  };

  const handleMinutesInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 2);
    if (val === '') val = '00';
    const num = parseInt(val);
    if (num >= 0 && num < 60) {
      const formatted = num.toString().padStart(2, '0');
      setMinutes(formatted);
      
      // Convert to 24-hour format for storage
      let hour24 = parseInt(hours);
      if (isPM && hour24 !== 12) hour24 += 12;
      if (!isPM && hour24 === 12) hour24 = 0;
      onChange(`${hour24.toString().padStart(2, '0')}:${formatted}`);
    }
  };

  const handleAMPMToggle = () => {
    const newIsPM = !isPM;
    setIsPM(newIsPM);
    
    // Convert to 24-hour format for storage
    let hour24 = parseInt(hours);
    if (newIsPM && hour24 !== 12) hour24 += 12;
    if (!newIsPM && hour24 === 12) hour24 = 0;
    onChange(`${hour24.toString().padStart(2, '0')}:${minutes}`);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHours('06');
    setMinutes('00');
    setIsPM(false);
    onChange('06:00');
  };

  const displayValue = value ? (() => {
    const [h, m] = value.split(':');
    const hour24 = parseInt(h);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const period = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12}:${m} ${period}`;
  })() : placeholder;

  return (
    <div className="relative flex flex-col gap-2 flex-1 min-w-0" ref={containerRef}>
      {label && (
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2">
          <Clock size={14} className="text-cyan-400" />
          {label}
        </label>
      )}
      
      <div 
        className="relative flex items-center gap-2 px-4 py-2.5 bg-slate-800/60 border border-slate-700/60 rounded-lg cursor-pointer transition-all hover:border-cyan-500/50 focus-within:border-cyan-500/50 focus-within:ring-2 focus-within:ring-cyan-500/20"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Clock size={16} className="text-slate-400 shrink-0" />
        <div className="flex-1 text-slate-100 text-sm select-none">
          {displayValue}
        </div>
        {value && (
          <button
            onClick={handleClear}
            className="p-0.5 hover:bg-slate-700/50 rounded transition-colors shrink-0"
            type="button"
          >
            <X size={14} className="text-slate-400 hover:text-slate-300" />
          </button>
        )}
      </div>

      {isOpen && createPortal(
        <div
          ref={popupRef}
          className="fixed z-50 bg-slate-800/95 backdrop-blur-xl border border-slate-700/60 rounded-lg shadow-2xl shadow-black/40 p-4"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            minWidth: `${position.width}px`
          }}
        >
          <div className="flex items-center justify-center gap-4">
            {/* Hours Picker */}
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => handleHoursChange(1)}
                className="p-1.5 hover:bg-cyan-500/10 rounded-lg transition-colors"
              >
                <ChevronUp size={18} className="text-cyan-400" />
              </button>
              <input
                type="text"
                value={hours}
                onChange={handleHoursInput}
                className="w-14 text-center text-2xl font-bold bg-slate-900/60 border border-slate-700/60 rounded-lg px-2 py-2 text-slate-100 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 outline-none"
              />
              <button
                type="button"
                onClick={() => handleHoursChange(-1)}
                className="p-1.5 hover:bg-cyan-500/10 rounded-lg transition-colors"
              >
                <ChevronDown size={18} className="text-cyan-400" />
              </button>
              <span className="text-xs text-slate-500 uppercase">Hours</span>
            </div>

            <div className="text-2xl font-bold text-slate-400">:</div>

            {/* Minutes Picker */}
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => handleMinutesChange(5)}
                className="p-1.5 hover:bg-cyan-500/10 rounded-lg transition-colors"
              >
                <ChevronUp size={18} className="text-cyan-400" />
              </button>
              <input
                type="text"
                value={minutes}
                onChange={handleMinutesInput}
                className="w-14 text-center text-2xl font-bold bg-slate-900/60 border border-slate-700/60 rounded-lg px-2 py-2 text-slate-100 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 outline-none"
              />
              <button
                type="button"
                onClick={() => handleMinutesChange(-5)}
                className="p-1.5 hover:bg-cyan-500/10 rounded-lg transition-colors"
              >
                <ChevronDown size={18} className="text-cyan-400" />
              </button>
              <span className="text-xs text-slate-500 uppercase">Minutes</span>
            </div>

            {/* AM/PM Picker */}
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleAMPMToggle}
                className="p-1.5 hover:bg-cyan-500/10 rounded-lg transition-colors"
              >
                <ChevronUp size={18} className="text-cyan-400" />
              </button>
              <button
                type="button"
                onClick={handleAMPMToggle}
                className="w-14 text-center text-xl font-bold bg-slate-900/60 border border-slate-700/60 rounded-lg px-2 py-3 text-slate-100 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all cursor-pointer"
              >
                {isPM ? 'PM' : 'AM'}
              </button>
              <button
                type="button"
                onClick={handleAMPMToggle}
                className="p-1.5 hover:bg-cyan-500/10 rounded-lg transition-colors"
              >
                <ChevronDown size={18} className="text-cyan-400" />
              </button>
              <span className="text-xs text-slate-500 uppercase">Period</span>
            </div>
          </div>

          {/* Quick time presets */}
          <div className="mt-4 pt-4 border-t border-slate-700/40 flex flex-wrap gap-2">
            {['06:00', '07:00', '16:00', '17:00', '18:00'].map((time) => {
              const [h, m] = time.split(':');
              const hour24 = parseInt(h);
              const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
              const period = hour24 >= 12 ? 'PM' : 'AM';
              return (
                <button
                  key={time}
                  type="button"
                  onClick={() => {
                    setHours(hour12.toString().padStart(2, '0'));
                    setMinutes(m);
                    setIsPM(hour24 >= 12);
                    onChange(time);
                    setIsOpen(false);
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-700/40 hover:bg-cyan-500/20 border border-slate-600/40 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-400 rounded-md transition-all"
                >
                  {hour12}:{m} {period}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
