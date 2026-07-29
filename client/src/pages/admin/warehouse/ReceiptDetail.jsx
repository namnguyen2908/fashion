import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../../../services/api";
import { IconSpinner } from "../../../components/admin/Icons";

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

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/warehouse/receipts/${id}`);
        setReceipt(data?.data ?? null);
      } catch (err) {
        setError(err?.response?.data?.message || "Không thể tải thông tin phiếu nhập.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 flex items-center justify-center text-neutral-400 gap-2">
        <IconSpinner className="w-5 h-5" />
        <span className="text-sm">Đang tải...</span>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full">
      <Link to="/admin/warehouse/receipts"
        className="inline-block mb-6 text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
        ← Quay lại phiếu nhập
      </Link>

      <div className="bg-white border border-neutral-200 rounded-lg p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-medium tracking-tight">{receipt.receipt_code}</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Tạo bởi {receipt.created_by_name || "—"} • {formatDate(receipt.receipt_date)}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="text-neutral-600">Nhà cung cấp: <span className="font-medium">{receipt.supplier || "—"}</span></p>
            <p className="text-neutral-600 mt-1">Số mặt hàng: <span className="font-medium">{receipt.items?.length || 0}</span></p>
            <p className="text-neutral-600 mt-1">Tổng số lượng: <span className="font-medium">{totalQty}</span></p>
            {totalCost > 0 && (
              <p className="text-neutral-600 mt-1">Tổng giá trị: <span className="font-medium">{totalCost.toLocaleString("vi-VN")}₫</span></p>
            )}
          </div>
        </div>
        {receipt.notes && (
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <p className="text-sm text-neutral-600">Ghi chú: {receipt.notes}</p>
          </div>
        )}
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                <th className="px-4 py-3 font-medium">Sản phẩm</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Màu</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Size</th>
                <th className="px-4 py-3 font-medium text-right">Số lượng</th>
                <th className="px-4 py-3 font-medium text-right hidden md:table-cell">Giá nhập</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items?.map((item) => (
                <tr key={item.id} className="border-t border-neutral-100 hover:bg-neutral-50/80 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-neutral-900">{item.product_name}</span>
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-xs font-mono">{item.sku}</td>
                  <td className="px-4 py-3 text-neutral-600 hidden sm:table-cell">{item.color || "—"}</td>
                  <td className="px-4 py-3 text-neutral-600 hidden sm:table-cell">{item.size || "—"}</td>
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
