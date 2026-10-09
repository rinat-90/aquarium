
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import './ui.css';

type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
};

export function Select({
                         value,
                         options,
                         onChange,
                         disabled = false,
                         ariaLabel = 'Select option',
                       }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedIndex = options.findIndex(
    (option) => option.value === value,
  );
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (
        !containerRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', onPointerDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  function choose(index: number) {
    const option = options[index];
    if (!option) return;

    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;

    if (event.key === 'Escape') {
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();

      if (!options.length) return;

      if (!open) {
        setActiveIndex(Math.max(0, selectedIndex));
        setOpen(true);
      } else {
        setActiveIndex((current) =>
          event.key === 'ArrowDown'
            ? (current + 1) % options.length
            : (current - 1 + options.length) % options.length,
        );
      }
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();

      if (open) {
        choose(activeIndex);
      } else {
        setActiveIndex(Math.max(0, selectedIndex));
        setOpen(true);
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className="ui-select"
      onKeyDown={handleKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`ui-select-trigger ${open ? 'is-open' : ''}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          setActiveIndex(Math.max(0, selectedIndex));
          setOpen((current) => !current);
        }}
      >
        <span className="ui-select-icon">🌊</span>
        <span className="ui-select-label">
          {selected?.label ?? 'Select aquarium'}
        </span>
        <svg
          className={`ui-select-chevron ${open ? 'is-open' : ''}`}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="ui-select-menu"
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className={`ui-select-option ${
                index === activeIndex ? 'is-active' : ''
              }`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
              {option.value === value && <span>✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
