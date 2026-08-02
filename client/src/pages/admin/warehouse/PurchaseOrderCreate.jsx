import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../../services/api";
import { IconSpinner, IconTrash, IconSearch } from "../../../components/admin/Icons";

export default function PurchaseOrderCreate() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [supplierPrices, setSupplierPrices] = useState({});
  const [products, setProducts] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const searchRef = useRef(null);

  useEffect(() => {
    api.get("/warehouse/suppliers", { params: { active: "true" } })
      .then(({ data }) => setSuppliers(Array.isArray(data?.data) ? data.data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.get("/warehouse/warehouses", { params: { active: "true" } })
      .then(({ data }) => setWarehouses(Array.isArray(data?.data) ? data.data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const { data } = await api.get(`/purchase-orders/${id}`);
        const po = data?.data;
        if (!po) return;
        setSupplierId(String(po.supplier_id));
        setWarehouseId(String(po.warehouse_id));
        setExpectedDate(po.expected_date ? po.expected_date.slice(0, 10) : "");
        setNotes(po.notes || "");
        const grouped = {};
        (po.items ?? []).forEach((item) => {
          if (!grouped[item.product_id]) {
            grouped[item.product_id] = { id: item.product_id, name: item.product_name, variants: [] };
          }
          grouped[item.product_id].variants.push({
            variant_id: item.variant_id, sku: item.sku, color: item.color, size: item.size,
            quantity: String(item.quantity), unit_price: item.unit_price ? String(item.unit_price) : ""
          });
        });
        setProducts(Object.values(grouped));
      } catch (err) {
        setError(err?.response?.data?.message || "Không thể tải đơn đặt hàng.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  useEffect(() => {
    if (!supplierId) { setSupplierPrices({}); return; }
    api.get(`/warehouse/suppliers/${supplierId}/variants`)
      .then(({ data }) => {
        const map = {};
        (data?.data ?? []).forEach((v) => { map[v.variant_id] = v.cost_price; });
        setSupplierPrices(map);
      })
      .catch(() => setSupplierPrices({}));
  }, [supplierId]);

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
        unit_price: supplierPrices[v.variant_id] ? Number(supplierPrices[v.variant_id]) : ""
      }));
      if (variants.length === 0) return;
      setProducts((prev) => [...prev, { ...product, variants }]);
      setSearchText("");
      setSearchResults([]);
      searchRef.current?.focus();
    } catch { }
  };

  const removeProduct = (idx) => setProducts((prev) => prev.filter((_, i) => i !== idx));

  const updateVariant = (pIdx, vIdx, field, value) => {
    setProducts((prev) => {
      const updated = [...prev];
      updated[pIdx] = { ...updated[pIdx], variants: [...updated[pIdx].variants] };
      updated[pIdx].variants[vIdx] = { ...updated[pIdx].variants[vIdx], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!supplierId || !warehouseId) {
      setError("Vui lòng chọn nhà cung cấp và kho nhận.");
      return;
    }
    const items = products.flatMap((p) =>
      p.variants.filter((v) => v.quantity && Number(v.quantity) > 0).map((v) => ({
        variant_id: v.variant_id,
        quantity: Number(v.quantity),
        unit_price: v.unit_price ? Number(v.unit_price) : 0
      }))
    );
    if (items.length === 0) {
      setError("Vui lòng thêm ít nhất một sản phẩm với số lượng lớn hơn 0.");
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        await api.put(`/purchase-orders/${id}`, {
          expected_date: expectedDate || null,
          notes: notes.trim() || null,
          items
        });
        navigate(`/admin/warehouse/purchase-orders/${id}`);
      } else {
        const { data } = await api.post("/purchase-orders", {
          supplier_id: Number(supplierId),
          warehouse_id: Number(warehouseId),
          expected_date: expectedDate || null,
          notes: notes.trim() || null,
          items
        });
        navigate(`/admin/warehouse/purchase-orders/${data?.data?.id}`);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể lưu đơn đặt hàng.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full">
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-medium tracking-tight">{isEdit ? "Sửa đơn đặt hàng" : "Tạo đơn đặt hàng"}</h1>
        <p className="mt-1 text-sm text-neutral-500">Chọn nhà cung cấp, sản phẩm và giá thỏa thuận</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-neutral-400 gap-2">
          <IconSpinner className="w-5 h-5" />
          <span className="text-sm">Đang tải...</span>
        </div>
      ) : (
      <>
      {error && (
        <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
          <h2 className="text-sm font-medium text-neutral-900 uppercase tracking-wider">Thông tin chung</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Nhà cung cấp *</label>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
                className="w-full border border-neutral-200 rounded-md px-4 py-2 text-sm outline-none focus:border-neutral-400 transition-colors bg-white">
                <option value="">-- Chọn nhà cung cấp --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Kho nhận *</label>
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full border border-neutral-200 rounded-md px-4 py-2 text-sm outline-none focus:border-neutral-400 transition-colors bg-white">
                <option value="">-- Chọn kho --</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Ngày dự kiến</label>
              <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)}
                className="w-full border border-neutral-200 rounded-md px-4 py-2 text-sm outline-none focus:border-neutral-400 transition-colors" />
            </div>
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Ghi chú</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Không bắt buộc"
                className="w-full border border-neutral-200 rounded-md px-4 py-2 text-sm outline-none focus:border-neutral-400 transition-colors" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
          <h2 className="text-sm font-medium text-neutral-900 uppercase tracking-wider">Sản phẩm đặt hàng</h2>

          <div className="relative">
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none z-10" />
              <input ref={searchRef} type="text" value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Tìm sản phẩm để thêm vào đơn..."
                className="w-full border border-neutral-200 rounded-md pl-10 pr-4 py-2.5 text-sm outline-none focus:border-neutral-400 transition-colors"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((p) => (
                  <button key={p.id} type="button" onMouseDown={() => addProduct(p)}
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
                      <th className="px-4 py-2 font-medium text-right w-28">Số lượng</th>
                      <th className="px-4 py-2 font-medium text-right w-36">Giá thỏa thuận</th>
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
                            className="w-full border border-neutral-200 rounded px-2 py-1.5 text-sm text-right outline-none focus:border-neutral-400" />
                        </td>
                        <td className="px-4 py-2">
                          <input type="number" min="0" value={variant.unit_price}
                            onChange={(e) => updateVariant(pIdx, vIdx, "unit_price", e.target.value)}
                            placeholder="₫"
                            className="w-full border border-neutral-200 rounded px-2 py-1.5 text-sm text-right outline-none focus:border-neutral-400" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => navigate("/admin/warehouse/purchase-orders")}
            className="px-5 py-2.5 text-sm text-neutral-600 hover:text-neutral-900 transition-colors">
            Hủy
          </button>
          <button type="submit" disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 disabled:opacity-60 transition-colors">
            {submitting && <IconSpinner />}
            {isEdit ? "Cập nhật đơn" : "Tạo đơn đặt hàng"}
          </button>
        </div>
      </form>
      </>
      )}
    </div>
  );
}
