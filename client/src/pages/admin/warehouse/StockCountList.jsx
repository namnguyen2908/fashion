import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../../services/api";
import { IconSpinner, IconEye } from "../../../components/admin/Icons";

const STATUS = {
  DRAFT: { label: "Nháp", cls: "text-neutral-500 bg-neutral-100" },
  IN_PROGRESS: { label: "Đang kiểm", cls: "text-blue-600 bg-blue-50" },
  COMPLETED: { label: "Đã hoàn tất", cls: "text-green-600 bg-green-50" },
  CANCELLED: { label: "Đã hủy", cls: "text-red-600 bg-red-50" },
};

const formatDate = (value) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  }).format(new Date(value));
};

export default function StockCountList() {
  const navigate = useNavigate();
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [list, setList] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    api.get("/warehouse/warehouses", { params: { active: "true" } })
      .then(({ data }) => setWarehouses(Array.isArray(data?.data) ? data.data : []))
      .catch(() => {});
  }, []);

  const fetchList = useCallback(async () => {
    setListLoading(true);
    setError("");
    try {
      const { data } = await api.get("/warehouse/counts", { params: { page, limit: 20 } });
      setList(data?.data ?? []);
      setTotalPages(data?.totalPages ?? 1);
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể tải danh sách kiểm kê.");
    } finally {
      setListLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const createCount = async (e) => {
    e.preventDefault();
    setError("");
    if (!warehouseId) { setError("Vui lòng chọn kho."); return; }
    setCreating(true);
    try {
      const { data } = await api.post("/warehouse/counts", {
        warehouse_id: Number(warehouseId),
        notes: notes.trim() || null
      });
      navigate(`/admin/warehouse/counts/${data?.data?.id}`);
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể tạo đợt kiểm kê.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full">
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-medium tracking-tight">Kiểm kê kho</h1>
        <p className="mt-1 text-sm text-neutral-500">Chụp tồn sổ sách, nhập số đếm thực tế, hoàn tất để xử lý chênh lệch</p>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">{error}</p>
      )}

      <form onSubmit={createCount} className="mb-10 bg-white border border-neutral-200 rounded-lg p-6">
        <h2 className="text-sm font-medium text-neutral-900 uppercase tracking-wider mb-4">Tạo đợt kiểm kê</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm text-neutral-600 mb-1">Kho kiểm kê *</label>
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full border border-neutral-200 rounded-md px-4 py-2 text-sm outline-none focus:border-neutral-400 transition-colors bg-white">
              <option value="">-- Chọn kho --</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm text-neutral-600 mb-1">Ghi chú</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Không bắt buộc"
              className="w-full border border-neutral-200 rounded-md px-4 py-2 text-sm outline-none focus:border-neutral-400 transition-colors" />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={creating}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 disabled:opacity-60 transition-colors">
              {creating && <IconSpinner />}
              Tạo đợt kiểm kê
            </button>
          </div>
        </div>
      </form>

      <h2 className="text-sm font-medium text-neutral-900 uppercase tracking-wider mb-4">Danh sách đợt kiểm kê</h2>
      {listLoading ? (
        <div className="flex items-center justify-center py-12 text-neutral-400 gap-2">
          <IconSpinner className="w-4 h-4" />
          <span className="text-xs">Đang tải...</span>
        </div>
      ) : list.length === 0 ? (
        <div className="border border-dashed border-neutral-200 rounded-lg bg-white p-10 text-center">
          <p className="text-sm text-neutral-500">Chưa có đợt kiểm kê nào.</p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                    <th className="px-4 py-3 font-medium">Mã đợt</th>
                    <th className="px-4 py-3 font-medium hidden sm:table-cell">Kho</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Số mặt hàng</th>
                    <th className="px-4 py-3 font-medium">Trạng thái</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">Ngày tạo</th>
                    <th className="px-4 py-3 font-medium text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id} className="border-t border-neutral-100 hover:bg-neutral-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-neutral-500">{c.count_code}</td>
                      <td className="px-4 py-3 text-neutral-600 hidden sm:table-cell">{c.warehouse_name}</td>
                      <td className="px-4 py-3 text-neutral-600 hidden md:table-cell">{c.item_count}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS[c.status]?.cls || ""}`}>
                          {STATUS[c.status]?.label || c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-500 hidden lg:table-cell">{formatDate(c.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/admin/warehouse/counts/${c.id}`}
                          className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-md hover:bg-neutral-100 transition-colors inline-block"
                          aria-label="Chi tiết">
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
