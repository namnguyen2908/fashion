import { PRODUCT_COLORS, normalizeColorName } from "../../constants/colors";

export default function ColorSelect({
  value,
  onChange,
  className = "",
  allowEmpty = false,
  emptyLabel = "Chọn màu",
  required = false,
}) {
  const normalized = normalizeColorName(value);
  const displayValue = normalized || value || "";
  const inCatalog = PRODUCT_COLORS.includes(displayValue);
  const hasLegacy = displayValue && !inCatalog;

  return (
    <select
      value={displayValue}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className={className}
    >
      {(allowEmpty || (required && !displayValue)) && (
        <option value="" disabled={required && !allowEmpty}>
          {emptyLabel}
        </option>
      )}
      {PRODUCT_COLORS.map((color) => (
        <option key={color} value={color}>
          {color}
        </option>
      ))}
      {hasLegacy && (
        <option value={displayValue}>{displayValue} (không có trong danh sách)</option>
      )}
    </select>
  );
}
