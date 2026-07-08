import { normalizeColorKey, normalizeColorName, sortColors } from "../constants/colors";

/** Một ảnh gắn với bất kỳ variant nào cùng màu — dùng chung cho mọi size. */
export function getVariantIdsForColor(variants, color) {
  const key = normalizeColorKey(color);
  return variants
    .filter((v) => normalizeColorKey(v.color) === key)
    .map((v) => v.id);
}

export function getVariantIdForColor(variants, color) {
  const ids = getVariantIdsForColor(variants, color);
  return ids[0] ?? null;
}

export function getUniqueColorsFromVariants(variants) {
  return sortColors([
    ...new Set(
      variants.map((v) => normalizeColorName(v.color)).filter(Boolean)
    ),
  ]);
}

export function getColorNameForVariantId(variants, variantId) {
  const variant = variants.find((v) => v.id === variantId);
  return variant ? normalizeColorName(variant.color) : null;
}

/** Ảnh hiển thị khi hover/chọn một màu trên storefront. */
export function getImageForColor(images, variants, color) {
  const variantIds = new Set(getVariantIdsForColor(variants, color));
  if (variantIds.size > 0) {
    const match = images.find(
      (img) => img.variant_id && variantIds.has(img.variant_id)
    );
    if (match?.image_url) return match.image_url;
  }
  const thumb = images.find((img) => img.is_thumbnail);
  return thumb?.image_url || images[0]?.image_url || null;
}
