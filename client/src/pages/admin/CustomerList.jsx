import { useState, useEffect, useCallback, useRef } from "react";
import api from "../../services/api";
import { IconSpinner, IconSearch } from "../../components/admin/Icons";

export default function CustomerList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debounceRef = useRef(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 15;

  const fetchCustomers = useCallback(async () => {
    setError("");
    try {
      const params = { page, limit: perPage };
      if (search.trim()) params.search = search.trim();

      const { data } = await api.get("/auth/customers", { params });
      const list = data?.users ?? [];
      setUsers(list);
      setTotal(data?.total ?? 0);
      setTotalPages(data?.totalPages ?? 1);
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể tải danh sách khách hàng.");
      setUsers([]);
    }
  }, [page, search]);

  useEffect(() => {
    setLoading(true);
    fetchCustomers().finally(() => setLoading(false));
  }, [fetchCustomers]);

  const formatDate = (value) => {
    if (!value) return "—";
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  };

  return (
    <div className="text-neutral-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-neutral-900">
              Khách hàng
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {total > 0 ? `${total} khách hàng` : "Danh sách khách hàng"}
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                clearTimeout(debounceRef.current);
                    debounceRef.current = setTimeout(() => {
                      setSearch(e.target.value);
                      setPage(1);
                    }, 500);
              }}
              placeholder="Tìm kiếm khách hàng..."
              className="w-full border border-neutral-200 rounded-md pl-10 pr-4 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 transition-colors"
            />
          </div>
        </header>

        {error && (
          <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">{error}</p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-neutral-400 gap-2">
            <IconSpinner className="w-5 h-5" />
            <span className="text-sm">Đang tải...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-neutral-200 rounded-lg bg-white">
            <p className="text-sm text-neutral-500">
              {search.trim() ? `Không tìm thấy "${search}".` : "Chưa có khách hàng nào."}
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
                      <th className="text-left px-4 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wider hidden lg:table-cell">Ngày tạo</th>
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
                        <td className="px-4 py-3.5 text-neutral-500 text-xs hidden lg:table-cell whitespace-nowrap">{formatDate(user.created_at)}</td>
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
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${p === page ? "bg-neutral-900 text-white" : "text-neutral-600 hover:text-neutral-900"}`}
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
