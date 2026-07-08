import { NavLink, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const NAV_ITEMS = [
  { to: "/admin/categories", label: "Danh mục", end: false },
  { to: "/admin/products", label: "Sản phẩm", end: true },
  { to: "/admin/products/create", label: "Tạo sản phẩm", end: false },
];

export default function AdminSidebar() {
  const { logout } = useAuth();

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-60 lg:w-64 flex-col border-r border-neutral-200 bg-white z-40">
      <div className="px-6 py-6 border-b border-neutral-100">
        <Link
          to="/"
          className="text-xs uppercase tracking-[0.2em] text-neutral-400 hover:text-neutral-600"
        >
          ← Về cửa hàng
        </Link>
        <p
          className="mt-3 text-lg font-semibold tracking-tight"
          style={{ fontFamily: "'Outfit', 'Segoe UI', system-ui, sans-serif" }}
        >
          Maison Admin
        </p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `block px-4 py-2.5 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-neutral-100">
        <button
          type="button"
          onClick={logout}
          className="w-full px-4 py-2.5 rounded-md text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors text-left"
        >
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
