import { PRODUCT_COLORS, getColorSwatchStyle } from "../../constants/colors";

export default function ColorMultiSelect({ label, selected, onChange }) {
  const toggle = (color) => {
    if (selected.includes(color)) {
      onChange(selected.filter((c) => c !== color));
    } else {
      onChange([...selected, color]);
    }
  };

  return (
    <div>
      {label && (
        <p className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
          {label}
        </p>
      )}
      <div className="flex flex-wrap gap-2 p-3 border border-neutral-200 rounded-md bg-white min-h-[48px]">
        {PRODUCT_COLORS.map((color) => {
          const active = selected.includes(color);
          return (
            <button
              key={color}
              type="button"
              onClick={() => toggle(color)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                active
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 text-neutral-700 hover:border-neutral-400"
              }`}
            >
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0"
                style={getColorSwatchStyle(color)}
              />
              {color}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-neutral-400">
        Chọn một hoặc nhiều màu từ danh sách.
      </p>
    </div>
  );
}
