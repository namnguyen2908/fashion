import { normalizeColorKey, normalizeColorName, sortColors } from "../constants/colors";

/** Lấy danh sách màu duy nhất từ variants. */
export function getUniqueColorsFromVariants(variants) {
  return sortColors([
    ...new Set(
      variants.map((v) => normalizeColorName(v.color)).filter(Boolean)
    ),
  ]);
}

/** Ảnh hiển thị khi hover/chọn một màu trên storefront. */
export function getImageForColor(images, color) {
  if (!color) {
    const thumb = images.find((img) => img.is_thumbnail);
    return thumb?.image_url || images[0]?.image_url || null;
  }

  const key = normalizeColorKey(color);
  const match = images.find((img) => img.color && normalizeColorKey(img.color) === key);
  if (match?.image_url) return match.image_url;

  const thumb = images.find((img) => img.is_thumbnail);
  return thumb?.image_url || images[0]?.image_url || null;
}
