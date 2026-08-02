import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../../../services/api";
import { IconSpinner } from "../../../components/admin/Icons";

const STATUS = {
  DRAFT: { label: "Nháp", cls: "text-amber-600 bg-amber-50" },
  COMPLETED: { label: "Đã ghi sổ", cls: "text-green-600 bg-green-50" },
  CANCELLED: { label: "Đã hủy", cls: "text-red-600 bg-red-50" },
};

const formatDate = (value) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  }).format(new Date(value));
};

export default function ReceiptDetail() {
  const { id } = useParams();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchReceipt = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/goods-receipts/${id}`);
      setReceipt(data?.data ?? null);
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể tải thông tin phiếu nhập.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReceipt(); }, [id]);

  const complete = async () => {
    if (!window.confirm("Ghi sổ phiếu nhập? Tồn kho và giá vốn sẽ được cập nhật.")) return;
    setBusy(true);
    try {
      await api.post(`/goods-receipts/${id}/complete`);
      fetchReceipt();
    } catch (err) {
      alert(err?.response?.data?.message || "Không thể ghi sổ phiếu nhập.");
    } finally { setBusy(false); }
  };

  const cancel = async () => {
    const msg = receipt.status === "DRAFT"
      ? "Hủy phiếu nhập này?"
      : "Hủy phiếu nhập? Tồn kho sẽ được đảo ngược (chỉ khi chưa có giao dịch sau).";
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await api.post(`/goods-receipts/${id}/cancel`);
      fetchReceipt();
    } catch (err) {
      alert(err?.response?.data?.message || "Không thể hủy phiếu nhập.");
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

  if (error || !receipt) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-sm text-red-600">{error || "Không tìm thấy phiếu nhập."}</p>
        <Link to="/admin/warehouse/receipts" className="inline-block mt-4 text-sm underline underline-offset-4">
          ← Quay lại danh sách
        </Link>
      </div>
    );
  }

  const totalQty = receipt.items?.reduce((s, i) => s + Number(i.quantity), 0) || 0;
  const totalCost = receipt.items?.reduce((s, i) => s + (Number(i.quantity) * Number(i.unit_cost || 0)), 0) || 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full">
      <Link to="/admin/warehouse/receipts"
        className="inline-block mb-6 text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
        ← Quay lại phiếu nhập
      </Link>

      <div className="bg-white border border-neutral-200 rounded-lg p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-medium tracking-tight font-mono">{receipt.receipt_code}</h1>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS[receipt.status]?.cls || ""}`}>
                {STATUS[receipt.status]?.label || receipt.status}
              </span>
            </div>
            <p className="text-sm text-neutral-500 mt-1">
              Tạo bởi {receipt.created_by_name || "—"} • {formatDate(receipt.receipt_date)}
            </p>
          </div>
          <div className="text-right text-sm space-y-1">
            <p className="text-neutral-600">Kho: <span className="font-medium">{receipt.warehouse_name || "—"}</span></p>
            <p className="text-neutral-600">Nhà cung cấp: <span className="font-medium">{receipt.supplier_name || "—"}</span></p>
            {receipt.po_code && (
              <p className="text-neutral-600">Đơn đặt hàng: <span className="font-medium font-mono">{receipt.po_code}</span></p>
            )}
            <p className="text-neutral-600">Tổng số lượng: <span className="font-medium">{totalQty}</span></p>
            {totalCost > 0 && (
              <p className="text-neutral-600">Tổng giá trị: <span className="font-medium">{totalCost.toLocaleString("vi-VN")}₫</span></p>
            )}
          </div>
        </div>
        {receipt.notes && (
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <p className="text-sm text-neutral-600">Ghi chú: {receipt.notes}</p>
          </div>
        )}

        {receipt.status !== "CANCELLED" && (
          <div className="mt-5 flex items-center gap-3">
            {receipt.status === "DRAFT" && (
              <button type="button" disabled={busy} onClick={complete}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 disabled:opacity-60">
                {busy && <IconSpinner />} Ghi sổ phiếu nhập
              </button>
            )}
            <button type="button" disabled={busy} onClick={cancel}
              className="px-5 py-2.5 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-60">
              Hủy phiếu
            </button>
          </div>
        )}
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                <th className="px-4 py-3 font-medium">Sản phẩm</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">SKU</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Màu / Size</th>
                <th className="px-4 py-3 font-medium text-right">Số lượng</th>
                <th className="px-4 py-3 font-medium text-right hidden md:table-cell">Giá nhập</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items?.map((item) => (
                <tr key={item.id} className="border-t border-neutral-100 hover:bg-neutral-50/80 transition-colors">
                  <td className="px-4 py-3 font-medium text-neutral-900">{item.product_name}</td>
                  <td className="px-4 py-3 text-neutral-500 text-xs font-mono hidden sm:table-cell">{item.sku}</td>
                  <td className="px-4 py-3 text-neutral-600 hidden md:table-cell">
                    {[item.color, item.size].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-neutral-600 hidden md:table-cell">
                    {item.unit_cost ? `${Number(item.unit_cost).toLocaleString("vi-VN")}₫` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
