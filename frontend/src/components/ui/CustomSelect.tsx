import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "../../styles/CustomSelect.css";

export type Option = { value: string; label: string };

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxMenuHeight?: number; // px
};

export default function CustomSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  className = "",
  disabled = false,
  maxMenuHeight = 280,
}: Props) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const [activeIndex, setActiveIndex] = useState<number>(() => {
    const i = options.findIndex(o => o.value === value);
    return i >= 0 ? i : 0;
  });

  const selected = options.find(o => o.value === value);
  const labelText = selected?.label ?? placeholder ?? "Select…";

  const close = () => setOpen(false);
  const openMenu = () => setOpen(true);
  const toggle = () => setOpen(o => !o);

  // Position the floating menu just below the button
  const updateMenuPos = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuPos({
      top: Math.round(r.bottom + window.scrollY + 6),
      left: Math.round(r.left + window.scrollX),
      width: Math.max(160, Math.round(r.width)),
    });
  };

  useLayoutEffect(() => {
    if (open) updateMenuPos();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updateMenuPos();
    const onClickAway = (e: MouseEvent) => {
      if (!btnRef.current) return;
      const t = e.target as Node;
      if (!btnRef.current.contains(t)) close();
    };
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    document.addEventListener("mousedown", onClickAway);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
      document.removeEventListener("mousedown", onClickAway);
    };
  }, [open]);

  // Keyboard support
  const onKeyDownBtn: React.KeyboardEventHandler = (e) => {
    if (disabled) return;
    if (e.key === " " || e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(Math.max(0, options.findIndex(o => o.value === value)));
      openMenu();
    }
  };

  const onKeyDownMenu: React.KeyboardEventHandler = (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => Math.min(options.length - 1, i + 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(i => Math.max(0, i - 1)); return; }
    if (e.key === "Home") { e.preventDefault(); setActiveIndex(0); return; }
    if (e.key === "End") { e.preventDefault(); setActiveIndex(options.length - 1); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = options[activeIndex];
      if (opt) {
        onChange(opt.value);
        close();
      }
    }
  };

  return (
    <div className={`cs-field ${className} ${disabled ? "is-disabled" : ""}`}>
      {label && <label className="cs-label">{label}</label>}
      <button
        ref={btnRef}
        type="button"
        className={`cs-button ${open ? "is-open" : ""}`}
        onClick={toggle}
        onKeyDown={onKeyDownBtn}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`cs-value ${selected ? "" : "is-placeholder"}`}>{labelText}</span>
        <svg className="cs-caret" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        <span className="cs-outline" />
      </button>

      {open &&
        createPortal(
          <div
            className="cs-menu"
            style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width, maxHeight: maxMenuHeight }}
            role="listbox"
            tabIndex={-1}
            onKeyDown={onKeyDownMenu}
          >
            {options.map((opt, i) => {
              const selected = opt.value === value;
              const active = i === activeIndex;
              return (
                <div
                  key={opt.value || i}
                  role="option"
                  aria-selected={selected}
                  className={`cs-option ${selected ? "is-selected" : ""} ${active ? "is-active" : ""}`}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(opt.value);
                    close();
                  }}
                >
                  {opt.label}
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
