import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../../../services/api";
import { IconSpinner } from "../../../components/admin/Icons";

const STATUS = {
  DRAFT: { label: "Nháp", cls: "text-neutral-500 bg-neutral-100" },
  IN_PROGRESS: { label: "Đang kiểm", cls: "text-blue-600 bg-blue-50" },
  COMPLETED: { label: "Đã hoàn tất", cls: "text-green-600 bg-green-50" },
  CANCELLED: { label: "Đã hủy", cls: "text-red-600 bg-red-50" },
};

const formatDate = (value) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  }).format(new Date(value));
};

export default function StockCountDetail() {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState(null);

  const fetchSession = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/warehouse/counts/${id}`);
      setSession(data?.data ?? null);
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể tải đợt kiểm kê.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchSession(); }, [fetchSession]);

  const editable = session?.status === "DRAFT" || session?.status === "IN_PROGRESS";

  const setCounted = async (itemId, value) => {
    setSavingId(itemId);
    try {
      await api.put(`/warehouse/counts/${id}/items/${itemId}`, { counted_qty: Number(value) });
      const updated = session.items.map((i) => (i.id === itemId ? { ...i, counted_qty: Number(value) } : i));
      setSession((prev) => ({ ...prev, status: "IN_PROGRESS", items: updated }));
    } catch (err) {
      alert(err?.response?.data?.message || "Không thể cập nhật số đếm.");
    } finally {
      setSavingId(null);
    }
  };

  const complete = async () => {
    if (!window.confirm("Hoàn tất đợt kiểm kê? Chênh lệch sẽ sinh phiếu điều chỉnh và cập nhật tồn kho.")) return;
    setBusy(true);
    try {
      await api.post(`/warehouse/counts/${id}/complete`);
      fetchSession();
    } catch (err) {
      alert(err?.response?.data?.message || "Không thể hoàn tất kiểm kê.");
    } finally { setBusy(false); }
  };

  const cancel = async () => {
    if (!window.confirm("Hủy đợt kiểm kê này?")) return;
    setBusy(true);
    try {
      await api.post(`/warehouse/counts/${id}/cancel`);
      fetchSession();
    } catch (err) {
      alert(err?.response?.data?.message || "Không thể hủy đợt kiểm kê.");
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

  if (error || !session) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-sm text-red-600">{error || "Không tìm thấy đợt kiểm kê."}</p>
        <Link to="/admin/warehouse/counts" className="inline-block mt-4 text-sm underline underline-offset-4">
          ← Quay lại danh sách
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full">
      <Link to="/admin/warehouse/counts"
        className="inline-block mb-6 text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
        ← Quay lại kiểm kê
      </Link>

      <div className="bg-white border border-neutral-200 rounded-lg p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-medium tracking-tight font-mono">{session.count_code}</h1>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS[session.status]?.cls || ""}`}>
                {STATUS[session.status]?.label || session.status}
              </span>
            </div>
            <p className="text-sm text-neutral-500 mt-1">Kho: {session.warehouse_name}</p>
          </div>
          <div className="text-right text-sm space-y-1">
            <p className="text-neutral-600">Người tạo: <span className="font-medium">{session.created_by_name || "—"}</span></p>
            <p className="text-neutral-600">Ngày tạo: <span className="font-medium">{formatDate(session.created_at)}</span></p>
            {session.completed_at && (
              <p className="text-neutral-600">Hoàn tất: <span className="font-medium">{formatDate(session.completed_at)}</span></p>
            )}
          </div>
        </div>

        {session.status !== "CANCELLED" && editable && (
          <div className="mt-5 flex items-center gap-3">
            <button type="button" disabled={busy} onClick={complete}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 disabled:opacity-60">
              {busy && <IconSpinner />} Hoàn tất kiểm kê
            </button>
            <button type="button" disabled={busy} onClick={cancel}
              className="px-5 py-2.5 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-60">
              Hủy đợt
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
                <th className="px-4 py-3 font-medium text-right">Tồn sổ sách</th>
                <th className="px-4 py-3 font-medium text-right">Số đếm thực tế</th>
                <th className="px-4 py-3 font-medium text-right">Chênh lệch</th>
              </tr>
            </thead>
            <tbody>
              {session.items?.map((item) => (
                <tr key={item.id} className="border-t border-neutral-100 hover:bg-neutral-50/80 transition-colors">
                  <td className="px-4 py-3 font-medium text-neutral-900">{item.product_name}</td>
                  <td className="px-4 py-3 text-neutral-500 text-xs font-mono hidden sm:table-cell">{item.sku}</td>
                  <td className="px-4 py-3 text-right text-neutral-600">{item.system_qty}</td>
                  <td className="px-4 py-3 text-right">
                    {editable ? (
                      <input
                        type="number"
                        min="0"
                        defaultValue={item.counted_qty ?? ""}
                        key={item.id + (item.counted_qty ?? "")}
                        onBlur={(e) => {
                          if (e.target.value !== "" && e.target.value !== String(item.counted_qty ?? "")) {
                            setCounted(item.id, e.target.value);
                          }
                        }}
                        placeholder="—"
                        className="w-28 ml-auto text-right border border-neutral-200 rounded px-2 py-1.5 text-sm outline-none focus:border-neutral-400"
                      />
                    ) : (
                      <span className="font-medium">{item.counted_qty ?? "—"}</span>
                    )}
                    {savingId === item.id && <IconSpinner className="w-3.5 h-3.5 ml-1 inline text-neutral-400" />}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {session.status === "COMPLETED" ? (
                      <span className={item.difference > 0 ? "text-green-600 font-medium" : item.difference < 0 ? "text-red-600 font-medium" : "text-neutral-400"}>
                        {item.difference > 0 ? `+${item.difference}` : item.difference}
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {session.status === "COMPLETED" && session.adjustment_id && (
        <p className="mt-4 text-sm text-neutral-600">
          Đã sinh phiếu điều chỉnh (mã kiểm kê) — xem trong mục Điều chỉnh.
        </p>
      )}
    </div>
  );
}
