import { useState, useRef, useEffect } from "react";
import api from "../../services/api";
import { IconSearch, IconChevron, IconSpinner } from "./Icons";

export default function ProductSearchSelect({
  onSelect,
  placeholder = "Tìm sản phẩm để thêm...",
  disabled = false,
  optionLabel = (p) => p.name,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/products", { params: { search: q, limit: 8 } });
        setResults(data?.data ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

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

  const handleQueryChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      setLoading(false);
    } else {
      setLoading(true);
    }
  };

  const pick = (product) => {
    onSelect(product);
    setQuery("");
    setResults([]);
    setLoading(false);
    setHighlightedIndex(-1);
    setOpen(true);
    inputRef.current?.focus();
  };

  const toggle = () => {
    if (open) {
      setOpen(false);
    } else {
      setQuery("");
      setResults([]);
      setLoading(false);
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
      if (results.length === 0) return;
      setHighlightedIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length === 0) return;
      setHighlightedIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && results[highlightedIndex]) {
        pick(results[highlightedIndex]);
      }
    }
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-md border bg-white px-4 py-2.5 text-sm outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          open ? "border-neutral-400" : "border-neutral-200"
        } text-neutral-400 focus:border-neutral-400`}
      >
        <span className="truncate text-left">{placeholder}</span>
        <IconChevron expanded={open} className="h-4 w-4 shrink-0 text-neutral-400" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
          <div className="border-b border-neutral-100 p-2">
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleQueryChange}
                onKeyDown={handleKeyDown}
                placeholder="Tìm kiếm sản phẩm..."
                role="combobox"
                aria-expanded="true"
                aria-controls="product-search-listbox"
                aria-activedescendant={
                  highlightedIndex >= 0 ? `product-search-option-${highlightedIndex}` : undefined
                }
                className="w-full rounded-md border border-neutral-200 py-2 pl-10 pr-3 text-sm outline-none transition-colors focus:border-neutral-400"
              />
            </div>
          </div>

          <div
            id="product-search-listbox"
            role="listbox"
            ref={listRef}
            className="max-h-60 overflow-y-auto py-1"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-3 py-4 text-neutral-400">
                <IconSpinner className="h-4 w-4" />
                <span className="text-sm">Đang tìm kiếm...</span>
              </div>
            ) : !query.trim() ? (
              <p className="px-3 py-4 text-center text-sm text-neutral-400">Nhập từ khóa để tìm sản phẩm</p>
            ) : results.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-neutral-400">Không tìm thấy dữ liệu</p>
            ) : (
              results.map((p, index) => {
                const isHighlighted = index === highlightedIndex;
                return (
                  <button
                    key={p.id}
                    type="button"
                    id={`product-search-option-${index}`}
                    role="option"
                    aria-selected={isHighlighted}
                    data-highlighted={isHighlighted}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => pick(p)}
                    className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                      isHighlighted
                        ? "bg-neutral-100 text-neutral-900"
                        : "text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    {optionLabel(p)}
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
