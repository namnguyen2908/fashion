import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { formatVND } from "../../utils/format";
import { cloudinaryThumb } from "../../utils/cloudinary";
import api from "../../services/api";

const colorToHex = (color) => {
  const map = {
    "Đen": "#1a1a1a",
    "Trắng": "#f5f5f5",
    "Be/Kem": "#f5e6d3",
    "Nâu": "#8B6914",
    "Xám": "#888",
    "Xanh": "#3b82f6",
    "Đỏ": "#dc2626",
    "Hồng": "#ec4899",
    "Vàng": "#eab308",
    "Be": "#f5e6d3",
    "Kem": "#fdf5e6",
  };
  return map[color] || "#ccc";
};

function QuantityStepper({ value, onIncrease, onDecrease, disabled }) {
  return (
    <div className="inline-flex items-center border border-neutral-200 rounded-full overflow-hidden">
      <button
        type="button"
        onClick={onDecrease}
        disabled={disabled || value <= 1}
        className="w-7 h-7 flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
      >
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
        </svg>
      </button>
      <span className="w-7 text-center text-xs font-medium select-none tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={onIncrease}
        disabled={disabled}
        className="w-7 h-7 flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
      >
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
        </svg>
      </button>
    </div>
  );
}

export default function CartPage() {
  const { refreshCart } = useCart();
  const { isAuthenticated } = useAuth();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(new Set());
  const [syncingQty, setSyncingQty] = useState(new Set());

  const fetchCart = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/carts");
      if (data.success) {
        setItems(data.data.items || []);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);

  const handleQuantityChange = (cartItemId, newQty) => {
    if (newQty < 1) return;
    setSyncingQty((prev) => new Set([...prev, cartItemId]));
    setItems((prev) =>
      prev.map((item) =>
        item.cart_item_id === cartItemId ? { ...item, quantity: newQty } : item
      )
    );
    api
      .put(`/carts/items/${cartItemId}`, { quantity: newQty })
      .then(refreshCart)
      .catch(() => fetchCart())
      .finally(() => {
        setSyncingQty((prev) => {
          const next = new Set(prev);
          next.delete(cartItemId);
          return next;
        });
      });
  };

  const handleRemove = (cartItemId) => {
    setRemoving((prev) => new Set([...prev, cartItemId]));
    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.cart_item_id !== cartItemId));
      setRemoving((prev) => {
        const next = new Set(prev);
        next.delete(cartItemId);
        return next;
      });
      api.delete(`/carts/items/${cartItemId}`).then(refreshCart).catch(() => fetchCart());
    }, 300);
  };

  if (!isAuthenticated) {
    return (
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <div className="max-w-sm mx-auto">
          <div className="w-16 h-16 mx-auto rounded-full bg-neutral-100 flex items-center justify-center mb-6">
            <svg className="w-7 h-7 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 0 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </div>
          <h1 className="text-lg font-medium mb-2">Đăng nhập để xem giỏ hàng</h1>
          <p className="text-sm text-neutral-400 mb-6">
            Vui lòng đăng nhập để xem và quản lý giỏ hàng của bạn.
          </p>
          <Link
            to="/login"
            className="inline-block px-8 py-3 text-sm font-medium bg-black text-white rounded-full hover:bg-neutral-800 transition-all"
          >
            Đăng nhập
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
        <div className="w-6 h-6 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin mx-auto" />
      </main>
    );
  }

  if (!items.length) {
    return (
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <div className="max-w-sm mx-auto">
          <div className="w-16 h-16 mx-auto rounded-full bg-neutral-100 flex items-center justify-center mb-6">
            <svg className="w-7 h-7 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 0 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </div>
          <h1 className="text-lg font-medium mb-2">Giỏ hàng trống</h1>
          <p className="text-sm text-neutral-400 mb-6">
            Có vẻ như bạn chưa thêm sản phẩm nào. Hãy khám phá bộ sưu tập của chúng tôi.
          </p>
          <Link
            to="/"
            className="inline-block px-8 py-3 text-sm font-medium bg-black text-white rounded-full hover:bg-neutral-800 transition-all"
          >
            Khám phá sản phẩm
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <nav className="text-xs text-neutral-400 mb-8 tracking-wide">
        <Link to="/" className="hover:text-neutral-700 transition-colors">Trang chủ</Link>
        <span className="mx-2">/</span>
        <span className="text-neutral-700 font-medium">Giỏ hàng</span>
      </nav>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl sm:text-2xl font-medium tracking-tight">
          Giỏ hàng
          <span className="text-sm text-neutral-400 font-normal ml-2">
            ({totalItems} sản phẩm)
          </span>
        </h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-10 lg:gap-16">
        <div className="lg:col-span-2 space-y-0 divide-y divide-neutral-100">
          {items.map((item) => {
            const isRemoving = removing.has(item.cart_item_id);
            const isSyncing = syncingQty.has(item.cart_item_id);
            return (
              <div
                key={item.cart_item_id}
                className={`grid grid-cols-5 gap-4 sm:gap-6 py-6 transition-all duration-300 ${
                  isRemoving ? "opacity-0 -translate-x-6 pointer-events-none" : "opacity-100"
                }`}
              >
                <Link
                  to={`/products/${item.product_slug}`}
                  className="col-span-2 aspect-[3/4] bg-neutral-50 rounded-lg overflow-hidden group"
                >
                  {item.images ? (
                    <img
                      src={cloudinaryThumb(item.images, { width: 400 })}
                      alt={item.product_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-200">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    </div>
                  )}
                </Link>

                <div className="col-span-3 flex flex-col">
                  <Link
                    to={`/products/${item.product_slug}`}
                    className="text-sm sm:text-base font-medium text-neutral-900 hover:text-neutral-600 transition-colors leading-snug"
                  >
                    {item.product_name}
                  </Link>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-neutral-500">
                    {item.color && (
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-neutral-200 shrink-0"
                          style={{ backgroundColor: colorToHex(item.color) }}
                        />
                        {item.color}
                      </span>
                    )}
                    {item.size && <span>Size: {item.size}</span>}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-neutral-100">
                    <QuantityStepper
                      value={item.quantity}
                      disabled={isSyncing}
                      onDecrease={() => handleQuantityChange(item.cart_item_id, item.quantity - 1)}
                      onIncrease={() => handleQuantityChange(item.cart_item_id, item.quantity + 1)}
                    />
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatVND(Number(item.price) * item.quantity)}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleRemove(item.cart_item_id)}
                        className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-red-500 hover:text-white hover:bg-red-500 rounded-md transition-all active:scale-95"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                        Xoá
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-neutral-50 rounded-xl p-6 sm:p-8 sticky top-28">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] mb-6 text-neutral-700">
              Đơn hàng
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-neutral-600">
                <span>Tạm tính</span>
                <span className="font-medium text-neutral-900">{formatVND(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Phí vận chuyển</span>
                <span className="text-neutral-400">—</span>
              </div>
            </div>

            <div className="border-t border-neutral-200 mt-5 pt-5">
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-medium text-neutral-700">Tổng cộng</span>
                <span className="text-lg font-semibold">{formatVND(totalAmount)}</span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-1.5 leading-relaxed">
                Phí vận chuyển được tính khi thanh toán.
              </p>
            </div>

            <button
              type="button"
              onClick={() => alert("Tính năng thanh toán đang được phát triển.")}
              className="w-full mt-6 px-6 py-3 text-sm font-medium bg-black text-white rounded-lg hover:bg-neutral-800 transition-all active:scale-[0.98]"
            >
              Thanh toán
            </button>

            <Link
              to="/"
              className="block text-center mt-3.5 text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
            >
              Tiếp tục mua sắm →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
