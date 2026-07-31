import { useState, useEffect, useRef, Fragment } from "react";
import api from "../../../services/api";
import { IconSpinner, IconTrash, IconSearch, IconChevron } from "../../../components/admin/Icons";

const formatDate = (value) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  }).format(new Date(value));
};

export default function TransferCreate() {
  const [warehouses, setWarehouses] = useState([]);
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [note, setNote] = useState("");
  const [products, setProducts] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [expandedCode, setExpandedCode] = useState(null);
  const [transferDetail, setTransferDetail] = useState(null);
  const searchRef = useRef(null);

  useEffect(() => {
    api.get("/warehouse/warehouses", { params: { active: "true" } })
      .then(({ data }) => setWarehouses(Array.isArray(data?.data) ? data.data : []))
      .catch(() => {});
  }, []);

  const fetchRecent = () => {
    setRecentLoading(true);
    api.get("/warehouse/transfers", { params: { limit: 10 } })
      .then(({ data }) => setRecent(data?.data ?? []))
      .catch(() => setRecent([]))
      .finally(() => setRecentLoading(false));
  };

  useEffect(() => { fetchRecent(); }, []);

  useEffect(() => {
    if (!searchText.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/products", { params: { search: searchText, limit: 8 } });
        setSearchResults(data?.data ?? []);
      } catch { setSearchResults([]); }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchText]);

  const addProduct = async (product) => {
    try {
      const { data } = await api.get(`/warehouse/stocks/product/${product.id}`, {
        params: fromWarehouseId ? { warehouse_id: fromWarehouseId } : {}
      });
      const variants = (data?.data ?? []).map((v) => ({
        ...v,
        quantity: ""
      }));
      if (variants.length === 0) return;
      setProducts((prev) => [...prev, { ...product, variants }]);
      setSearchText("");
      setSearchResults([]);
      searchRef.current?.focus();
    } catch { }
  };

  const removeProduct = (productIndex) => {
    setProducts((prev) => prev.filter((_, i) => i !== productIndex));
  };

  const updateVariant = (productIndex, variantIndex, value) => {
    setProducts((prev) => {
      const updated = [...prev];
      updated[productIndex] = { ...updated[productIndex] };
      updated[productIndex].variants = [...updated[productIndex].variants];
      updated[productIndex].variants[variantIndex] = {
        ...updated[productIndex].variants[variantIndex],
        quantity: value
      };
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!fromWarehouseId || !toWarehouseId) {
      setError("Vui lòng chọn kho nguồn và kho đích.");
      return;
    }
    if (Number(fromWarehouseId) === Number(toWarehouseId)) {
      setError("Kho nguồn và kho đích phải khác nhau.");
      return;
    }
    const items = products.flatMap((p) =>
      p.variants.filter((v) => v.quantity && Number(v.quantity) > 0).map((v) => ({
        variant_id: v.variant_id,
        quantity: Number(v.quantity)
      }))
    );
    if (items.length === 0) {
      setError("Vui lòng thêm ít nhất một sản phẩm với số lượng lớn hơn 0.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/warehouse/transfers", {
        from_warehouse_id: Number(fromWarehouseId),
        to_warehouse_id: Number(toWarehouseId),
        note: note.trim() || null,
        items
      });
      setProducts([]);
      setNote("");
      setError("");
      fetchRecent();
      alert("Đã tạo phiếu chuyển kho thành công.");
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể tạo phiếu chuyển kho.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleExpand = async (code) => {
    if (expandedCode === code) {
      setExpandedCode(null);
      setTransferDetail(null);
      return;
    }
    setExpandedCode(code);
    try {
      const { data } = await api.get(`/warehouse/transfers/${encodeURIComponent(code)}`);
      setTransferDetail(data?.data ?? null);
    } catch {
      setTransferDetail(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full">
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-medium tracking-tight">Chuyển kho</h1>
        <p className="mt-1 text-sm text-neutral-500">Chuyển sản phẩm giữa các kho</p>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
          <h2 className="text-sm font-medium text-neutral-900 uppercase tracking-wider">Thông tin chung</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm text-neutral-600 mb-1">Kho nguồn *</label>
              <select value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)}
                className="w-full border border-neutral-200 rounded-md px-4 py-2 text-sm outline-none focus:border-neutral-400 transition-colors bg-white">
                <option value="">-- Chọn kho --</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm text-neutral-600 mb-1">Kho đích *</label>
              <select value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)}
                className="w-full border border-neutral-200 rounded-md px-4 py-2 text-sm outline-none focus:border-neutral-400 transition-colors bg-white">
                <option value="">-- Chọn kho --</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm text-neutral-600 mb-1">Ghi chú</label>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú (không bắt buộc)"
                className="w-full border border-neutral-200 rounded-md px-4 py-2 text-sm outline-none focus:border-neutral-400 transition-colors" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
          <h2 className="text-sm font-medium text-neutral-900 uppercase tracking-wider">Sản phẩm chuyển</h2>

          <div className="relative">
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none z-10" />
              <input ref={searchRef} type="text" value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Tìm sản phẩm để chuyển..."
                className="w-full border border-neutral-200 rounded-md pl-10 pr-4 py-2.5 text-sm outline-none focus:border-neutral-400 transition-colors"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((p) => (
                  <button key={p.id} type="button"
                    onMouseDown={() => addProduct(p)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-neutral-50 border-b border-neutral-50 last:border-0 font-medium">
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {products.length === 0 && (
            <div className="border border-dashed border-neutral-200 rounded-lg p-8 text-center">
              <p className="text-sm text-neutral-400">Tìm và chọn sản phẩm để bắt đầu</p>
            </div>
          )}

          {products.map((product, pIdx) => (
            <div key={`${product.id}-${pIdx}`} className="border border-neutral-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 border-b border-neutral-100">
                <span className="text-sm font-medium text-neutral-900">{product.name}</span>
                <button type="button" onClick={() => removeProduct(pIdx)}
                  className="p-1 text-neutral-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors">
                  <IconTrash className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-neutral-500">
                      <th className="px-4 py-2 font-medium">Màu</th>
                      <th className="px-4 py-2 font-medium">Size</th>
                      <th className="px-4 py-2 font-medium">SKU</th>
                      <th className="px-4 py-2 font-medium text-right">Số lượng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.variants.map((variant, vIdx) => (
                      <tr key={variant.variant_id} className="border-t border-neutral-50 hover:bg-neutral-50/50 transition-colors">
                        <td className="px-4 py-2 text-neutral-700">{variant.color || "—"}</td>
                        <td className="px-4 py-2 text-neutral-700">{variant.size || "—"}</td>
                        <td className="px-4 py-2 text-neutral-400 text-xs font-mono">{variant.sku}</td>
                        <td className="px-4 py-2">
                          <input type="number" min="0" value={variant.quantity}
                            onChange={(e) => updateVariant(pIdx, vIdx, e.target.value)}
                            placeholder="SL"
                            className="w-28 ml-auto block border border-neutral-200 rounded px-2 py-1.5 text-sm text-right outline-none focus:border-neutral-400"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            {products.reduce((sum, p) => sum + p.variants.filter((v) => v.quantity && Number(v.quantity) > 0).reduce((s, v) => s + Number(v.quantity), 0), 0) || 0} sản phẩm
          </p>
          <button type="submit" disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 disabled:opacity-60 transition-colors">
            {submitting && <IconSpinner />}
            Tạo phiếu chuyển kho
          </button>
        </div>
      </form>

      <div className="mt-10">
        <h2 className="text-sm font-medium text-neutral-900 uppercase tracking-wider mb-4">Chuyển kho gần đây</h2>
        {recentLoading ? (
          <div className="flex items-center justify-center py-10 text-neutral-400 gap-2">
            <IconSpinner className="w-4 h-4" />
            <span className="text-xs">Đang tải...</span>
          </div>
        ) : recent.length === 0 ? (
          <div className="border border-dashed border-neutral-200 rounded-lg bg-white p-10 text-center">
            <p className="text-sm text-neutral-500">Chưa có phiếu chuyển kho nào.</p>
          </div>
        ) : (
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                    <th className="px-4 py-3 font-medium w-8"></th>
                    <th className="px-4 py-3 font-medium">Mã phiếu</th>
                    <th className="px-4 py-3 font-medium hidden sm:table-cell">Từ → Đến</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Số mặt hàng</th>
                    <th className="px-4 py-3 font-medium text-right">Tổng SL</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t) => (
                    <Fragment key={t.transfer_code}>
                      <tr className="border-t border-neutral-100 hover:bg-neutral-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => toggleExpand(t.transfer_code)}
                            className="p-1 text-neutral-400 hover:text-neutral-900 rounded transition-colors">
                            <IconChevron expanded={expandedCode === t.transfer_code} className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-neutral-500">{t.transfer_code}</td>
                        <td className="px-4 py-3 text-neutral-600 hidden sm:table-cell">
                          {t.from_warehouse_name} → {t.to_warehouse_name}
                        </td>
                        <td className="px-4 py-3 text-neutral-600 hidden md:table-cell">{t.item_count}</td>
                        <td className="px-4 py-3 text-right font-medium">{t.total_qty}</td>
                        <td className="px-4 py-3 text-neutral-500 hidden lg:table-cell">{formatDate(t.created_at)}</td>
                      </tr>
                      {expandedCode === t.transfer_code && transferDetail && (
                        <tr className="bg-neutral-50/50">
                          <td colSpan={6} className="p-0">
                            <div className="px-6 py-4">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left text-xs uppercase tracking-wider text-neutral-400">
                                    <th className="px-2 py-1 font-medium">Sản phẩm</th>
                                    <th className="px-2 py-1 font-medium hidden sm:table-cell">SKU</th>
                                    <th className="px-2 py-1 font-medium">Kho</th>
                                    <th className="px-2 py-1 font-medium text-right">Thay đổi</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {transferDetail.items?.map((item) => (
                                    <tr key={item.id} className="border-t border-neutral-100">
                                      <td className="px-2 py-2 text-neutral-800">{item.product_name}</td>
                                      <td className="px-2 py-2 text-neutral-500 text-xs font-mono hidden sm:table-cell">{item.sku}</td>
                                      <td className="px-2 py-2 text-neutral-600">{item.warehouse_name}</td>
                                      <td className="px-2 py-2 text-right font-medium">
                                        <span className={item.qty_change > 0 ? "text-green-600" : "text-red-600"}>
                                          {item.qty_change > 0 ? `+${item.qty_change}` : item.qty_change}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
