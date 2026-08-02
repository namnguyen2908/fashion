import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../../../services/api";
import { IconSpinner } from "../../../components/admin/Icons";

const STATUS = {
  DRAFT: { label: "Nháp", cls: "text-neutral-500 bg-neutral-100" },
  CONFIRMED: { label: "Đã xác nhận", cls: "text-blue-600 bg-blue-50" },
  RECEIVED: { label: "Đã nhận đủ", cls: "text-green-600 bg-green-50" },
  CANCELLED: { label: "Đã hủy", cls: "text-red-600 bg-red-50" },
};

const formatDate = (value) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  }).format(new Date(value));
};

const formatMoney = (value) => (value ? `${Number(value).toLocaleString("vi-VN")}₫` : "—");

export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchPO = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/purchase-orders/${id}`);
      setPo(data?.data ?? null);
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể tải đơn đặt hàng.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPO(); }, [id]);

  const confirmPO = async () => {
    if (!window.confirm("Xác nhận đơn đặt hàng này?")) return;
    setBusy(true);
    try {
      await api.post(`/purchase-orders/${id}/confirm`);
      fetchPO();
    } catch (err) {
      alert(err?.response?.data?.message || "Không thể xác nhận đơn.");
    } finally { setBusy(false); }
  };

  const cancelPO = async () => {
    if (!window.confirm("Hủy đơn đặt hàng này?")) return;
    setBusy(true);
    try {
      await api.post(`/purchase-orders/${id}/cancel`);
      fetchPO();
    } catch (err) {
      alert(err?.response?.data?.message || "Không thể hủy đơn.");
    } finally { setBusy(false); }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 flex items-center justify-center text-neutral-400 gap-2">
        <IconSpinner className="w-5 h-5" />
        <span className="text-sm">Đang tải...</span>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-sm text-red-600">{error || "Không tìm thấy đơn."}</p>
        <Link to="/admin/warehouse/purchase-orders" className="inline-block mt-4 text-sm underline underline-offset-4">
          ← Quay lại danh sách
        </Link>
      </div>
    );
  }

  const totalQty = po.items?.reduce((s, i) => s + Number(i.quantity), 0) || 0;
  const totalReceived = po.items?.reduce((s, i) => s + Number(i.received_qty), 0) || 0;
  const totalValue = po.items?.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0) || 0;
  const canReceive = po.status === "CONFIRMED";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full">
      <Link to="/admin/warehouse/purchase-orders"
        className="inline-block mb-6 text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
        ← Quay lại đơn đặt hàng
      </Link>

      <div className="bg-white border border-neutral-200 rounded-lg p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-medium tracking-tight font-mono">{po.po_code}</h1>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS[po.status]?.cls || ""}`}>
                {STATUS[po.status]?.label || po.status}
              </span>
            </div>
            <p className="text-sm text-neutral-500 mt-1">
              Nhà cung cấp: <span className="text-neutral-700">{po.supplier_name} {po.supplier_code ? `(${po.supplier_code})` : ""}</span>
            </p>
          </div>
          <div className="text-right text-sm space-y-1">
            <p className="text-neutral-600">Kho nhận: <span className="font-medium">{po.warehouse_name}</span></p>
            <p className="text-neutral-600">Ngày dự kiến: <span className="font-medium">{po.expected_date ? formatDate(po.expected_date) : "—"}</span></p>
            <p className="text-neutral-600">Người tạo: <span className="font-medium">{po.created_by_name || "—"}</span></p>
            <p className="text-neutral-600">Ngày tạo: <span className="font-medium">{formatDate(po.created_at)}</span></p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-neutral-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-neutral-500">Số sản phẩm</p>
            <p className="text-sm font-medium">{po.items?.length || 0}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Tổng số lượng</p>
            <p className="text-sm font-medium">{totalQty}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Đã nhận</p>
            <p className="text-sm font-medium">{totalReceived} / {totalQty}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Tổng giá trị</p>
            <p className="text-sm font-medium">{formatMoney(totalValue)}</p>
          </div>
        </div>

        {po.notes && (
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <p className="text-sm text-neutral-600">Ghi chú: {po.notes}</p>
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          {po.status === "DRAFT" && (
            <>
              <Link to={`/admin/warehouse/purchase-orders/${po.id}/edit`}
                className="px-5 py-2.5 text-sm border border-neutral-300 rounded-md hover:bg-neutral-50">
                Sửa
              </Link>
              <button type="button" disabled={busy} onClick={confirmPO}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 disabled:opacity-60">
                {busy && <IconSpinner />} Xác nhận đơn
              </button>
            </>
          )}
          {(po.status === "DRAFT" || po.status === "CONFIRMED") && (
            <button type="button" disabled={busy} onClick={cancelPO}
              className="px-5 py-2.5 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-60">
              Hủy đơn
            </button>
          )}
          {canReceive && (
            <Link to={`/admin/warehouse/receipts/create?po_id=${po.id}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm bg-green-700 text-white rounded-md hover:bg-green-800">
              Tạo phiếu nhập
            </Link>
          )}
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                <th className="px-4 py-3 font-medium">Sản phẩm</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">SKU</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Màu / Size</th>
                <th className="px-4 py-3 font-medium text-right">Đặt</th>
                <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">Đã nhận</th>
                <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">Còn thiếu</th>
                <th className="px-4 py-3 font-medium text-right">Giá</th>
              </tr>
            </thead>
            <tbody>
              {po.items?.map((item) => (
                <tr key={item.id} className="border-t border-neutral-100 hover:bg-neutral-50/80 transition-colors">
                  <td className="px-4 py-3 font-medium text-neutral-900">{item.product_name}</td>
                  <td className="px-4 py-3 text-neutral-500 text-xs font-mono hidden sm:table-cell">{item.sku}</td>
                  <td className="px-4 py-3 text-neutral-600 hidden md:table-cell">
                    {[item.color, item.size].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-neutral-600 hidden sm:table-cell">{item.received_qty}</td>
                  <td className="px-4 py-3 text-right text-neutral-600 hidden sm:table-cell">{item.remaining}</td>
                  <td className="px-4 py-3 text-right text-neutral-600">{formatMoney(item.unit_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
