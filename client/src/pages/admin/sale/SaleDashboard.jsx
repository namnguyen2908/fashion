import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../../services/api";
import { IconSpinner, IconEye, IconPlus } from "../../../components/admin/Icons";

const formatDate = (v) => {
  if (!v) return "—";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(v));
};

export default function SaleDashboard() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", starts_at: "", expires_at: "" });
  const [saving, setSaving] = useState(false);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/sales");
      setSales(data?.data ?? []);
    } catch (err) {
      setError(err?.response?.data?.message || "Lỗi tải danh sách sale.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.starts_at || !form.expires_at) return;
    setSaving(true);
    try {
      await api.post("/sales", {
        name: form.name,
        description: form.description || null,
        starts_at: new Date(form.starts_at).toISOString(),
        expires_at: new Date(form.expires_at).toISOString()
      });
      setShowCreate(false);
      setForm({ name: "", description: "", starts_at: "", expires_at: "" });
      fetchSales();
    } catch (err) {
      alert(err?.response?.data?.message || "Lỗi tạo sale.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (sale) => {
    try {
      await api.put(`/sales/${sale.id}`, { is_active: !sale.is_active });
      fetchSales();
    } catch { }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-medium tracking-tight">Chương trình Sale</h1>
          <p className="mt-1 text-sm text-neutral-500">{sales.length} chương trình</p>
        </div>
        <button type="button" onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 transition-colors shrink-0">
          <IconPlus className="w-4 h-4" />
          Tạo sale mới
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
          <h2 className="text-sm font-medium text-neutral-900 uppercase tracking-wider">Thông tin sale</h2>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Tên chương trình *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm outline-none focus:border-neutral-400" required />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Mô tả</label>
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm outline-none focus:border-neutral-400" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Bắt đầu *</label>
              <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm outline-none focus:border-neutral-400" required />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Kết thúc *</label>
              <input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm outline-none focus:border-neutral-400" required />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-neutral-600">Hủy</button>
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm bg-black text-white rounded-md hover:bg-neutral-800 disabled:opacity-60">
              {saving && <IconSpinner />} Tạo sale
            </button>
          </div>
        </form>
      )}

      {error && <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-neutral-400 gap-2">
          <IconSpinner className="w-5 h-5" /><span className="text-sm">Đang tải...</span>
        </div>
      ) : sales.length === 0 ? (
        <div className="border border-dashed border-neutral-200 rounded-lg bg-white p-12 text-center">
          <p className="text-sm text-neutral-500">Chưa có chương trình sale nào.</p>
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                  <th className="px-4 py-3 font-medium">Tên</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Bắt đầu</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Kết thúc</th>
                  <th className="px-4 py-3 font-medium text-right">Số SP</th>
                  <th className="px-4 py-3 font-medium text-center">Trạng thái</th>
                  <th className="px-4 py-3 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => {
                  const now = new Date();
                  const start = new Date(s.starts_at);
                  const end = new Date(s.expires_at);
                  const isActive = s.is_active && now >= start && now <= end;
                  const isScheduled = s.is_active && now < start;
                  const isExpired = now > end;
                  return (
                    <tr key={s.id} className="border-t border-neutral-100 hover:bg-neutral-50/80 transition-colors">
                      <td className="px-4 py-3 font-medium text-neutral-900">{s.name}</td>
                      <td className="px-4 py-3 text-xs text-neutral-500 hidden sm:table-cell whitespace-nowrap">{formatDate(s.starts_at)}</td>
                      <td className="px-4 py-3 text-xs text-neutral-500 hidden sm:table-cell whitespace-nowrap">{formatDate(s.expires_at)}</td>
                      <td className="px-4 py-3 text-right text-neutral-600">{s.variant_count}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          isActive ? "text-green-600 bg-green-50" : isScheduled ? "text-blue-600 bg-blue-50" : "text-neutral-400 bg-neutral-50"
                        }`}>
                          {isActive ? "Đang chạy" : isScheduled ? "Sắp diễn ra" : "Đã kết thúc"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button type="button" onClick={() => handleToggleActive(s)}
                            className={`p-1.5 text-xs rounded-md transition-colors ${
                              s.is_active ? "text-amber-600 hover:bg-amber-50" : "text-green-600 hover:bg-green-50"
                            }`}>
                            {s.is_active ? "Tắt" : "Bật"}
                          </button>
                          <Link to={`/admin/sales/${s.id}`}
                            className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-md hover:bg-neutral-100 transition-colors">
                            <IconEye />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
