import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/admin/categories", label: "Danh mục", end: false },
  { to: "/admin/products", label: "Sản phẩm", end: true },
  { to: "/admin/products/create", label: "Tạo sản phẩm", end: false },
];

export default function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex">
      <aside className="hidden md:flex w-60 lg:w-64 flex-col border-r border-neutral-200 bg-white shrink-0">
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
        <nav className="flex-1 px-3 py-4 space-y-1">
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
            onClick={handleLogout}
            className="w-full px-4 py-2.5 rounded-md text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors text-left"
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-30 bg-white border-b border-neutral-200 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold tracking-tight">Maison Admin</span>
            <Link to="/" className="text-xs text-neutral-500 uppercase tracking-wider">
              Cửa hàng
            </Link>
          </div>
          <nav className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `shrink-0 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-600"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
