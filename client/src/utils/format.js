export const formatVND = (amount) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

export const calcDiscountLabel = (comparePrice, price) => {
  const compare = Number(comparePrice);
  const current = Number(price);
  if (!compare || compare <= current) return null;
  return `-${Math.round((1 - current / compare) * 100)}%`;
};

export const pickDisplayVariant = (variants) => {
  if (!variants?.length) return null;
  const onSale = variants.filter(
    (v) => v.compare_price != null && Number(v.compare_price) > Number(v.price)
  );
  if (onSale.length) {
    return onSale.reduce((a, b) => (Number(a.price) <= Number(b.price) ? a : b));
  }
  return variants.reduce((a, b) => (Number(a.price) <= Number(b.price) ? a : b));
};
