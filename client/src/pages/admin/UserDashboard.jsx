import { useState, useEffect, useCallback } from "react";
import api from "../../services/api";

// ── Icons ──────────────────────────────────────────────────────────────────

function IconSpinner({ className = "w-4 h-4" }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function IconSearch({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────



export default function UserDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage] = useState(15);

  const [changingRole, setChangingRole] = useState({});
  const [changeError, setChangeError] = useState("");

  const fetchUsers = useCallback(async () => {
    setError("");
    try {
      const params = { page, limit: perPage };
      if (search.trim()) params.search = search.trim();
      if (roleFilter) params.role = roleFilter;

      const { data } = await api.get("/auth/users", { params });
      const list = data?.users ?? [];
      setUsers(list);
      setTotal(data?.total ?? 0);
      if (data?.totalPages) setTotalPages(data.totalPages);
    } catch (err) {
      if (err?.response?.status === 404) {
        setUsers([]);
        return;
      }
      setError(err?.response?.data?.message || "Không thể tải danh sách người dùng.");
      setUsers([]);
    }
  }, [page, perPage, search, roleFilter]);

  const fetchRoles = useCallback(async () => {
    try {
      const { data } = await api.get("/roles");
      setRoles(Array.isArray(data) ? data : []);
    } catch {
      // roles data is optional for initial load
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchUsers(), fetchRoles()]).finally(() => setLoading(false));
  }, [fetchUsers, fetchRoles]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const switchTab = (t) => {
    setTab(t);
    setPage(1);
    setSearch("");
    setSearchInput("");
  };

  const handleRoleChange = async (userId, roleSlug) => {
    setChangingRole((prev) => ({ ...prev, [userId]: true }));
    setChangeError("");
    try {
      await api.put(`/roles/users/${userId}/role`, { role_slug: roleSlug });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: roleSlug } : u))
      );
    } catch (err) {
      setChangeError(err?.response?.data?.message || "Không thể thay đổi vai trò.");
    } finally {
      setChangingRole((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const roleMap = {};
  roles.forEach((r) => { roleMap[r.slug] = r; });

  return (
    <div className="text-neutral-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-neutral-900">
                Quản lý người dùng
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                {total > 0 ? `${total} người dùng` : "Tất cả người dùng trong hệ thống"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={roleFilter}
                onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                className="border border-neutral-200 rounded-md px-3 py-2.5 text-sm text-neutral-900 bg-white outline-none focus:border-neutral-400 transition-colors"
              >
                <option value="">Tất cả</option>
                {roles.map((r) => (
                  <option key={r.slug} value={r.slug}>{r.name}</option>
                ))}
              </select>
              <form onSubmit={handleSearch} className="relative w-full sm:w-56">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Tìm kiếm..."
                  className="w-full border border-neutral-200 rounded-md pl-10 pr-4 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 transition-colors"
                />
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
              </form>
            </div>
          </div>
        </header>

        {error && (
          <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">
            {error}
          </p>
        )}

        {changeError && (
          <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">
            {changeError}
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-neutral-400 gap-2">
            <IconSpinner className="w-5 h-5" />
            <span className="text-sm">Đang tải danh sách...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-neutral-200 rounded-lg bg-white">
            <p className="text-sm text-neutral-500">
              {search.trim() ? `Không tìm thấy "${search}".` : "Chưa có người dùng nào."}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/80">
                      <th className="text-left px-4 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wider">Tên</th>
                      <th className="text-left px-4 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wider hidden sm:table-cell">Email</th>
                      <th className="text-left px-4 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wider hidden md:table-cell">SĐT</th>
                      <th className="text-left px-4 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wider">Vai trò</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="px-4 py-3.5">
                          <span className="font-medium text-neutral-900">{user.name}</span>
                        </td>
                        <td className="px-4 py-3.5 text-neutral-500 hidden sm:table-cell">{user.email}</td>
                        <td className="px-4 py-3.5 text-neutral-500 hidden md:table-cell">{user.phone || "—"}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <select
                              value={user.role || "customer"}
                              onChange={(e) => handleRoleChange(user.id, e.target.value)}
                              disabled={changingRole[user.id]}
                              className="border border-neutral-200 rounded-md px-3 py-1.5 text-sm text-neutral-900 bg-white outline-none focus:border-neutral-400 transition-colors disabled:opacity-60"
                            >
                              {roles.map((role) => (
                                <option key={role.id} value={role.slug}>
                                  {role.name}
                                </option>
                              ))}
                            </select>
                            {changingRole[user.id] && <IconSpinner className="w-4 h-4 text-neutral-400" />}
                            {!changingRole[user.id] && roleMap[user.role] && (
                              <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                user.role === "admin"
                                  ? "bg-neutral-900 text-white"
                                  : user.role === "staff"
                                  ? "bg-blue-50 text-blue-700"
                                  : user.role === "sale_admin"
                                  ? "bg-green-50 text-green-700"
                                  : "bg-neutral-100 text-neutral-600"
                              }`}>
                                {roleMap[user.role]?.name || user.role}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  Trước
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      p === page
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-600 hover:text-neutral-900"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  Sau
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
