import { useState, useRef, useMemo, useEffect } from "react";
import { IconSearch, IconChevron } from "./Icons";

export default function AutocompleteSelect({ options, value, onChange, placeholder = "Chọn mục" }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selected = options.find((o) => String(o.value) === String(value));

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase().trim();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    const handler = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    const el = listRef.current?.querySelector('[data-highlighted="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  const select = (opt) => {
    onChange(opt?.value || "");
    setQuery("");
    setOpen(false);
    setHighlightedIndex(-1);
  };

  const toggle = () => {
    if (open) {
      setOpen(false);
    } else {
      setQuery("");
      setHighlightedIndex(-1);
      setOpen(true);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filtered.length === 0) return;
      setHighlightedIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filtered.length === 0) return;
      setHighlightedIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && filtered[highlightedIndex]) {
        select(filtered[highlightedIndex]);
      }
    }
  };

  return (
    <div ref={rootRef} className="relative w-full sm:w-64">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 border rounded-md bg-white px-4 py-2.5 text-sm outline-none transition-colors ${
          open ? "border-neutral-400" : "border-neutral-200"
        } focus:border-neutral-400 ${selected ? "text-neutral-900" : "text-neutral-400"}`}
      >
        <span className="truncate text-left">{selected ? selected.label : placeholder}</span>
        <IconChevron expanded={open} className="h-4 w-4 shrink-0 text-neutral-400" />
      </button>

      {value && (
        <button
          type="button"
          aria-label="Xóa lựa chọn"
          onClick={(e) => {
            e.stopPropagation();
            select(null);
            inputRef.current?.focus();
          }}
          className="absolute right-9 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-neutral-400 transition-colors hover:text-neutral-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
          <div className="border-b border-neutral-100 p-2">
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlightedIndex(-1);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Tìm kiếm..."
                role="combobox"
                aria-expanded="true"
                aria-controls="autocomplete-select-listbox"
                aria-activedescendant={
                  highlightedIndex >= 0 ? `autocomplete-select-option-${highlightedIndex}` : undefined
                }
                className="w-full rounded-md border border-neutral-200 py-2 pl-10 pr-3 text-sm outline-none transition-colors focus:border-neutral-400"
              />
            </div>
          </div>

          <div
            id="autocomplete-select-listbox"
            role="listbox"
            ref={listRef}
            className="max-h-60 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-neutral-400">Không tìm thấy dữ liệu</p>
            ) : (
              filtered.map((opt, index) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = index === highlightedIndex;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    id={`autocomplete-select-option-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    data-highlighted={isHighlighted}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => select(opt)}
                    className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? "bg-neutral-900 text-white"
                        : isHighlighted
                          ? "bg-neutral-100 text-neutral-900"
                          : "text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
