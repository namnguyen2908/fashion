import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { isAdminRole } from "../constants/roles";
import { IconSearch, IconUser, IconBag, IconChevron, IconClose, IconMenu } from "./Icons";

export default function SiteHeader({ categoryTree }) {
  const { user } = useAuth();
  const { totalItems } = useCart();
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
            className={`relative p-1 transition-colors ${iconTone}`}
          >
            <IconBag />
            {totalItems > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[9px] font-bold bg-neutral-900 text-white rounded-full flex items-center justify-center">
                {totalItems > 9 ? "9+" : totalItems}
              </span>
            )}
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
