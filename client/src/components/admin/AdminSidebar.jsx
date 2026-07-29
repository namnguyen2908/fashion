import { useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const MODULES = [
  {
    label: "Sản phẩm",
    children: [
      { to: "/admin/products", label: "Danh sách", end: true },
      { to: "/admin/products/create", label: "Tạo mới", end: false },
      { to: "/admin/categories", label: "Danh mục", end: false },
    ],
  },
  {
    label: "Khách hàng",
    children: [
      { to: "/admin/customers", label: "Danh sách khách hàng", end: false },
    ],
  },
  {
    label: "Kho hàng",
    children: [
      { to: "/admin/warehouse/stocks", label: "Tồn kho", end: false },
      { to: "/admin/warehouse/receipts", label: "Phiếu nhập", end: false },
      { to: "/admin/warehouse/suppliers", label: "Nhà cung cấp", end: false },
    ],
  },
  {
    label: "Khuyến mãi",
    children: [
      { to: "/admin/discounts", label: "Quy tắc giảm giá", end: false },
      { to: "/admin/sales", label: "Chương trình sale", end: false },
    ],
  },
  {
    label: "Quản trị",
    children: [
      { to: "/admin/roles", label: "Vai trò & Phân quyền", end: false },
      { to: "/admin/users", label: "Người dùng", end: false },
    ],
  },
];

function IconChevron({ expanded }) {
  return (
    <svg
      className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function ModuleGroup({ module, onItemClick }) {
  const location = useLocation();
  const isActive = module.children.some((item) => {
    if (item.end) return location.pathname === item.to;
    return location.pathname.startsWith(item.to);
  });

  const [expanded, setExpanded] = useState(isActive);
  const open = expanded || isActive;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-md text-sm transition-colors ${
          isActive
            ? "bg-neutral-900 text-white"
            : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
        }`}
      >
        <span className="text-xs uppercase tracking-wider font-medium">{module.label}</span>
        <IconChevron expanded={open} />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          open ? "mt-1 max-h-96" : "max-h-0"
        }`}
      >
        <div className="ml-3 space-y-0.5 border-l border-neutral-200 pl-3">
          {module.children.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onItemClick}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-neutral-800 text-white font-medium"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

function SidebarNav({ onItemClick }) {
  const { logout } = useAuth();

  return (
    <>
      <div className="px-6 py-6 border-b border-neutral-100">
        <Link
          to="/"
          className="text-xs uppercase tracking-[0.2em] text-neutral-400 hover:text-neutral-600"
          onClick={onItemClick}
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
      <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
        {MODULES.map((mod) => (
          <ModuleGroup key={mod.label} module={mod} onItemClick={onItemClick} />
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
    </>
  );
}

export default function AdminSidebar() {
  const [open, setOpen] = useState(false);

  const closeDrawer = () => setOpen(false);

  return (
    <>
      {/* Hamburger — mobile / tablet */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-50 flex md:hidden items-center justify-center w-10 h-10 bg-white border border-neutral-200 rounded-lg shadow-sm hover:bg-neutral-50 transition-colors"
        aria-label="Mở menu"
      >
        <IconMenu />
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-60 lg:w-64 flex-col border-r border-neutral-200 bg-white z-40">
        <SidebarNav />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 md:hidden"
          onClick={closeDrawer}
          role="presentation"
        >
          <aside
            className="fixed left-0 top-0 h-full w-72 bg-white border-r border-neutral-200 flex flex-col shadow-2xl animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeDrawer}
              className="absolute top-4 right-4 p-1 text-neutral-400 hover:text-neutral-900"
              aria-label="Đóng menu"
            >
              <IconClose />
            </button>
            <SidebarNav onItemClick={closeDrawer} />
          </aside>
        </div>
      )}
    </>
  );
}
