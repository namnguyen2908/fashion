import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../services/api";
import { IconSpinner, IconTrash, IconSearch } from "../../../components/admin/Icons";

function SupplierCompareModal({ variantId, onClose, onSelect }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!variantId) return;
    setLoading(true);
    api.get(`/warehouse/variants/${variantId}/suppliers`)
      .then(({ data }) => setSuppliers(data?.data ?? []))
      .catch(() => setSuppliers([]))
      .finally(() => setLoading(false));
  }, [variantId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-lg border border-neutral-100 shadow-2xl p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-medium mb-4">So sánh giá nhà cung cấp</h3>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-neutral-400 gap-2">
            <IconSpinner className="w-5 h-5" />
            <span className="text-sm">Đang tải...</span>
          </div>
        ) : suppliers.length === 0 ? (
          <p className="text-sm text-neutral-500 py-4 text-center">Chưa có nhà cung cấp nào.</p>
        ) : (
          <div className="space-y-2">
            {suppliers.map((s) => (
              <div key={s.supplier_id}
                className="flex items-center justify-between p-3 border border-neutral-100 rounded-md hover:bg-neutral-50 cursor-pointer"
                onClick={() => { onSelect?.(s); onClose(); }}
              >
                <div>
                  <p className="text-sm font-medium text-neutral-900">{s.supplier_name}</p>
                  <p className="text-xs text-neutral-500">{s.supplier_code || ""}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{s.cost_price ? `${Number(s.cost_price).toLocaleString("vi-VN")}₫` : "—"}</p>
                  {s.previous_cost_price && Number(s.previous_cost_price) !== Number(s.cost_price) && (
                    <p className="text-xs text-neutral-400 line-through">{Number(s.previous_cost_price).toLocaleString("vi-VN")}₫</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-neutral-600">Đóng</button>
        </div>
      </div>
    </div>
  );
}

export default function CreateReceipt() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [products, setProducts] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showCompare, setShowCompare] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const searchRef = useRef(null);

  useEffect(() => {
    api.get("/warehouse/suppliers", { params: { active: "true" } })
      .then(({ data }) => setSuppliers(Array.isArray(data?.data) ? data.data : []))
      .catch(() => {});
  }, []);

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
      const { data } = await api.get(`/warehouse/stocks/product/${product.id}`);
      const variants = (data?.data ?? []).map((v) => ({
        ...v,
        quantity: "",
        unit_cost: ""
      }));

      if (variants.length === 0) return;

      const variantIds = variants.map((v) => v.variant_id);
      let supplierInfo = {};
      try {
        const { data: sd } = await api.get(`/warehouse/variants/${variantIds[0]}/suppliers`);
        sd?.data?.forEach((s) => { supplierInfo[s.supplier_id] = s; });
      } catch {}

      const bestSupplierId = supplierId || Object.keys(supplierInfo)[0] || "";
      if (bestSupplierId && supplierInfo[bestSupplierId]?.cost_price) {
        variants.forEach((v) => { v.unit_cost = Number(supplierInfo[bestSupplierId].cost_price); });
      }

      setProducts((prev) => [...prev, { ...product, variants }]);
      setSearchText("");
      setSearchResults([]);
      searchRef.current?.focus();
    } catch { }
  };

  const removeProduct = (productIndex) => {
    setProducts((prev) => prev.filter((_, i) => i !== productIndex));
  };

  const updateVariant = (productIndex, variantIndex, field, value) => {
    setProducts((prev) => {
      const updated = [...prev];
      updated[productIndex] = { ...updated[productIndex] };
      updated[productIndex].variants = [...updated[productIndex].variants];
      updated[productIndex].variants[variantIndex] = {
        ...updated[productIndex].variants[variantIndex],
        [field]: value
      };
      return updated;
    });
  };

  const applyPriceToAll = (productIndex, price) => {
    setProducts((prev) => {
      const updated = [...prev];
      updated[productIndex] = { ...updated[productIndex] };
      updated[productIndex].variants = updated[productIndex].variants.map((v) => ({ ...v, unit_cost: price }));
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const items = products.flatMap((p) =>
      p.variants.filter((v) => v.quantity && Number(v.quantity) > 0).map((v) => ({
        variant_id: v.variant_id,
        quantity: Number(v.quantity),
        unit_cost: v.unit_cost ? Number(v.unit_cost) : null
      }))
    );

    if (items.length === 0) {
      setError("Vui lòng chọn ít nhất một sản phẩm và nhập số lượng.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/warehouse/receipts", {
        supplier_id: supplierId ? Number(supplierId) : null,
        notes: notes.trim() || null,
        items
      });
      navigate("/admin/warehouse/receipts");
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể tạo phiếu nhập.");
    } finally {
      setSubmitting(false);
    }
  };

  const allVariantIds = products.flatMap((p) =>
    p.variants.filter((v) => v.quantity && Number(v.quantity) > 0).map((v) => v.variant_id)
  );

  const filteredSuppliers = suppliers;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full">
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-medium tracking-tight">Tạo phiếu nhập kho</h1>
        <p className="mt-1 text-sm text-neutral-500">Chọn sản phẩm → nhập số lượng → xác nhận</p>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
          <h2 className="text-sm font-medium text-neutral-900 uppercase tracking-wider">Thông tin chung</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm text-neutral-600 mb-1">Nhà cung cấp</label>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
                className="w-full border border-neutral-200 rounded-md px-4 py-2 text-sm outline-none focus:border-neutral-400 transition-colors bg-white">
                <option value="">-- Chọn nhà cung cấp --</option>
                {filteredSuppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ""}</option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-64">
              <label className="block text-sm text-neutral-600 mb-1">Ghi chú</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Ghi chú (không bắt buộc)"
                className="w-full border border-neutral-200 rounded-md px-4 py-2 text-sm outline-none focus:border-neutral-400 transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-neutral-900 uppercase tracking-wider">Sản phẩm nhập</h2>
          </div>

          <div className="relative">
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none z-10" />
              <input ref={searchRef} type="text" value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Tìm sản phẩm để thêm vào phiếu nhập..."
                className="w-full border border-neutral-200 rounded-md pl-10 pr-4 py-2.5 text-sm outline-none focus:border-neutral-400 transition-colors"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((p) => (
                  <button key={p.id} type="button"
                    onMouseDown={() => addProduct(p)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-neutral-50 border-b border-neutral-50 last:border-0 font-medium"
                  >
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

              <div className="px-4 py-3 flex items-center gap-2 border-b border-neutral-50">
                <span className="text-xs text-neutral-500">Giá nhập chung:</span>
                <input type="number" min="0"
                  onChange={(e) => applyPriceToAll(pIdx, e.target.value ? Number(e.target.value) : "")}
                  placeholder="Áp dụng cho tất cả..."
                  className="w-36 border border-neutral-200 rounded px-2 py-1 text-sm outline-none focus:border-neutral-400"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-neutral-500">
                      <th className="px-4 py-2 font-medium">Màu</th>
                      <th className="px-4 py-2 font-medium">Size</th>
                      <th className="px-4 py-2 font-medium">SKU</th>
                      <th className="px-4 py-2 font-medium text-right w-28">Số lượng</th>
                      <th className="px-4 py-2 font-medium text-right w-36">Giá nhập</th>
                      <th className="px-4 py-2 font-medium text-right w-20"></th>
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
                            onChange={(e) => updateVariant(pIdx, vIdx, "quantity", e.target.value)}
                            placeholder="SL"
                            className="w-full border border-neutral-200 rounded px-2 py-1.5 text-sm text-right outline-none focus:border-neutral-400"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input type="number" min="0" value={variant.unit_cost}
                            onChange={(e) => updateVariant(pIdx, vIdx, "unit_cost", e.target.value)}
                            placeholder="₫"
                            className="w-full border border-neutral-200 rounded px-2 py-1.5 text-sm text-right outline-none focus:border-neutral-400"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button type="button" onClick={() => setShowCompare(variant.variant_id)}
                            className="text-xs text-neutral-400 hover:text-neutral-900 underline underline-offset-2">
                            So sánh
                          </button>
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
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate("/admin/warehouse/receipts")}
              className="px-5 py-2.5 text-sm text-neutral-600 hover:text-neutral-900 transition-colors">
              Hủy
            </button>
            <button type="submit" disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 disabled:opacity-60 transition-colors">
              {submitting && <IconSpinner />}
              Tạo phiếu nhập
            </button>
          </div>
        </div>
      </form>

      {showCompare && (
        <SupplierCompareModal
          variantId={showCompare}
          onClose={() => setShowCompare(null)}
          onSelect={(s) => {
            setSupplierId(String(s.supplier_id));
            setProducts((prev) => prev.map((p) => ({
              ...p,
              variants: p.variants.map((v) => ({
                ...v,
                unit_cost: s.cost_price ? Number(s.cost_price) : v.unit_cost
              }))
            })));
          }}
        />
      )}
    </div>
  );
}
