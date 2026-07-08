import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../../services/api";
import { useCart } from "../../context/CartContext";
import { formatVND, calcDiscountLabel, pickDisplayVariant } from "../../utils/format";
import { getImageForColor, getUniqueColorsFromVariants } from "../../utils/productImages";
import { getColorSwatchStyle, normalizeColorName } from "../../constants/colors";
import { cloudinaryThumb } from "../../utils/cloudinary";

export default function ProductDetailPage() {
  const { slug } = useParams();
  const { refreshCart } = useCart();

  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [images, setImages] = useState([]);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addedMessage, setAddedMessage] = useState("");

  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [activeImage, setActiveImage] = useState("");
  const [tab, setTab] = useState("description");
  const [quantity, setQuantity] = useState(1);

  const colors = useMemo(() => {
    const set = new Set(variants.map((v) => normalizeColorName(v.color)).filter(Boolean));
    return [...set];
  }, [variants]);

  const sizesForSelectedColor = useMemo(() => {
    if (!selectedColor) return [];
    return variants
      .filter((v) => normalizeColorName(v.color) === selectedColor && v.is_active !== false)
      .map((v) => v.size)
      .filter(Boolean);
  }, [variants, selectedColor]);

  const selectedVariant = useMemo(() => {
    return variants.find((v) => v.id === selectedVariantId) || null;
  }, [variants, selectedVariantId]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const productRes = await api.get(`/products/slug/${slug}`);
        const p = productRes.data?.data;
        if (!p) throw new Error("Product not found");

        const [variantsRes, imagesRes] = await Promise.all([
          api.get(`/product-variants/products/${p.id}/variants`),
          api.get(`/product-images/${p.id}`),
        ]);

        const vars = variantsRes.data?.data ?? [];
        const imgs = imagesRes.data?.data ?? [];

        setProduct(p);
        setVariants(vars);
        setImages(imgs);

        const firstColor = [...new Set(vars.map((v) => normalizeColorName(v.color)).filter(Boolean))][0] || "";
        setSelectedColor(firstColor);

        const firstSizeOfColor = vars
          .filter((v) => normalizeColorName(v.color) === firstColor)
          .map((v) => v.size)
          .filter(Boolean)[0] || "";
        setSelectedSize(firstSizeOfColor);

        const firstVar = vars.find(
          (v) => normalizeColorName(v.color) === firstColor && v.size === firstSizeOfColor && v.is_active !== false
        );
        setSelectedVariantId(firstVar?.id ?? null);

        setActiveImage(getImageForColor(imgs, firstColor) || "");

        if (p.category_id) {
          try {
            const relatedRes = await api.get("/products", {
              params: { category: p.category_id, limit: 5, page: 1 },
            });
            const raw = relatedRes.data?.data ?? [];
            const enriched = await Promise.all(
              raw
                .filter((rp) => rp.id !== p.id)
                .slice(0, 4)
                .map(async (rp) => {
                  try {
                    const [rv, ri] = await Promise.all([
                      api.get(`/product-variants/products/${rp.id}/variants`),
                      api.get(`/product-images/${rp.id}`),
                    ]);
                    const vars = rv.data?.data ?? [];
                    const imgs = ri.data?.data ?? [];
                    const dv = pickDisplayVariant(vars);
                    return {
                      ...rp,
                      variants: vars,
                      images: imgs,
                      colors: getUniqueColorsFromVariants(vars),
                      price: dv?.price ?? 0,
                      compare_price: dv?.compare_price ?? null,
                      defaultImage: imgs.find((i) => i.is_thumbnail)?.image_url || imgs[0]?.image_url || null,
                    };
                  } catch {
                    return null;
                  }
                })
            );
            setRelatedProducts(enriched.filter(Boolean));
          } catch {
            // không lỗi nếu fetch related fail
          }
        }
      } catch (err) {
        setError(err?.response?.data?.message || "Không thể tải sản phẩm.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [slug]);

  const pickVariant = useCallback((color, size) => {
    return variants.find(
      (v) => normalizeColorName(v.color) === color && v.size === size && v.is_active !== false
    ) || null;
  }, [variants]);

  const handleColorChange = (color) => {
    const firstSize = variants
      .filter((v) => normalizeColorName(v.color) === color && v.is_active !== false)
      .map((v) => v.size)
      .filter(Boolean)[0] || "";
    const v = pickVariant(color, firstSize);
    setSelectedColor(color);
    setSelectedSize(firstSize);
    setSelectedVariantId(v?.id ?? null);
    const img = getImageForColor(images, color);
    if (img) setActiveImage(img);
    setQuantity(1);
  };

  const handleSizeChange = (size) => {
    const v = pickVariant(selectedColor, size);
    setSelectedSize(size);
    setSelectedVariantId(v?.id ?? null);
    setQuantity(1);
  };

  const handleImageClick = (img) => {
    setActiveImage(img.image_url);
    if (!img.color) return;
    const normColor = normalizeColorName(img.color);
    if (!variants.some((v) => normalizeColorName(v.color) === normColor)) return;
    // Select color + first size for that color, but DON'T override active image
    setSelectedColor(normColor);
    const firstSize = variants
      .filter((v) => normalizeColorName(v.color) === normColor && v.is_active !== false)
      .map((v) => v.size)
      .filter(Boolean)[0] || "";
    setSelectedSize(firstSize);
    const v = pickVariant(normColor, firstSize);
    setSelectedVariantId(v?.id ?? null);
    setQuantity(1);
  };

  const handleAddToCart = async () => {
    if (!selectedVariantId) return;
    try {
      await api.post("/carts/items", {
        variant_id: selectedVariantId,
        quantity,
      });
      setAddedMessage("Đã thêm vào giỏ hàng");
      refreshCart();
      setTimeout(() => setAddedMessage(""), 2500);
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể thêm vào giỏ hàng.");
    }
  };

  const sortedSizes = [...new Set(sizesForSelectedColor)];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="text-sm text-neutral-500">{error || "Sản phẩm không tồn tại."}</p>
        <Link to="/" className="text-xs uppercase tracking-widest underline">Quay về trang chủ</Link>
      </div>
    );
  }

  return (
    <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <nav className="text-xs text-neutral-400 mb-6 tracking-wide">
        <Link to="/" className="hover:text-neutral-700">Trang chủ</Link>
        <span className="mx-2">/</span>
        <span className="text-neutral-700">{product.name}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-6 sm:gap-10 lg:gap-14">
        {/* IMAGES */}
        <div className="flex gap-4">
          {images.length > 0 && (
            <div className="hidden sm:flex flex-col gap-2 overflow-y-auto max-h-[calc(100dvh-10rem)] scrollbar-thin">
              {images.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => handleImageClick(img)}
                  className={`w-16 h-20 flex-shrink-0 rounded-md overflow-hidden border-2 transition-colors ${
                    activeImage === img.image_url
                      ? "border-neutral-900"
                      : "border-transparent hover:border-neutral-300"
                  }`}
                >
                  <img src={cloudinaryThumb(img.image_url)} alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
          <div className="flex-1 aspect-[3/4] bg-neutral-50 rounded-lg overflow-hidden flex items-center justify-center">
            {activeImage ? (
              <img
                src={activeImage}
                alt={product.name}
                className="w-full h-full object-contain p-2"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-300 text-sm">
                Không có ảnh
              </div>
            )}
          </div>
        </div>

        {images.length > 0 && (
          <div className="sm:hidden flex gap-2 overflow-x-auto pb-1 mt-3">
            {images.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => handleImageClick(img)}
                className={`w-16 h-20 flex-shrink-0 rounded-md overflow-hidden border-2 transition-colors ${
                  activeImage === img.image_url
                    ? "border-neutral-900"
                    : "border-transparent hover:border-neutral-300"
                }`}
              >
                <img src={cloudinaryThumb(img.image_url)} alt="" className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}

        {/* INFO */}
        <div className="flex flex-col gap-4 sm:gap-5">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-medium tracking-tight">
              {product.name}
            </h1>
            {product.category_name && (
              <p className="mt-1 text-xs uppercase tracking-widest text-neutral-400">
                {product.category_name}
              </p>
            )}
          </div>

          {/* PRICE */}
          <div className="flex items-baseline gap-3">
            {selectedVariant && (
              <>
                <span className="text-xl sm:text-2xl font-medium">
                  {formatVND(selectedVariant.price)}
                </span>
                {selectedVariant.compare_price > selectedVariant.price && (
                  <>
                    <span className="text-sm text-neutral-400 line-through">
                      {formatVND(selectedVariant.compare_price)}
                    </span>
                    <span className="text-xs text-red-500 font-medium">
                      {calcDiscountLabel(selectedVariant.compare_price, selectedVariant.price)}
                    </span>
                  </>
                )}
              </>
            )}
          </div>

          {/* COLOR */}
          {colors.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-widest text-neutral-500 mb-3">
                Màu sắc: <span className="text-neutral-900">{selectedColor}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    title={color}
                    onClick={() => handleColorChange(color)}
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 flex items-center justify-center transition-all ${
                      selectedColor === color
                        ? "border-neutral-900 scale-110"
                        : "border-neutral-200 hover:border-neutral-400"
                    }`}
                    style={getColorSwatchStyle(color)}
                  >
                    {selectedColor === color && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* SIZE */}
          {sortedSizes.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-widest text-neutral-500 mb-3">
                Kích thước: <span className="text-neutral-900">{selectedSize || "—"}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {sortedSizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => handleSizeChange(size)}
                    className={`min-w-[3rem] px-3 py-2 text-sm border rounded-md transition-colors ${
                      selectedSize === size
                        ? "bg-neutral-900 text-white border-neutral-900"
                        : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* CHÍNH SÁCH MUA HÀNG */}
          <div className="border border-neutral-100 rounded-lg bg-neutral-50 divide-y divide-neutral-100">
            <div className="flex items-center gap-3 px-4 py-2.5">
              <svg className="w-4 h-4 text-neutral-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
              <p className="text-xs text-neutral-600">Miễn phí vận chuyển cho đơn hàng từ 500.000₫</p>
            </div>
            <div className="flex items-center gap-3 px-4 py-2.5">
              <svg className="w-4 h-4 text-neutral-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
              <p className="text-xs text-neutral-600">Cam kết hàng chính hãng 100%</p>
            </div>
            <div className="flex items-center gap-3 px-4 py-2.5">
              <svg className="w-4 h-4 text-neutral-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
              </svg>
              <p className="text-xs text-neutral-600">Đổi trả trong 7 ngày</p>
            </div>
          </div>

          {/* QUANTITY + BUTTONS */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center border border-neutral-200 rounded-md self-start">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="px-3 py-2 text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                −
              </button>
              <span className="px-4 py-2 text-sm min-w-[2rem] text-center select-none">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="px-3 py-2 text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                +
              </button>
            </div>

            <div className="flex gap-2 flex-1">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!selectedVariant}
                className="flex-1 px-6 py-2.5 text-sm border border-neutral-900 text-neutral-900 rounded-md hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Thêm vào giỏ
              </button>
              <button
                type="button"
                disabled={!selectedVariant}
                className="flex-[2] px-6 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Mua ngay
              </button>
            </div>
          </div>

          {addedMessage && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-3">
              {addedMessage}
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">
              {error}
            </p>
          )}
        </div>
      </div>

      {/* TABS — full width dưới grid */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 mt-8 sm:mt-12">
        <div className="border-t border-neutral-100 pt-6 sm:pt-8">
          <div className="flex gap-6 sm:gap-8 border-b border-neutral-200">
            <button
              type="button"
              onClick={() => setTab("description")}
              className={`pb-3 text-xs sm:text-sm uppercase tracking-widest transition-colors ${
                tab === "description"
                  ? "text-neutral-900 border-b-2 border-neutral-900"
                  : "text-neutral-400 hover:text-neutral-600"
              }`}
            >
              Thông tin chi tiết
            </button>
            <button
              type="button"
              onClick={() => setTab("policy")}
              className={`pb-3 text-xs sm:text-sm uppercase tracking-widest transition-colors ${
                tab === "policy"
                  ? "text-neutral-900 border-b-2 border-neutral-900"
                  : "text-neutral-400 hover:text-neutral-600"
              }`}
            >
              Chính sách đổi trả
            </button>
          </div>

          {tab === "description" && product.description && (
            <div className="pt-6 sm:pt-8">
              <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-line max-w-[65ch]">
                {product.description}
              </p>
            </div>
          )}

          {tab === "policy" && (
            <div className="pt-6 sm:pt-8">
              <ul className="text-sm text-neutral-600 leading-relaxed space-y-2 max-w-[65ch]">
                <li>Đổi trả trong vòng 7 ngày kể từ ngày nhận hàng.</li>
                <li>Sản phẩm phải còn nguyên tem, mác, chưa qua sử dụng.</li>
                <li>Miễn phí đổi trả cho đơn hàng đầu tiên.</li>
                <li>Hoàn tiền trong vòng 5–7 ngày làm việc.</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* GỢI Ý SẢN PHẨM */}
      {relatedProducts.length > 0 && (
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 mt-10 sm:mt-14">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs sm:text-sm font-medium tracking-[0.2em] uppercase text-neutral-900">
              Gợi ý cho bạn
            </h2>
            <Link
              to={`/category/${product.category_id}`}
              className="text-[11px] uppercase tracking-widest text-neutral-400 hover:text-neutral-900 transition-colors"
            >
              Xem thêm
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
            {relatedProducts.map((rp) => (
              <Link
                key={rp.id}
                to={`/products/${rp.slug}`}
                className="group flex flex-col"
              >
                <div className="relative aspect-[3/4] bg-neutral-100 overflow-hidden rounded-sm">
                  {rp.defaultImage ? (
                    <img
                      src={rp.defaultImage}
                      alt={rp.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-neutral-200" />
                  )}
                </div>
                <div className="pt-3 space-y-1.5">
                  <p className="text-xs sm:text-sm font-light tracking-wide text-neutral-800 line-clamp-2">
                    {rp.name}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium">{formatVND(rp.price)}</span>
                    {rp.compare_price > rp.price && (
                      <span className="text-xs text-neutral-400 line-through">
                        {formatVND(rp.compare_price)}
                      </span>
                    )}
                  </div>
                  {rp.colors?.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {rp.colors.slice(0, 4).map((c) => (
                        <span
                          key={c}
                          className="w-3 h-3 rounded-full border border-neutral-300"
                          title={c}
                          style={getColorSwatchStyle(c)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
