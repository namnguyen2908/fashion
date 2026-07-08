import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { getColorSwatchStyle } from "../constants/colors";
import {
  getImageForColor,
  getUniqueColorsFromVariants,
} from "../utils/productImages";
import { useAuth } from "../context/AuthContext";
import { isAdminRole } from "../constants/roles";

function useVisiblePerRow() {
  const [visible, setVisible] = useState(5);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w >= 1280) setVisible(5);
      else if (w >= 1024) setVisible(4);
      else if (w >= 768) setVisible(3);
      else setVisible(2);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return visible;
}

function useCarouselSlideWidth(visible, deps = []) {
  const containerRef = useRef(null);
  const [slideWidth, setSlideWidth] = useState(0);
  const [gap, setGap] = useState(16);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const styles = getComputedStyle(el);
    const gapPx = parseFloat(styles.columnGap || styles.gap) || 16;
    const width = (el.offsetWidth - gapPx * (visible - 1)) / visible;
    setGap(gapPx);
    setSlideWidth(Math.max(0, width));
  }, [visible]);

  useEffect(() => {
    measure();
    const el = containerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, ...deps]);

  return { containerRef, slideWidth, gap };
}

const formatVND = (amount) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

const calcDiscountLabel = (comparePrice, price) => {
  const compare = Number(comparePrice);
  const current = Number(price);
  if (!compare || compare <= current) return null;
  return `-${Math.round((1 - current / compare) * 100)}%`;
};

const pickDisplayVariant = (variants) => {
  if (!variants?.length) return null;
  const onSale = variants.filter(
    (v) => v.compare_price != null && Number(v.compare_price) > Number(v.price)
  );
  if (onSale.length) {
    return onSale.reduce((a, b) => (Number(a.price) <= Number(b.price) ? a : b));
  }
  return variants.reduce((a, b) => (Number(a.price) <= Number(b.price) ? a : b));
};

const enrichProduct = async (product) => {
  const [variantsRes, imagesRes] = await Promise.all([
    api.get(`/product-variants/products/${product.id}/variants`),
    api.get(`/product-images/${product.id}`),
  ]);
  const variants = variantsRes.data?.data ?? [];
  const images = imagesRes.data?.data ?? [];
  const displayVariant = pickDisplayVariant(variants);
  const defaultImage =
    images.find((img) => img.is_thumbnail)?.image_url ||
    images[0]?.image_url ||
    null;

  return {
    ...product,
    variants,
    images,
    colors: getUniqueColorsFromVariants(variants),
    price: displayVariant?.price ?? 0,
    compare_price: displayVariant?.compare_price ?? null,
    defaultImage,
    isOnSale:
      displayVariant != null &&
      Number(displayVariant.compare_price) > Number(displayVariant.price),
  };
};

const buildCategoryTree = (flatCategories) => {
  const parents = flatCategories.filter((c) => c.parent_id == null);
  return parents.map((parent) => ({
    ...parent,
    children: flatCategories.filter((c) => c.parent_id === parent.id),
  }));
};

const getAccessoryCategoryIds = (categories) => {
  const root = categories.find(
    (c) => c.slug === "phu-kien" || c.name?.toLowerCase().trim() === "phụ kiện"
  );
  if (!root) return [];
  const children = categories.filter((c) => c.parent_id === root.id);
  return children.length > 0 ? children.map((c) => c.id) : [root.id];
};

const enrichAll = async (list) => {
  const results = await Promise.all(
    list.map(async (p) => {
      try {
        return await enrichProduct(p);
      } catch {
        return null;
      }
    })
  );
  return results.filter(Boolean);
};

const fetchProductsByCategories = async (categoryIds) => {
  if (!categoryIds.length) return [];
  const responses = await Promise.all(
    categoryIds.map((id) =>
      api.get("/products", { params: { category: id, limit: 24, page: 1 } })
    )
  );
  const seen = new Set();
  return responses
    .flatMap((r) => r.data?.data ?? [])
    .filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
};

