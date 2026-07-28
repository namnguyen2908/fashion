export const formatVND = (amount) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

export const calcDiscountLabel = (listPrice, oldPrice) => {
  const current = Number(listPrice);
  const base = oldPrice != null ? Number(oldPrice) : null;
  if (!base || base <= current) return null;
  return `-${Math.round((1 - current / base) * 100)}%`;
};

export const pickDisplayVariant = (variants) => {
  if (!variants?.length) return null;
  const onSale = variants.filter(
    (v) => v.old_price != null && Number(v.old_price) > Number(v.list_price)
  );
  if (onSale.length) {
    return onSale.reduce((a, b) => (Number(a.list_price) <= Number(b.list_price) ? a : b));
  }
  return variants.reduce((a, b) => (Number(a.list_price) <= Number(b.list_price) ? a : b));
};
