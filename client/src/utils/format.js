export const formatVND = (amount) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

export const calcDiscountLabel = (currentPrice, originalPrice) => {
  const current = Number(currentPrice);
  const base = originalPrice != null ? Number(originalPrice) : null;
  if (!base || base <= current || current <= 0) return null;
  return `-${Math.round((1 - current / base) * 100)}%`;
};

export const pickDisplayVariant = (variants) => {
  if (!variants?.length) return null;
  const onSale = variants.filter((v) => v.is_on_sale);
  if (onSale.length) {
    return onSale.reduce((a, b) => (Number(a.effective_price) <= Number(b.effective_price) ? a : b));
  }
  return variants.reduce((a, b) => (Number(a.price) <= Number(b.price) ? a : b));
};
