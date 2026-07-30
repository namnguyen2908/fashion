/**
 * Thêm transformation Cloudinary vào URL để lấy ảnh tối ưu.
 * @param {string} url - Cloudinary image URL gốc
 * @param {object} opts - { width, quality, format, crop, blur }
 * @returns {string} URL với transformation
 */
export function cloudinaryThumb(url, opts = {}) {
  if (!url || !url.includes("/image/upload/")) return url;

  const { width = 200, quality = "auto", format = "auto", crop, blur } = opts;
  const parts = [];

  if (crop) parts.push(`c_${crop}`);
  parts.push(`w_${width}`);
  parts.push(`q_${quality}`);
  parts.push(`f_${format}`);
  if (blur) parts.push(`e_blur:${blur}`);

  return url.replace("/image/upload/", `/image/upload/${parts.join(",")}/`);
}
