import { useState, useEffect, useCallback, useRef } from "react";
import api from "../../../services/api";
import { IconSpinner, IconSearch } from "../../../components/admin/Icons";

const REF_TYPES = [
  { value: "", label: "Tất cả loại" },
  { value: "GOODS_RECEIPT", label: "Nhập kho" },
  { value: "ADJUSTMENT", label: "Điều chỉnh" },
  { value: "TRANSFER", label: "Chuyển kho" },
];

const refBadge = (type) => {
  const map = {
    GOODS_RECEIPT: "text-green-600 bg-green-50",
    ADJUSTMENT: "text-amber-600 bg-amber-50",
    TRANSFER: "text-blue-600 bg-blue-50",
  };
  return map[type] || "text-neutral-500 bg-neutral-100";
};

const formatDate = (value) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  }).format(new Date(value));
};

export default function TransactionList() {
  const [transactions, setTransactions] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [warehouseId, setWarehouseId] = useState("");
  const [refType, setRefType] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debounceRef = useRef(null);

  const fetchWarehouses = useCallback(async () => {
    try {
      const { data } = await api.get("/warehouse/warehouses");
      setWarehouses(Array.isArray(data?.data) ? data.data : []);
    } catch { setWarehouses([]); }
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, limit: 20 };
      if (warehouseId) params.warehouse_id = warehouseId;
      if (refType) params.ref_type = refType;
      if (search.trim()) params.search = search.trim();
      const { data } = await api.get("/warehouse/transactions", { params });
      setTransactions(data?.data ?? []);
      setTotalPages(data?.totalPages ?? 1);
      setTotal(data?.total ?? 0);
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể tải lịch sử giao dịch.");
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [page, warehouseId, refType, search]);

  useEffect(() => { fetchWarehouses(); }, [fetchWarehouses]);
  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-medium tracking-tight">Lịch sử giao dịch kho</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {total > 0 ? `${total} giao dịch` : "Sổ cái biến động tồn kho"}
        </p>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none z-10" />
          <input type="text" value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              clearTimeout(debounceRef.current);
              debounceRef.current = setTimeout(() => { setSearch(e.target.value); setPage(1); }, 500);
            }}
            placeholder="Tìm theo sản phẩm hoặc SKU..."
            className="w-full border border-neutral-200 rounded-md pl-10 pr-4 py-2 text-sm outline-none focus:border-neutral-400 transition-colors"
          />
        </div>
        <select value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setPage(1); }}
          className="w-full sm:w-56 border border-neutral-200 rounded-md px-3 py-2 text-sm bg-white outline-none focus:border-neutral-400 transition-colors">
          <option value="">Tất cả kho</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <select value={refType} onChange={(e) => { setRefType(e.target.value); setPage(1); }}
          className="w-full sm:w-48 border border-neutral-200 rounded-md px-3 py-2 text-sm bg-white outline-none focus:border-neutral-400 transition-colors">
          {REF_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-neutral-400 gap-2">
          <IconSpinner className="w-5 h-5" />
          <span className="text-sm">Đang tải...</span>
        </div>
      ) : transactions.length === 0 ? (
        <div className="border border-dashed border-neutral-200 rounded-lg bg-white p-12 text-center">
          <p className="text-sm text-neutral-500">Không có giao dịch nào.</p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                    <th className="px-4 py-3 font-medium">Loại</th>
                    <th className="px-4 py-3 font-medium">Sản phẩm</th>
                    <th className="px-4 py-3 font-medium hidden sm:table-cell">SKU</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Kho</th>
                    <th className="px-4 py-3 font-medium text-right">Thay đổi</th>
                    <th className="px-4 py-3 font-medium text-right">Còn lại</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">Người thực hiện</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} className="border-t border-neutral-100 hover:bg-neutral-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${refBadge(t.ref_type)}`}>
                          {REF_TYPES.find((r) => r.value === t.ref_type)?.label || t.ref_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-neutral-900">{t.product_name}</span>
                        <span className="ml-2 text-xs text-neutral-400 hidden sm:inline">{t.color || ""}{t.color && t.size ? " / " : ""}{t.size || ""}</span>
                      </td>
                      <td className="px-4 py-3 text-neutral-500 text-xs font-mono hidden sm:table-cell">{t.sku}</td>
                      <td className="px-4 py-3 text-neutral-600 hidden md:table-cell">{t.warehouse_name}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        <span className={t.qty_change > 0 ? "text-green-600" : "text-red-600"}>
                          {t.qty_change > 0 ? `+${t.qty_change}` : t.qty_change}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-600">{t.balance_after}</td>
                      <td className="px-4 py-3 text-neutral-500 hidden lg:table-cell">{t.created_by_name || "—"}</td>
                      <td className="px-4 py-3 text-neutral-500 hidden lg:table-cell">{formatDate(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 text-sm border border-neutral-200 rounded-md disabled:opacity-40 hover:bg-neutral-50">
                Trước
              </button>
              <span className="text-sm text-neutral-500">Trang {page} / {totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 text-sm border border-neutral-200 rounded-md disabled:opacity-40 hover:bg-neutral-50">
                Sau
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
