import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../../../services/api";
import { IconSpinner, IconEye, IconSearch } from "../../../components/admin/Icons";

const STATUS = {
  DRAFT: { label: "Nháp", cls: "text-neutral-500 bg-neutral-100" },
  CONFIRMED: { label: "Đã xác nhận", cls: "text-blue-600 bg-blue-50" },
  RECEIVED: { label: "Đã nhận đủ", cls: "text-green-600 bg-green-50" },
  CANCELLED: { label: "Đã hủy", cls: "text-red-600 bg-red-50" },
};

const formatDate = (value) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
};

export default function PurchaseOrderList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debounceRef = useRef(null);

  const fetchPOs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, limit: 20 };
      if (status) params.status = status;
      if (search.trim()) params.search = search.trim();
      const { data } = await api.get("/purchase-orders", { params });
      setOrders(data?.data ?? []);
      setTotalPages(data?.totalPages ?? 1);
      setTotal(data?.total ?? 0);
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể tải danh sách đơn đặt hàng.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [page, status, search]);

  useEffect(() => { fetchPOs(); }, [fetchPOs]);

  const confirmPO = async (po) => {
    if (!window.confirm(`Xác nhận đơn đặt hàng ${po.po_code}?`)) return;
    try {
      await api.post(`/purchase-orders/${po.id}/confirm`);
      fetchPOs();
    } catch (err) {
      alert(err?.response?.data?.message || "Không thể xác nhận đơn.");
    }
  };

  const cancelPO = async (po) => {
    if (!window.confirm(`Hủy đơn đặt hàng ${po.po_code}?`)) return;
    try {
      await api.post(`/purchase-orders/${po.id}/cancel`);
      fetchPOs();
    } catch (err) {
      alert(err?.response?.data?.message || "Không thể hủy đơn.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-medium tracking-tight">Đơn đặt hàng</h1>
          <p className="mt-1 text-sm text-neutral-500">{total > 0 ? `${total} đơn` : "Đơn đặt hàng nhà cung cấp"}</p>
        </div>
        <Link
          to="/admin/warehouse/purchase-orders/create"
          className="inline-flex justify-center px-5 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 transition-colors shrink-0"
        >
          Tạo đơn đặt hàng
        </Link>
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
            placeholder="Tìm theo mã đơn hoặc nhà cung cấp..."
            className="w-full border border-neutral-200 rounded-md pl-10 pr-4 py-2 text-sm outline-none focus:border-neutral-400 transition-colors"
          />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="w-full sm:w-48 border border-neutral-200 rounded-md px-3 py-2 text-sm bg-white outline-none focus:border-neutral-400 transition-colors">
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS).map(([key, v]) => (
            <option key={key} value={key}>{v.label}</option>
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
      ) : orders.length === 0 ? (
        <div className="border border-dashed border-neutral-200 rounded-lg bg-white p-12 text-center">
          <p className="text-sm text-neutral-500">Chưa có đơn đặt hàng nào.</p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                    <th className="px-4 py-3 font-medium">Mã đơn</th>
                    <th className="px-4 py-3 font-medium hidden sm:table-cell">Nhà cung cấp</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Kho</th>
                    <th className="px-4 py-3 font-medium">Trạng thái</th>
                    <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">Đã nhận</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">Ngày tạo</th>
                    <th className="px-4 py-3 font-medium text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((po) => (
                    <tr key={po.id} className="border-t border-neutral-100 hover:bg-neutral-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/admin/warehouse/purchase-orders/${po.id}`} className="font-mono text-xs font-medium text-neutral-900 hover:underline">
                          {po.po_code}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-neutral-600 hidden sm:table-cell">{po.supplier_name}</td>
                      <td className="px-4 py-3 text-neutral-600 hidden md:table-cell">{po.warehouse_name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS[po.status]?.cls || ""}`}>
                          {STATUS[po.status]?.label || po.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        <span className="text-neutral-600">{po.received_qty} / {po.total_qty}</span>
                      </td>
                      <td className="px-4 py-3 text-neutral-500 hidden lg:table-cell">{formatDate(po.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {po.status === "DRAFT" && (
                            <button type="button" onClick={() => confirmPO(po)}
                              className="px-2 py-1 text-xs text-green-600 border border-green-200 rounded-md hover:bg-green-50">
                              Xác nhận
                            </button>
                          )}
                          {(po.status === "DRAFT" || po.status === "CONFIRMED") && (
                            <button type="button" onClick={() => cancelPO(po)}
                              className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded-md hover:bg-red-50">
                              Hủy
                            </button>
                          )}
                          <Link to={`/admin/warehouse/purchase-orders/${po.id}`}
                            className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-md hover:bg-neutral-100 transition-colors"
                            aria-label="Chi tiết">
                            <IconEye />
                          </Link>
                        </div>
                      </td>
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
