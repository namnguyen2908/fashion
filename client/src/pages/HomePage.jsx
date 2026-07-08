import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { getColorSwatchStyle } from "../constants/colors";
import { getImageForColor, getUniqueColorsFromVariants } from "../utils/productImages";
import { formatVND, calcDiscountLabel, pickDisplayVariant } from "../utils/format";
import { IconChevron } from "../components/Icons";

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
            loading="lazy"
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
                  const url = getImageForColor(product.images, color);
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
          <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
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

export default function HomePage() {
  const [categories, setCategories] = useState([]);
  const [newProducts, setNewProducts] = useState([]);
  const [saleProducts, setSaleProducts] = useState([]);
  const [accessoryProducts, setAccessoryProducts] = useState([]);
  const [heroSlides, setHeroSlides] = useState([]);
  const [loadingNew, setLoadingNew] = useState(true);
  const [loadingSale, setLoadingSale] = useState(true);
  const [loadingAccessory, setLoadingAccessory] = useState(true);

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
    <>
      <HeroCarousel slides={heroSlides} />
      <ProductCarousel title="Hàng mới về" products={newProducts} loading={loadingNew} />
      <ProductCarousel title="Chương trình Sales" products={saleProducts} loading={loadingSale} />
      <ProductCarousel title="Phụ kiện" products={accessoryProducts} loading={loadingAccessory} />
    </>
  );
}
