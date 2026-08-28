import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../../../services/api";
import { IconSpinner } from "../../../components/admin/Icons";

const formatMoney = (value) => {
  const n = Number(value);
  return isNaN(n) || n === 0 ? "—" : n.toLocaleString("vi-VN");
};

export default function CreateReceipt() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const poId = searchParams.get("po_id");

  const [loading, setLoading] = useState(!!poId);
  const [error, setError] = useState("");
  const [po, setPo] = useState(null);
  const [supplierPrices, setSupplierPrices] = useState({});
  const [receiptDate, setReceiptDate] = useState("");
  const [notes, setNotes] = useState("");
  const [products, setProducts] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Phiếu nhập luôn được tạo từ một PO đã xác nhận
  useEffect(() => {
    if (!poId) return;
    (async () => {
      try {
        const { data } = await api.get(`/purchase-orders/${poId}`);
        const poData = data?.data;
        if (!poData) throw new Error("Không tìm thấy đơn đặt hàng.");
        setPo(poData);

        if (poData.supplier_id) {
          api.get(`/warehouse/suppliers/${poData.supplier_id}/variants`)
            .then(({ data: s }) => {
              const map = {};
              (s?.data ?? []).forEach((v) => { map[v.variant_id] = v.cost_price; });
              setSupplierPrices(map);
            })
            .catch(() => {});
        }

        const grouped = {};
        (poData.items ?? []).forEach((item) => {
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
            po_price: item.unit_price || 0,
            unit_cost: item.unit_price ? String(item.unit_price) : "",
            sync_master_cost: false
          });
        });
        setProducts(Object.values(grouped));
      } catch (err) {
        setError(err?.response?.data?.message || err?.message || "Không thể tải đơn đặt hàng.");
      } finally {
        setLoading(false);
      }
    })();
  }, [poId]);

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

    const items = products.flatMap((p) =>
      p.variants.filter((v) => v.quantity && Number(v.quantity) > 0).map((v) => ({
        po_item_id: v.po_item_id,
        variant_id: v.variant_id,
        quantity: Number(v.quantity),
        unit_cost: v.unit_cost ? Number(v.unit_cost) : 0,
        sync_master_cost: !!v.sync_master_cost
      }))
    );
    if (items.length === 0) {
      setError("Vui lòng chọn ít nhất một sản phẩm và nhập số lượng.");
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post("/goods-receipts", {
        po_id: Number(poId),
        warehouse_id: Number(po.warehouse_id),
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

  if (!poId) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full">
        <h1 className="text-xl sm:text-2xl font-medium tracking-tight">Tạo phiếu nhập kho</h1>
        <div className="mt-6 bg-white border border-neutral-200 rounded-lg p-12 text-center">
          <p className="text-sm text-neutral-500">Phiếu nhập phải được tạo từ một đơn đặt hàng đã xác nhận.</p>
          <Link to="/admin/warehouse/purchase-orders"
            className="inline-block mt-6 px-6 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 transition-colors">
            Chọn đơn đặt hàng
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full flex items-center justify-center py-20 text-neutral-400 gap-2">
        <IconSpinner className="w-5 h-5" />
        <span className="text-sm">Đang tải...</span>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full text-center">
        <p className="text-sm text-red-600">{error || "Không tìm thấy đơn đặt hàng."}</p>
        <Link to="/admin/warehouse/purchase-orders"
          className="inline-block mt-4 text-sm underline underline-offset-4 text-neutral-500 hover:text-neutral-900 transition-colors">
          ← Quay lại đơn đặt hàng
        </Link>
      </div>
    );
  }

  const totalQty = products.reduce(
    (sum, p) => sum + p.variants.filter((v) => v.quantity && Number(v.quantity) > 0)
      .reduce((s, v) => s + Number(v.quantity), 0), 0) || 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full">
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-medium tracking-tight">Tạo phiếu nhập kho</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Nhận hàng theo đơn đặt hàng <span className="font-mono">{po.po_code}</span>
        </p>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
          <h2 className="text-sm font-medium text-neutral-900 uppercase tracking-wider">Thông tin chung</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Kho nhận</label>
              <p className="w-full border border-neutral-200 rounded-md px-4 py-2 text-sm bg-neutral-50">
                {po.warehouse_name || "—"}
              </p>
            </div>
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Nhà cung cấp</label>
              <p className="w-full border border-neutral-200 rounded-md px-4 py-2 text-sm bg-neutral-50">
                {po.supplier_name || "—"}
              </p>
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

          {products.length === 0 && (
            <div className="border border-dashed border-neutral-200 rounded-lg p-8 text-center">
              <p className="text-sm text-neutral-400">
                Đơn đặt hàng này đã được nhận đủ hoặc chưa có sản phẩm.
              </p>
            </div>
          )}

          {products.map((product, pIdx) => (
            <div key={`${product.id}-${pIdx}`} className="border border-neutral-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 border-b border-neutral-100">
                <span className="text-sm font-medium text-neutral-900">{product.name}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-neutral-500">
                      <th className="px-4 py-2 font-medium">Màu</th>
                      <th className="px-4 py-2 font-medium">Size</th>
                      <th className="px-4 py-2 font-medium">SKU</th>
                      <th className="px-4 py-2 font-medium text-right w-20">SL</th>
                      <th className="px-4 py-2 font-medium text-right">Giá master</th>
                      <th className="px-4 py-2 font-medium text-right">Giá PO</th>
                      <th className="px-4 py-2 font-medium text-right w-32">Giá nhập</th>
                      <th className="px-4 py-2 font-medium text-center w-40">Đồng bộ master</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.variants.map((variant, vIdx) => {
                      const poPrice = Number(variant.po_price || 0);
                      const costPrice = variant.unit_cost ? Number(variant.unit_cost) : null;
                      const differs = costPrice !== null && costPrice !== poPrice;
                      const masterPrice = supplierPrices[variant.variant_id];
                      return (
                        <tr key={variant.variant_id} className="border-t border-neutral-50 hover:bg-neutral-50/50 transition-colors">
                          <td className="px-4 py-2 text-neutral-700">{variant.color || "—"}</td>
                          <td className="px-4 py-2 text-neutral-700">{variant.size || "—"}</td>
                          <td className="px-4 py-2 text-neutral-400 text-xs font-mono">{variant.sku}</td>
                          <td className="px-4 py-2">
                            <input type="number" min="0" value={variant.quantity}
                              onChange={(e) => updateVariant(pIdx, vIdx, "quantity", e.target.value)}
                              className="w-full border border-neutral-200 rounded px-2 py-1.5 text-sm text-right outline-none focus:border-neutral-400" />
                          </td>
                          <td className="px-4 py-2 text-right text-neutral-400">
                            {formatMoney(masterPrice)}
                          </td>
                          <td className="px-4 py-2 text-right text-neutral-600">
                            {formatMoney(poPrice)}
                          </td>
                          <td className="px-4 py-2">
                            <input type="number" min="0" value={variant.unit_cost}
                              onChange={(e) => updateVariant(pIdx, vIdx, "unit_cost", e.target.value)}
                              className="w-full border border-neutral-200 rounded px-2 py-1.5 text-sm text-right outline-none focus:border-neutral-400" />
                            {differs && (
                              <p className="text-right text-[11px] text-amber-600 mt-1">Chênh lệch với giá PO</p>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <label className={`inline-flex items-center gap-1.5 text-xs cursor-pointer ${differs ? "text-neutral-600" : "text-neutral-300"}`}>
                              <input type="checkbox"
                                checked={!!variant.sync_master_cost}
                                disabled={!differs}
                                onChange={(e) => updateVariant(pIdx, vIdx, "sync_master_cost", e.target.checked)}
                                className="rounded border-neutral-300 text-black focus:ring-black" />
                              Cập nhật giá NCC
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">{totalQty} sản phẩm</p>
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
    </div>
  );
}