function IconSearch({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

function IconUser({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  );
}

function IconBag({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 0 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  );
}

function IconChevron({ direction = "right", className = "w-4 h-4" }) {
  const path =
    direction === "left"
      ? "M15.75 19.5 8.25 12l7.5-7.5"
      : "M8.25 4.5 15.75 12l-7.5 7.5";
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

function ProductCard({ product }) {
  const [activeImage, setActiveImage] = useState(product.defaultImage);
  const [hoveredColor, setHoveredColor] = useState(null);
  const discount = calcDiscountLabel(product.compare_price, product.price);

  useEffect(() => {
    setActiveImage(product.defaultImage);
  }, [product.defaultImage]);

  return (
    <article className="group flex flex-col min-w-0">
      <Link
        to={`/products/${product.slug}`}
        className="relative block overflow-hidden bg-neutral-100 aspect-[3/4]"
      >
        {activeImage ? (
          <img
            src={activeImage}
            alt={product.name}
            className="w-full h-full object-cover transition-opacity duration-300"
          />
        ) : (
          <div className="w-full h-full bg-neutral-200" />
        )}
        {discount && (
          <span className="absolute top-3 left-3 bg-black text-white text-[10px] font-medium tracking-wider px-2 py-1">
            {discount}
          </span>
        )}
      </Link>

      <div className="pt-3 space-y-2">
        <Link
          to={`/products/${product.slug}`}
          className="block text-xs sm:text-sm font-light tracking-wide text-neutral-800 hover:text-neutral-500 transition-colors line-clamp-2"
        >
          {product.name}
        </Link>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium tracking-wide">{formatVND(product.price)}</span>
          {product.compare_price &&
            Number(product.compare_price) > Number(product.price) && (
              <span className="text-xs text-neutral-400 line-through">
                {formatVND(product.compare_price)}
              </span>
            )}
        </div>
        {product.colors.length > 0 && (
          <div className="flex items-center gap-1.5 pt-0.5">
            {product.colors.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                onMouseEnter={() => {
                  setHoveredColor(color);
                  const url = getImageForColor(product.images, product.variants, color);
                  if (url) setActiveImage(url);
                }}
                onMouseLeave={() => {
                  setHoveredColor(null);
                  setActiveImage(product.defaultImage);
                }}
                className={`w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
                  hoveredColor === color
                    ? "ring-1 ring-offset-1 ring-neutral-800 border-neutral-800 scale-110"
                    : "border-neutral-300 hover:border-neutral-500"
                }`}
                style={getColorSwatchStyle(color)}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

const PRODUCT_GRID_CLASS =
  "grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 md:gap-5 lg:grid-cols-4 lg:gap-6 xl:grid-cols-5";

function ProductCarousel({ title, products, loading }) {
  const [offset, setOffset] = useState(0);
  const visible = useVisiblePerRow();
  const maxOffset = Math.max(0, products.length - visible);
  const isCarousel = products.length > visible;
  const { containerRef, slideWidth, gap } = useCarouselSlideWidth(visible, [
    products.length,
    loading,
  ]);

  useEffect(() => {
    setOffset(0);
  }, [products.length, visible]);

  useEffect(() => {
    if (offset > maxOffset) setOffset(maxOffset);
  }, [offset, maxOffset]);

  if (!loading && products.length === 0) return null;

  const skeletonCount = visible;

  return (
    <section className="py-10 md:py-14 lg:py-16 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto w-full">
      <div className="flex items-center justify-between mb-6 md:mb-8 gap-4">
        <h2 className="text-xs sm:text-sm font-medium tracking-[0.2em] sm:tracking-[0.25em] uppercase text-neutral-900">
          {title}
        </h2>
        {isCarousel && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setOffset((o) => Math.max(0, o - 1))}
              disabled={offset === 0}
              aria-label="Trước"
              className="p-2 text-neutral-400 hover:text-neutral-900 disabled:opacity-30 transition-colors"
            >
              <IconChevron direction="left" />
            </button>
            <button
              type="button"
              onClick={() => setOffset((o) => Math.min(maxOffset, o + 1))}
              disabled={offset >= maxOffset}
              aria-label="Sau"
              className="p-2 text-neutral-400 hover:text-neutral-900 disabled:opacity-30 transition-colors"
            >
              <IconChevron direction="right" />
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className={PRODUCT_GRID_CLASS}>
          {[...Array(skeletonCount)].map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-neutral-100 animate-pulse" />
          ))}
        </div>
      ) : !isCarousel ? (
        <div className={PRODUCT_GRID_CLASS}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div ref={containerRef} className="overflow-hidden w-full">
          <div
            className="flex gap-4 sm:gap-5 lg:gap-6 transition-transform duration-500 ease-out will-change-transform"
            style={{
              transform: `translateX(-${offset * (slideWidth + gap)}px)`,
            }}
          >
            {products.map((product) => (
              <div
                key={product.id}
                className="flex-shrink-0 w-[calc((100%-1rem)/2)] md:w-[calc((100%-2.5rem)/3)] lg:w-[calc((100%-4.5rem)/4)] xl:w-[calc((100%-6rem)/5)]"
                style={slideWidth > 0 ? { width: slideWidth } : undefined}
              >
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function HeroCarousel({ slides }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (slides.length === 0) {
    return (
      <section className="relative w-full h-[70vh] sm:h-[80vh] lg:h-screen min-h-[400px] sm:min-h-[480px] lg:min-h-[520px] bg-neutral-900" />
    );
  }

  return (
    <section className="relative w-full h-[70vh] sm:h-[80vh] lg:h-screen min-h-[400px] sm:min-h-[480px] lg:min-h-[520px] overflow-hidden bg-neutral-900">
      {slides.map((src, index) => (
        <div
          key={src}
          className={`absolute inset-0 transition-opacity duration-[1200ms] ease-in-out ${
            index === active ? "opacity-100 z-10" : "opacity-0 z-0"
          }`}
        >
          <img src={src} alt="" className="w-full h-full object-cover" />
        </div>
      ))}
      {slides.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {slides.map((src, index) => (
            <button
              key={src}
              type="button"
              aria-label={`Slide ${index + 1}`}
              onClick={() => setActive(index)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === active ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function IconMenu({ className = "w-6 h-6" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function IconClose({ className = "w-6 h-6" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function SiteHeader({ categoryTree }) {
  const { user } = useAuth();
  const [megaOpen, setMegaOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false);
  const megaTimeout = useRef(null);

  const openMega = () => {
    clearTimeout(megaTimeout.current);
    setMegaOpen(true);
  };

  const closeMega = () => {
    megaTimeout.current = setTimeout(() => setMegaOpen(false), 120);
  };

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const headerTone = "bg-white text-black shadow-sm border-b border-neutral-100";
  const inputTone =
    "bg-neutral-50 border-neutral-200 text-black placeholder:text-neutral-400";
  const iconTone = "text-black hover:text-neutral-500";

  const navLinkClass =
    "tracking-widest text-xs sm:text-sm font-medium hover:text-neutral-500 transition-colors uppercase";

  return (
    <header className={`relative w-full transition-all duration-300 ${headerTone}`}>
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 sm:py-4 w-full max-w-[1600px] mx-auto">
        <div className="flex items-center gap-3 lg:flex-shrink-0">
          <button
            type="button"
            className={`lg:hidden p-1 -ml-1 transition-colors ${iconTone}`}
            aria-label={mobileOpen ? "Đóng menu" : "Mở menu"}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <IconClose /> : <IconMenu />}
          </button>

          <Link
            to="/"
            className="inline-block text-xl sm:text-2xl font-bold tracking-tight select-none"
            style={{
              fontFamily: "'Outfit', 'Segoe UI', system-ui, sans-serif",
              letterSpacing: "-0.03em",
            }}
            onClick={() => setMobileOpen(false)}
          >
            Maison
          </Link>
        </div>

        <nav className="hidden lg:flex flex-1 items-center justify-center px-8 xl:px-12">
          <ul className="flex items-center space-x-6 xl:space-x-8">
            <li>
              <Link to="/new-arrivals" className={navLinkClass}>
                Hàng mới
              </Link>
            </li>

            <li onMouseEnter={openMega} onMouseLeave={closeMega}>
              <button type="button" className={navLinkClass}>
                Sản phẩm
              </button>
            </li>

            <li>
              <Link to="/sales" className={navLinkClass}>
                Sales
              </Link>
            </li>
          </ul>
        </nav>

        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <label className="relative hidden lg:block">
            <span className="sr-only">Tìm kiếm</span>
            <input
              type="search"
              placeholder="Tìm kiếm..."
              className={`w-36 xl:w-52 text-sm rounded-full border px-4 py-2 pl-10 outline-none transition-colors duration-300 focus:border-neutral-400 ${inputTone}`}
            />
            <span
              className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${iconTone}`}
            >
              <IconSearch className="w-4 h-4" />
            </span>
          </label>

          {isAdminRole(user?.role) ? (
            <Link
              to="/admin/products"
              aria-label="Quản trị"
              className={`hidden sm:inline-flex items-center px-3 py-1.5 text-[10px] sm:text-xs uppercase tracking-widest border transition-colors ${iconTone} border-neutral-300 hover:border-neutral-900`}
            >
              Quản trị
            </Link>
          ) : null}

          <Link
            to={isAdminRole(user?.role) ? "/admin/products" : "/login"}
            aria-label="Tài khoản"
            className={`p-1 transition-colors ${iconTone}`}
          >
            <IconUser />
          </Link>

          <Link
            to="/cart"
            aria-label="Giỏ hàng"
            className={`p-1 transition-colors ${iconTone}`}
          >
            <IconBag />
          </Link>
        </div>
      </div>

      {megaOpen && categoryTree.length > 0 && (
        <div
          className="hidden lg:block absolute inset-x-0 top-full z-40"
          onMouseEnter={openMega}
          onMouseLeave={closeMega}
        >
          <div className="w-full bg-white text-black shadow-xl py-6 xl:py-8 px-6 sm:px-8 lg:px-12 border-t border-neutral-100">
            <div className="max-w-[1400px] mx-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 xl:gap-8">
              {categoryTree.map((col) => (
                <div key={col.id}>
                  <p className="text-xs font-semibold tracking-[0.2em] uppercase text-neutral-900 mb-3 xl:mb-4">
                    {col.name}
                  </p>

                  <ul className="space-y-2">
                    {col.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          to={`/categories/${child.slug}`}
                          className="text-sm font-light text-neutral-600 hover:text-neutral-900 hover:underline underline-offset-4 transition-colors"
                        >
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 top-[calc(2.25rem+3.25rem)] sm:top-[calc(2.5rem+4rem)] z-40 bg-white text-black overflow-y-auto">
          <nav className="px-4 sm:px-6 py-6 space-y-1 border-t border-neutral-100">
            <Link
              to="/new-arrivals"
              className="block py-3 text-sm tracking-widest uppercase border-b border-neutral-100"
              onClick={() => setMobileOpen(false)}
            >
              Hàng mới
            </Link>

            <button
              type="button"
              className="w-full flex items-center justify-between py-3 text-sm tracking-widest uppercase border-b border-neutral-100"
              onClick={() => setMobileProductsOpen((v) => !v)}
            >
              Sản phẩm
              <IconChevron
                direction="right"
                className={`w-4 h-4 transition-transform duration-200 ${
                  mobileProductsOpen ? "rotate-[-90deg]" : "rotate-90"
                }`}
              />
            </button>

            {mobileProductsOpen && (
              <div className="pb-4 space-y-6">
                {categoryTree.map((col) => (
                  <div key={col.id}>
                    <p className="text-xs font-semibold tracking-[0.15em] uppercase text-neutral-900 mb-2">
                      {col.name}
                    </p>

                    <ul className="space-y-2 pl-2">
                      {col.children.map((child) => (
                        <li key={child.id}>
                          <Link
                            to={`/categories/${child.slug}`}
                            className="text-sm text-neutral-600"
                            onClick={() => setMobileOpen(false)}
                          >
                            {child.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            <Link
              to="/sales"
              className="block py-3 text-sm tracking-widest uppercase border-b border-neutral-100"
              onClick={() => setMobileOpen(false)}
            >
              Sales
            </Link>

            <label className="relative block pt-4">
              <span className="sr-only">Tìm kiếm</span>
              <input
                type="search"
                placeholder="Tìm kiếm..."
                className="w-full text-sm rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2.5 pl-10 outline-none focus:border-neutral-400"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                <IconSearch className="w-4 h-4" />
              </span>
            </label>
          </nav>
        </div>
      )}
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-neutral-100 bg-white px-4 sm:px-6 lg:px-8 py-10 sm:py-12 lg:py-14">
      <div className="max-w-4xl mx-auto text-center space-y-4 sm:space-y-6">
        <p
          className="text-base sm:text-lg font-bold tracking-tight text-neutral-900"
          style={{ fontFamily: "'Outfit', 'Segoe UI', system-ui, sans-serif" }}
        >
          Maison
        </p>
        <div className="text-xs text-neutral-500 font-light leading-relaxed tracking-wide space-y-1">
          <p>123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh</p>
          <p>Hotline: 1900 1234 · Giờ mở cửa: 10:00 – 22:00</p>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-[0.15em] text-neutral-500">
          <Link to="/policy/shipping" className="hover:text-neutral-900 transition-colors">
            Vận chuyển
          </Link>
          <Link to="/policy/returns" className="hover:text-neutral-900 transition-colors">
            Đổi trả
          </Link>
          <Link to="/policy/privacy" className="hover:text-neutral-900 transition-colors">
            Bảo mật
          </Link>
        </nav>
        <p className="text-[10px] text-neutral-400 tracking-widest uppercase pt-2">
          © {new Date().getFullYear()} Maison. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default function HomePage() {
  const [categories, setCategories] = useState([]);
  const [newProducts, setNewProducts] = useState([]);
  const [saleProducts, setSaleProducts] = useState([]);
  const [accessoryProducts, setAccessoryProducts] = useState([]);
  const [heroSlides, setHeroSlides] = useState([]);
  const [loadingNew, setLoadingNew] = useState(true);
  const [loadingSale, setLoadingSale] = useState(true);
  const [loadingAccessory, setLoadingAccessory] = useState(true);

  const categoryTree = buildCategoryTree(categories);

  useEffect(() => {
    api
      .get("/banners")
      .then((res) => {
        const banners = res.data?.data ?? [];
  
        const bannerUrls = banners
          .map((banner) => banner.image_url)
          .filter(Boolean);
  
        setHeroSlides(bannerUrls);
      })
      .catch(() => {
        setHeroSlides([]);
      });
  }, []);

  useEffect(() => {
    api
      .get("/categories")
      .then((res) => setCategories(res.data ?? []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setLoadingNew(true);
    setLoadingSale(true);
    api
      .get("/products", { params: { limit: 24, page: 1 } })
      .then((res) => enrichAll(res.data?.data ?? []))
      .then((enriched) => {
        setNewProducts(enriched);
        setSaleProducts(enriched.filter((p) => p.isOnSale));
      })
      .catch(() => {
        setNewProducts([]);
        setSaleProducts([]);
      })
      .finally(() => {
        setLoadingNew(false);
        setLoadingSale(false);
      });
  }, []);

  useEffect(() => {
    if (!categories.length) return;
    setLoadingAccessory(true);
    const accessoryIds = getAccessoryCategoryIds(categories);
    fetchProductsByCategories(accessoryIds)
      .then(enrichAll)
      .then(setAccessoryProducts)
      .catch(() => setAccessoryProducts([]))
      .finally(() => setLoadingAccessory(false));
  }, [categories]);

  return (
    <div className="min-h-screen bg-white text-neutral-900 antialiased">
      <div className="sticky top-0 z-50">
        <div className="w-full bg-black text-white text-[10px] sm:text-xs uppercase py-1.5 sm:py-2 tracking-[0.15em] sm:tracking-widest text-center px-3 leading-relaxed">
          Miễn phí vận chuyển cho đơn hàng từ 2 triệu đồng
        </div>
        <SiteHeader categoryTree={categoryTree} />
      </div>

      <HeroCarousel slides={heroSlides} />

      <ProductCarousel title="Hàng mới về" products={newProducts} loading={loadingNew} />
      <ProductCarousel title="Chương trình Sales" products={saleProducts} loading={loadingSale} />
      <ProductCarousel title="Phụ kiện" products={accessoryProducts} loading={loadingAccessory} />

      <SiteFooter />
    </div>
  );
}
