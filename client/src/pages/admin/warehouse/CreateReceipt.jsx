import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../../services/api";
import { IconSpinner, IconTrash } from "../../../components/admin/Icons";
import ProductSearchSelect from "../../../components/admin/ProductSearchSelect";

export default function CreateReceipt() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const poId = searchParams.get("po_id");

  const [loading, setLoading] = useState(!!poId);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [notes, setNotes] = useState("");
  const [supplierPrices, setSupplierPrices] = useState({});
  const [products, setProducts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
    if (!supplierId) { setSupplierPrices({}); return; }
    api.get(`/warehouse/suppliers/${supplierId}/variants`)
      .then(({ data }) => {
        const map = {};
        (data?.data ?? []).forEach((v) => { map[v.variant_id] = v.cost_price; });
        setSupplierPrices(map);
      })
      .catch(() => setSupplierPrices({}));
  }, [supplierId]);

  // Nếu vào từ PO: tải đơn, khoá nhà cung cấp/kho, prefill sản phẩm từ PO
  useEffect(() => {
    if (!poId) return;
    (async () => {
      try {
        const { data } = await api.get(`/purchase-orders/${poId}`);
        const po = data?.data;
        if (!po) return;
        setSupplierId(String(po.supplier_id));
        setWarehouseId(String(po.warehouse_id));
        const grouped = {};
        (po.items ?? []).forEach((item) => {
          if (item.remaining <= 0) return;
          if (!grouped[item.product_id]) {
            grouped[item.product_id] = { id: item.product_id, name: item.product_name, variants: [] };
          }
          grouped[item.product_id].variants.push({
            po_item_id: item.id,
            variant_id: item.variant_id,
            sku: item.sku,
            color: item.color,
            size: item.size,
            quantity: String(item.remaining),
            unit_cost: item.unit_price ? String(item.unit_price) : ""
          });
        });
        setProducts(Object.values(grouped));
      } catch (err) {
        setError(err?.response?.data?.message || "Không thể tải đơn đặt hàng.");
      } finally {
        setLoading(false);
      }
    })();
  }, [poId]);

  const addProduct = async (product) => {
    try {
      const { data } = await api.get(`/warehouse/stocks/product/${product.id}`);
      const variants = (data?.data ?? []).map((v) => ({
        ...v,
        quantity: "",
        unit_cost: supplierPrices[v.variant_id] ? Number(supplierPrices[v.variant_id]) : ""
      }));
      if (variants.length === 0) return;
      setProducts((prev) => [...prev, { ...product, variants }]);
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

    if (!warehouseId) {
      setError("Vui lòng chọn kho nhận.");
      return;
    }
    const items = products.flatMap((p) =>
      p.variants.filter((v) => v.quantity && Number(v.quantity) > 0).map((v) => ({
        po_item_id: v.po_item_id || null,
        variant_id: v.variant_id,
        quantity: Number(v.quantity),
        unit_cost: v.unit_cost ? Number(v.unit_cost) : 0
      }))
    );
    if (items.length === 0) {
      setError("Vui lòng chọn ít nhất một sản phẩm và nhập số lượng.");
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post("/goods-receipts", {
        po_id: poId ? Number(poId) : null,
        supplier_id: supplierId ? Number(supplierId) : null,
        warehouse_id: Number(warehouseId),
        receipt_date: receiptDate || null,
        notes: notes.trim() || null,
        items
      });
      navigate(`/admin/warehouse/receipts/${data?.data?.id}`);
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể tạo phiếu nhập.");
    } finally {
      setSubmitting(false);
    }
  };

  const supplierLocked = !!poId;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full">
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-medium tracking-tight">Tạo phiếu nhập kho</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {poId ? "Nhận hàng theo đơn đặt hàng" : "Nhập kho trực tiếp (không qua đơn đặt hàng)"}
        </p>
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
              <label className="block text-sm text-neutral-600 mb-1">Kho nhận *</label>
              {supplierLocked ? (
                <p className="w-full border border-neutral-200 rounded-md px-4 py-2 text-sm bg-neutral-50">
                  {warehouses.find((w) => String(w.id) === warehouseId)?.name || "—"}
                </p>
              ) : (
                <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full border border-neutral-200 rounded-md px-4 py-2 text-sm outline-none focus:border-neutral-400 transition-colors bg-white">
                  <option value="">-- Chọn kho --</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Nhà cung cấp</label>
              {supplierLocked ? (
                <p className="w-full border border-neutral-200 rounded-md px-4 py-2 text-sm bg-neutral-50">
                  {suppliers.find((s) => String(s.id) === supplierId)?.name || "—"}
                </p>
              ) : (
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full border border-neutral-200 rounded-md px-4 py-2 text-sm outline-none focus:border-neutral-400 transition-colors bg-white">
                  <option value="">-- Chọn nhà cung cấp --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Ngày nhận</label>
              <input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)}
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
          <h2 className="text-sm font-medium text-neutral-900 uppercase tracking-wider">Sản phẩm nhập</h2>

          {!poId && (
            <ProductSearchSelect
              onSelect={addProduct}
              placeholder="Tìm sản phẩm để thêm vào phiếu nhập..."
            />
          )}

          {products.length === 0 && (
            <div className="border border-dashed border-neutral-200 rounded-lg p-8 text-center">
              <p className="text-sm text-neutral-400">
                {poId ? "Đơn đặt hàng này đã được nhận đủ hoặc chưa có sản phẩm." : "Tìm và chọn sản phẩm để bắt đầu"}
              </p>
            </div>
          )}

          {products.map((product, pIdx) => (
            <div key={`${product.id}-${pIdx}`} className="border border-neutral-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 border-b border-neutral-100">
                <span className="text-sm font-medium text-neutral-900">{product.name}</span>
                {!supplierLocked && (
                  <button type="button" onClick={() => removeProduct(pIdx)}
                    className="p-1 text-neutral-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors">
                    <IconTrash className="w-4 h-4" />
                  </button>
                )}
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
                          <input type="number" min="0" value={variant.unit_cost}
                            onChange={(e) => updateVariant(pIdx, vIdx, "unit_cost", e.target.value)}
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
              Tạo phiếu nhập (Nháp)
            </button>
          </div>
        </div>
      </form>
      </>
      )}
    </div>
  );
}
