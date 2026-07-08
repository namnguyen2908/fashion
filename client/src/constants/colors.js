export const PRODUCT_COLORS = [
  "Đen",
  "Trắng",
  "Xám",
  "Be/Kem",
  "Nâu",
  "Đỏ",
  "Vàng",
  "Xanh lá",
  "Xanh dương",
  "Tím than",
  "Xanh đá",
];

const stripAccents = (str) =>
  str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const normalizeColorKey = (name) =>
  stripAccents((name || "").toLowerCase().trim()).replace(/\s+/g, " ");

/** Chuẩn hóa tên màu từ DB về danh sách cố định (nếu khớp). */
export const normalizeColorName = (name) => {
  if (!name) return "";
  const key = normalizeColorKey(name);
  const found = PRODUCT_COLORS.find((c) => normalizeColorKey(c) === key);
  return found || name;
};

const COLOR_HEX_MAP = {
  den: "#1a1a1a",
  trang: "#f5f5f5",
  xam: "#9ca3af",
  "be/kem": "#e8dcc8",
  nau: "#6b4423",
  do: "#dc2626",
  vang: "#eab308",
  "xanh la": "#22c55e",
  "xanh duong": "#3b82f6",
  "tim than": "#312e81",
  "xanh da": "#5b9aa9",
};

export const getColorSwatchStyle = (colorName) => {
  const key = normalizeColorKey(colorName);
  const hex = COLOR_HEX_MAP[key];
  if (!hex) return { backgroundColor: "#d4d4d4" };
  const style = { backgroundColor: hex };
  if (key === "trang") {
    style.border = "1px solid #d4d4d4";
  }
  return style;
};

export const sortColors = (colors) => {
  const order = new Map(PRODUCT_COLORS.map((c, i) => [normalizeColorKey(c), i]));
  return [...colors].sort((a, b) => {
    const ia = order.get(normalizeColorKey(a)) ?? 999;
    const ib = order.get(normalizeColorKey(b)) ?? 999;
    return ia - ib;
  });
};
