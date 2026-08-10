import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../../services/api";
import { IconSpinner, IconTrash } from "../../../components/admin/Icons";
import ProductSearchSelect from "../../../components/admin/ProductSearchSelect";

const fmt = (n) => {
  const v = Number(n || 0);
  return isNaN(v) ? "0" : v.toLocaleString("vi-VN");
};

export default function PurchaseOrderCreate() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState([]);
  const [pendingProduct, setPendingProduct] = useState(null);
  const [pendingVariants, setPendingVariants] = useState([]);
  const [editSupplierName, setEditSupplierName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
        setWarehouseId(String(po.warehouse_id));
        setExpectedDate(po.expected_date ? po.expected_date.slice(0, 10) : "");
        setNotes(po.notes || "");
        setEditSupplierName(po.supplier_name || "");
        const loaded = (po.items ?? []).map((item) => ({
          variant_id: item.variant_id,
          product_name: item.product_name,
          color: item.color,
          size: item.size,
          sku: item.sku,
          supplierId: String(po.supplier_id),
          supplierOptions: [],
          quantity: String(item.quantity),
          unit_price: item.unit_price ? String(item.unit_price) : ""
        }));
        setRows(loaded);
        refreshSupplierOptions(loaded);
      } catch (err) {
        setError(err?.response?.data?.message || "Không thể tải đơn đặt hàng.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  const refreshSupplierOptions = (currentRows) => {
    const ids = [...new Set(currentRows.map((r) => r.variant_id))];
    if (ids.length === 0) return;
    api.get("/warehouse/supplier-variants/by-ids", { params: { ids: ids.join(",") } })
      .then(({ data }) => {
        const list = data?.data ?? [];
        const byVariant = {};
        list.forEach((s) => {
          (byVariant[s.variant_id] = byVariant[s.variant_id] || []).push(s);
        });
        setRows((prev) => prev.map((row) => {
          const opts = byVariant[row.variant_id] || [];
          let supplierId = row.supplierId;
          let unitPrice = row.unit_price;
          if (!supplierId && opts.length > 0) {
            supplierId = String(opts[0].supplier_id);
            if (opts[0].cost_price != null) unitPrice = String(Number(opts[0].cost_price));
          }
          if (!unitPrice && supplierId) {
            const sup = opts.find((o) => String(o.supplier_id) === String(supplierId));
            if (sup && sup.cost_price != null) unitPrice = String(Number(sup.cost_price));
          }
          return { ...row, supplierOptions: opts, supplierId, unit_price: unitPrice };
        }));
      })
      .catch(() => {});
  };

  const selectProduct = async (product) => {
    try {
      const { data } = await api.get(`/warehouse/stocks/product/${product.id}`);
      const pv = data?.data ?? [];
      if (pv.length === 0) return;
      const existing = new Set(rows.map((r) => r.variant_id));
      setPendingProduct(product);
      setPendingVariants(pv.map((v) => ({ ...v, _selected: !existing.has(v.variant_id) })));
    } catch { }
  };

  const togglePendingVariant = (idx) => {
    setPendingVariants((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], _selected: !updated[idx]._selected };
      return updated;
    });
  };

  const toggleAllPending = () => {
    setPendingVariants((prev) => {
      const allChecked = prev.length > 0 && prev.every((v) => v._selected);
      return prev.map((v) => ({ ...v, _selected: !allChecked }));
    });
  };

  const confirmAddVariants = () => {
    const selected = pendingVariants.filter((v) => v._selected);
    if (selected.length === 0 || !pendingProduct) return;
    const existingIds = new Set(rows.map((r) => r.variant_id));
    const newRows = selected
      .filter((v) => !existingIds.has(v.variant_id))
      .map((v) => ({
        variant_id: v.variant_id,
        product_name: pendingProduct.name,
        color: v.color,
        size: v.size,
        sku: v.sku,
        supplierId: "",
        supplierOptions: [],
        quantity: "",
        unit_price: ""
      }));
    if (newRows.length === 0) return;
    const updated = [...rows, ...newRows];
    setRows(updated);
    refreshSupplierOptions(updated);
    setPendingProduct(null);
    setPendingVariants([]);
  };

  const removeRow = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx));

  const updateRow = (idx, field, value) => {
    setRows((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  };

  const changeRowSupplier = (idx, supplierId) => {
    setRows((prev) => prev.map((row, i) => {
      if (i !== idx) return row;
      const sup = row.supplierOptions.find((o) => String(o.supplier_id) === String(supplierId));
      return {
        ...row,
        supplierId,
        unit_price: sup?.cost_price != null ? String(Number(sup.cost_price)) : row.unit_price
      };
    }));
  };

  const lineTotal = (row) =>
    row.quantity && Number(row.quantity) > 0 ? Number(row.quantity) * Number(row.unit_price || 0) : 0;

  const totalQty = rows.filter((r) => r.quantity && Number(r.quantity) > 0)
    .reduce((s, r) => s + Number(r.quantity), 0);

  const grandTotal = rows.reduce((s, r) => s + lineTotal(r), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!warehouseId) {
      setError("Vui lòng chọn kho nhận.");
      return;
    }
    const itemsByRow = rows.filter((r) => r.quantity && Number(r.quantity) > 0);
    if (itemsByRow.length === 0) {
      setError("Vui lòng thêm ít nhất một sản phẩm với số lượng lớn hơn 0.");
      return;
    }

    if (isEdit) {
      const items = itemsByRow.map((r) => ({
        variant_id: r.variant_id,
        quantity: Number(r.quantity),
        unit_price: r.unit_price ? Number(r.unit_price) : 0
      }));
      setSubmitting(true);
      try {
        await api.put(`/purchase-orders/${id}`, {
          expected_date: expectedDate || null,
          notes: notes.trim() || null,
          items
        });
        navigate(`/admin/warehouse/purchase-orders/${id}`);
      } catch (err) {
        setError(err?.response?.data?.message || "Không thể lưu đơn đặt hàng.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const groupsMap = {};
    for (const r of itemsByRow) {
      if (!r.supplierId) {
        setError(`Vui lòng chọn nhà cung cấp cho "${r.product_name} ${r.color || ""} ${r.size || ""}".`);
        return;
      }
      (groupsMap[r.supplierId] = groupsMap[r.supplierId] || []).push({
        variant_id: r.variant_id,
        quantity: Number(r.quantity),
        unit_price: r.unit_price ? Number(r.unit_price) : 0
      });
    }
    const groups = Object.entries(groupsMap).map(([supplier_id, items]) => ({
      supplier_id: Number(supplier_id),
      items
    }));

    setSubmitting(true);
    try {
      await api.post("/purchase-orders/group", {
        warehouse_id: Number(warehouseId),
        expected_date: expectedDate || null,
        notes: notes.trim() || null,
        groups
      });
      navigate("/admin/warehouse/purchase-orders");
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể tạo đơn đặt hàng.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full">
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-medium tracking-tight">
          {isEdit ? "Sửa đơn đặt hàng" : "Tạo đơn đặt hàng"}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Chọn sản phẩm → mỗi dòng chọn nhà cung cấp → tự tách đơn theo từng nhà cung cấp
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
            <h2 className="text-sm font-medium text-neutral-900 uppercase tracking-wider">Sản phẩm đặt hàng</h2>
            {!isEdit && <span className="text-xs text-neutral-400">Mỗi dòng chọn nhà cung cấp riêng</span>}
          </div>

          <div className="p-6 pb-0 space-y-4">
            <ProductSearchSelect
              onSelect={selectProduct}
              placeholder="Tìm và chọn sản phẩm..."
            />

            {pendingProduct && (
              <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-neutral-900">{pendingProduct.name}</span>
                  <button type="button" onClick={() => { setPendingProduct(null); setPendingVariants([]); }}
                    className="text-xs text-neutral-500 hover:text-neutral-900 underline underline-offset-2">
                    Bỏ chọn
                  </button>
                </div>
                <div className="border border-neutral-200 rounded-md overflow-hidden max-h-64 overflow-y-auto bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white text-left text-xs uppercase text-neutral-500">
                        <th className="px-3 py-2 w-10">
                          <input type="checkbox"
                            checked={pendingVariants.length > 0 && pendingVariants.every((v) => v._selected)}
                            onChange={toggleAllPending}
                            className="rounded border-neutral-300 text-black focus:ring-black" />
                        </th>
                        <th className="px-3 py-2 font-medium">Màu</th>
                        <th className="px-3 py-2 font-medium">Size</th>
                        <th className="px-3 py-2 font-medium">SKU</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingVariants.map((v, idx) => (
                        <tr key={v.variant_id} className="border-t border-neutral-50 hover:bg-neutral-50/50">
                          <td className="px-3 py-1.5">
                            <input type="checkbox" checked={!!v._selected}
                              onChange={() => togglePendingVariant(idx)}
                              className="rounded border-neutral-300 text-black focus:ring-black" />
                          </td>
                          <td className="px-3 py-1.5 text-neutral-700">{v.color || "—"}</td>
                          <td className="px-3 py-1.5 text-neutral-700">{v.size || "—"}</td>
                          <td className="px-3 py-1.5 text-neutral-400 text-xs font-mono">{v.sku}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={confirmAddVariants}
                    className="px-5 py-2 text-sm bg-black text-white rounded-md hover:bg-neutral-800 transition-colors">
                    Thêm {pendingVariants.filter((v) => v._selected).length} variant vào bảng
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="p-6">
            {rows.length === 0 ? (
              <div className="border border-dashed border-neutral-200 rounded-lg p-10 text-center">
                <p className="text-sm text-neutral-400">Chọn sản phẩm ở trên để bắt đầu</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                      <th className="px-4 py-2.5 font-medium min-w-[180px]">Sản phẩm</th>
                      <th className="px-4 py-2.5 font-medium">Size</th>
                      <th className="px-4 py-2.5 font-medium">Màu</th>
                      <th className="px-4 py-2.5 font-medium min-w-[180px]">Nhà cung cấp</th>
                      <th className="px-4 py-2.5 font-medium text-right w-24">Số lượng</th>
                      <th className="px-4 py-2.5 font-medium text-right w-32">Giá/một</th>
                      <th className="px-4 py-2.5 font-medium text-right w-32">Giá tổng</th>
                      <th className="px-2 py-2.5 font-medium text-right w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const total = lineTotal(row);
                      return (
                        <tr key={`${row.variant_id}-${idx}`} className="border-t border-neutral-100 hover:bg-neutral-50/50 transition-colors">
                          <td className="px-4 py-2 text-neutral-900 font-medium">{row.product_name}</td>
                          <td className="px-4 py-2 text-neutral-600">{row.size || "—"}</td>
                          <td className="px-4 py-2 text-neutral-600">{row.color || "—"}</td>
                          <td className="px-4 py-2">
                            {isEdit ? (
                              <span className="text-sm text-neutral-700">{editSupplierName || "—"}</span>
                            ) : (
                              <select value={row.supplierId}
                                onChange={(e) => changeRowSupplier(idx, e.target.value)}
                                className="w-full border border-neutral-200 rounded px-2 py-1.5 text-sm outline-none focus:border-neutral-400 bg-white">
                                <option value="">-- Chọn NCC --</option>
                                {row.supplierOptions.map((s) => (
                                  <option key={s.supplier_id} value={s.supplier_id}>
                                    {s.supplier_name}
                                    {s.cost_price != null ? ` (${fmt(s.cost_price)}₫)` : ""}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <input type="number" min="0" value={row.quantity}
                              onChange={(e) => updateRow(idx, "quantity", e.target.value)}
                              placeholder="SL"
                              className="w-full border border-neutral-200 rounded px-2 py-1.5 text-sm text-right outline-none focus:border-neutral-400" />
                          </td>
                          <td className="px-4 py-2">
                            <input type="number" min="0" value={row.unit_price}
                              onChange={(e) => updateRow(idx, "unit_price", e.target.value)}
                              placeholder="₫"
                              className="w-full border border-neutral-200 rounded px-2 py-1.5 text-sm text-right outline-none focus:border-neutral-400" />
                          </td>
                          <td className="px-4 py-2 text-right text-neutral-700 font-medium">
                            {total > 0 ? `${fmt(total)}₫` : "—"}
                          </td>
                          <td className="px-2 py-2 text-right">
                            <button type="button" onClick={() => removeRow(idx)}
                              className="p-1 text-neutral-300 hover:text-red-600 rounded hover:bg-red-50 transition-colors">
                              <IconTrash className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-neutral-200 bg-neutral-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-neutral-900" colSpan={4}>
                        Tổng
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-neutral-900">{fmt(totalQty)}</td>
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-neutral-900">{fmt(grandTotal)}₫</td>
                      <td className="px-2 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between bg-white border border-neutral-200 rounded-lg px-6 py-4">
          <p className="text-sm text-neutral-600">
            {!isEdit && (
              <>
                Sẽ tạo <span className="font-medium text-neutral-900">
                  {new Set(rows.filter((r) => r.supplierId).map((r) => r.supplierId)).size || 0}
                </span> đơn đặt hàng, mỗi đơn theo một nhà cung cấp
              </>
            )}
          </p>
          <div className="flex items-center gap-3">
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
        </div>
      </form>
      </>
      )}
    </div>
  );
}
