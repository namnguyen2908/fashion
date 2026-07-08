/**
 * Thêm transformation Cloudinary vào URL để lấy ảnh nhỏ hơn.
 * @param {string} url - Cloudinary image URL gốc
 * @param {object} opts - { width, quality }
 * @returns {string} URL với transformation
 */
export function cloudinaryThumb(url, opts = {}) {
  if (!url || !url.includes("/image/upload/")) return url;

  const { width = 200, quality = "auto" } = opts;
  const transform = `c_scale,w_${width},q_${quality}`;

  return url.replace("/image/upload/", `/image/upload/${transform}/`);
}
