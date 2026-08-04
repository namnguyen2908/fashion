import { useState, useEffect, useCallback } from "react";
import api from "../../../services/api";
import { IconSpinner, IconTrash } from "../../../components/admin/Icons";
import ProductSearchSelect from "../../../components/admin/ProductSearchSelect";

const STATUS = {
  DRAFT: { label: "Nháp", cls: "text-amber-600 bg-amber-50" },
  COMPLETED: { label: "Đã ghi sổ", cls: "text-green-600 bg-green-50" },
};

const formatDate = (value) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  }).format(new Date(value));
};

export default function AdjustmentList() {
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [reason, setReason] = useState("");
  const [products, setProducts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
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
      const { data } = await api.get("/warehouse/adjustments", { params: { page, limit: 20 } });
      setList(data?.data ?? []);
      setTotalPages(data?.totalPages ?? 1);
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể tải danh sách.");
    } finally {
      setListLoading(false);
    }
  }, [page, setList, setListLoading, setTotalPages, setError]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const addProduct = async (product) => {
    try {
      const { data } = await api.get(`/warehouse/stocks/product/${product.id}`, {
        params: warehouseId ? { warehouse_id: warehouseId } : {}
      });
      const variants = (data?.data ?? []).map((v) => ({ ...v, quantity: "" }));
      if (variants.length === 0) return;
      setProducts((prev) => [...prev, { ...product, variants }]);
    } catch { }
  };

  const removeProduct = (idx) => setProducts((prev) => prev.filter((_, i) => i !== idx));

  const updateVariant = (pIdx, vIdx, value) => {
    setProducts((prev) => {
      const updated = [...prev];
      updated[pIdx] = { ...updated[pIdx], variants: [...updated[pIdx].variants] };
      updated[pIdx].variants[vIdx] = { ...updated[pIdx].variants[vIdx], quantity: value };
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!warehouseId) { setError("Vui lòng chọn kho."); return; }
    if (!reason.trim()) { setError("Vui lòng nhập lý do điều chỉnh."); return; }
    const items = products.flatMap((p) =>
      p.variants.filter((v) => v.quantity !== "" && Number(v.quantity) !== 0).map((v) => ({
        variant_id: v.variant_id,
        quantity: Number(v.quantity)
      }))
    );
    if (items.length === 0) {
      setError("Vui lòng thêm ít nhất một sản phẩm với số lượng khác 0.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/warehouse/adjustments", {
        warehouse_id: Number(warehouseId),
        reason: reason.trim(),
        items
      });
      setProducts([]);
      setReason("");
      setError("");
      fetchList();
      alert("Đã tạo phiếu điều chỉnh (Nháp). Nhấn \"Ghi sổ\" để áp dụng.");
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể tạo phiếu điều chỉnh.");
    } finally {
      setSubmitting(false);
    }
  };

  const complete = async (adj) => {
    if (!window.confirm(`Ghi sổ phiếu điều chỉnh ${adj.adjustment_code}?`)) return;
    try {
      await api.post(`/warehouse/adjustments/${adj.id}/complete`);
      fetchList();
    } catch (err) {
      alert(err?.response?.data?.message || "Không thể ghi sổ.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full">
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-medium tracking-tight">Điều chỉnh tồn kho</h1>
        <p className="mt-1 text-sm text-neutral-500">Số dương để tăng tồn, số âm để giảm (kiểm kê, hao hụt...)</p>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="mb-10 bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
        <h2 className="text-sm font-medium text-neutral-900 uppercase tracking-wider">Tạo phiếu điều chỉnh</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm text-neutral-600 mb-1">Kho *</label>
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full border border-neutral-200 rounded-md px-4 py-2 text-sm outline-none focus:border-neutral-400 transition-colors bg-white">
              <option value="">-- Chọn kho --</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm text-neutral-600 mb-1">Lý do *</label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập lý do điều chỉnh..."
              className="w-full border border-neutral-200 rounded-md px-4 py-2 text-sm outline-none focus:border-neutral-400 transition-colors" />
          </div>
        </div>

        <ProductSearchSelect
          onSelect={addProduct}
          placeholder="Tìm sản phẩm để thêm..."
        />

        {products.length > 0 && (
          <div className="border border-neutral-200 rounded-lg overflow-hidden">
            {products.map((product, pIdx) => (
              <div key={`${product.id}-${pIdx}`} className="border-b border-neutral-100 last:border-0">
                <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50">
                  <span className="text-sm font-medium text-neutral-900">{product.name}</span>
                  <button type="button" onClick={() => removeProduct(pIdx)}
                    className="p-1 text-neutral-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors">
                    <IconTrash className="w-4 h-4" />
                  </button>
                </div>
                {product.variants.map((variant, vIdx) => (
                  <div key={variant.variant_id} className="flex items-center gap-3 px-4 py-2 border-t border-neutral-50">
                    <span className="flex-1 text-sm text-neutral-700">
                      {variant.color || "—"}{variant.size ? ` / ${variant.size}` : ""}
                      <span className="ml-2 text-xs text-neutral-400 font-mono">{variant.sku}</span>
                    </span>
                    <input type="number" value={variant.quantity}
                      onChange={(e) => updateVariant(pIdx, vIdx, e.target.value)}
                      placeholder="±SL"
                      className="w-28 border border-neutral-200 rounded px-2 py-1.5 text-sm text-right outline-none focus:border-neutral-400" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 disabled:opacity-60 transition-colors">
            {submitting && <IconSpinner />}
            Tạo phiếu điều chỉnh (Nháp)
          </button>
        </div>
      </form>

      <h2 className="text-sm font-medium text-neutral-900 uppercase tracking-wider mb-4">Danh sách phiếu điều chỉnh</h2>
      {listLoading ? (
        <div className="flex items-center justify-center py-12 text-neutral-400 gap-2">
          <IconSpinner className="w-4 h-4" />
          <span className="text-xs">Đang tải...</span>
        </div>
      ) : list.length === 0 ? (
        <div className="border border-dashed border-neutral-200 rounded-lg bg-white p-10 text-center">
          <p className="text-sm text-neutral-500">Chưa có phiếu điều chỉnh nào.</p>
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
                    <th className="px-4 py-3 font-medium">Lý do</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Số mặt hàng</th>
                    <th className="px-4 py-3 font-medium">Trạng thái</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">Thời gian</th>
                    <th className="px-4 py-3 font-medium text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((adj) => (
                    <tr key={adj.id} className="border-t border-neutral-100 hover:bg-neutral-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-neutral-500">{adj.adjustment_code}</td>
                      <td className="px-4 py-3 text-neutral-600 hidden sm:table-cell">{adj.warehouse_name}</td>
                      <td className="px-4 py-3 text-neutral-800 max-w-[220px] truncate">{adj.reason}</td>
                      <td className="px-4 py-3 text-neutral-600 hidden md:table-cell">{adj.item_count}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS[adj.status]?.cls || ""}`}>
                          {STATUS[adj.status]?.label || adj.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-500 hidden lg:table-cell">{formatDate(adj.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        {adj.status === "DRAFT" && (
                          <button type="button" onClick={() => complete(adj)}
                            className="px-2 py-1 text-xs text-green-600 border border-green-200 rounded-md hover:bg-green-50">
                            Ghi sổ
                          </button>
                        )}
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

