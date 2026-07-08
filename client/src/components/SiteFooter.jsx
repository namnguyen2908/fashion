import { Link } from "react-router-dom";

export default function SiteFooter() {
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
