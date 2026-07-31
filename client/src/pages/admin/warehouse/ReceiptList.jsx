import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../../services/api";
import { IconSpinner, IconEye } from "../../../components/admin/Icons";

const formatDate = (value) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  }).format(new Date(value));
};

export default function ReceiptList() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/warehouse/receipts", { params: { page, limit: 20 } });
      setReceipts(data?.data ?? []);
      setTotalPages(data?.totalPages ?? 1);
      setTotal(data?.total ?? 0);
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể tải danh sách phiếu nhập.");
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchReceipts(); }, [fetchReceipts]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-medium tracking-tight">Phiếu nhập kho</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {total > 0 ? `${total} phiếu nhập` : "Danh sách phiếu nhập kho"}
          </p>
        </div>
        <Link
          to="/admin/warehouse/receipts/create"
          className="inline-flex justify-center px-5 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 transition-colors shrink-0"
        >
          Tạo phiếu nhập
        </Link>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-neutral-400 gap-2">
          <IconSpinner className="w-5 h-5" />
          <span className="text-sm">Đang tải...</span>
        </div>
      ) : receipts.length === 0 ? (
        <div className="border border-dashed border-neutral-200 rounded-lg bg-white p-12 text-center">
          <p className="text-sm text-neutral-500">Chưa có phiếu nhập kho nào.</p>
          <Link to="/admin/warehouse/receipts/create"
            className="inline-block mt-4 text-sm underline underline-offset-4 hover:text-neutral-600">
            Tạo phiếu nhập đầu tiên
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                    <th className="px-4 py-3 font-medium">Mã phiếu</th>
                    <th className="px-4 py-3 font-medium hidden sm:table-cell">Kho</th>
                    <th className="px-4 py-3 font-medium hidden sm:table-cell">Nhà cung cấp</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Người tạo</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Ngày nhập</th>
                    <th className="px-4 py-3 font-medium text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r.id} className="border-t border-neutral-100 hover:bg-neutral-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-medium text-neutral-900">{r.receipt_code}</span>
                        {r.notes && <p className="text-xs text-neutral-500 mt-0.5 truncate max-w-[200px]">{r.notes}</p>}
                      </td>
                      <td className="px-4 py-3 text-neutral-600 hidden sm:table-cell">{r.warehouse_name || "—"}</td>
                      <td className="px-4 py-3 text-neutral-600 hidden sm:table-cell">{r.supplier_name || "—"}</td>
                      <td className="px-4 py-3 text-neutral-600 hidden md:table-cell">{r.created_by_name || "—"}</td>
                      <td className="px-4 py-3 text-neutral-500 text-xs hidden md:table-cell whitespace-nowrap">
                        {formatDate(r.receipt_date)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/admin/warehouse/receipts/${r.id}`}
                          className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-md hover:bg-neutral-100 transition-colors inline-block"
                          aria-label="Chi tiết"
                        >
                          <IconEye />
                        </Link>
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
