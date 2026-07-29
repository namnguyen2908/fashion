import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../../../services/api";
import { IconSpinner, IconPencil, IconSearch, IconEye } from "../../../components/admin/Icons";

const emptyForm = { name: "", code: "", contact_name: "", phone: "", email: "", address: "" };

export default function SupplierList() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef(null);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      const { data } = await api.get("/warehouse/suppliers", { params });
      setSuppliers(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể tải danh sách nhà cung cấp.");
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (s) => {
    setForm({ name: s.name, code: s.code || "", contact_name: s.contact_name || "", phone: s.phone || "", email: s.email || "", address: s.address || "" });
    setEditingId(s.id);
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/warehouse/suppliers/${editingId}`, form);
      } else {
        await api.post("/warehouse/suppliers", form);
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      fetchSuppliers();
    } catch (err) {
      alert(err?.response?.data?.message || "Lỗi khi lưu nhà cung cấp.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-medium tracking-tight">Nhà cung cấp</h1>
          <p className="mt-1 text-sm text-neutral-500">{suppliers.length} nhà cung cấp</p>
        </div>
        <button type="button" onClick={openCreate}
          className="inline-flex justify-center px-5 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 transition-colors shrink-0">
          Thêm nhà cung cấp
        </button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none z-10" />
          <input type="text" value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              clearTimeout(debounceRef.current);
              debounceRef.current = setTimeout(() => { setSearch(e.target.value); }, 500);
            }}
            placeholder="Tìm theo tên, mã hoặc người liên hệ..."
            className="w-full border border-neutral-200 rounded-md pl-10 pr-4 py-2 text-sm outline-none focus:border-neutral-400 transition-colors"
          />
        </div>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">{error}</p>
      )}

      {showForm && (
        <div className="mb-6 bg-white border border-neutral-200 rounded-lg p-6">
          <h2 className="text-sm font-medium text-neutral-900 uppercase tracking-wider mb-4">
            {editingId ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp"}
          </h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs text-neutral-500 mb-1">Tên nhà cung cấp *</label>
              <input type="text" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm outline-none focus:border-neutral-400" required />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Mã nhà cung cấp</label>
              <input type="text" value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm outline-none focus:border-neutral-400" />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Người liên hệ</label>
              <input type="text" value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm outline-none focus:border-neutral-400" />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Số điện thoại</label>
              <input type="text" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm outline-none focus:border-neutral-400" />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Email</label>
              <input type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm outline-none focus:border-neutral-400" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-neutral-500 mb-1">Địa chỉ</label>
              <input type="text" value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm outline-none focus:border-neutral-400" />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
                className="px-4 py-2 text-sm text-neutral-600">Hủy</button>
              <button type="submit" disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm bg-black text-white rounded-md hover:bg-neutral-800 disabled:opacity-60">
                {saving && <IconSpinner />}
                {editingId ? "Cập nhật" : "Thêm mới"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-neutral-400 gap-2">
          <IconSpinner className="w-5 h-5" />
          <span className="text-sm">Đang tải...</span>
        </div>
      ) : suppliers.length === 0 ? (
        <div className="border border-dashed border-neutral-200 rounded-lg bg-white p-12 text-center">
          <p className="text-sm text-neutral-500">Chưa có nhà cung cấp nào.</p>
          <button type="button" onClick={openCreate}
            className="inline-block mt-4 text-sm underline underline-offset-4 hover:text-neutral-600">
            Thêm nhà cung cấp đầu tiên
          </button>
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                  <th className="px-4 py-3 font-medium">Mã</th>
                  <th className="px-4 py-3 font-medium">Tên nhà cung cấp</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Người liên hệ</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Số điện thoại</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Email</th>
                  <th className="px-4 py-3 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id} className="border-t border-neutral-100 hover:bg-neutral-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-neutral-500">{s.code || "—"}</td>
                    <td className="px-4 py-3 font-medium">
                      <Link to={`/admin/warehouse/suppliers/${s.id}`} className="text-neutral-900 hover:underline underline-offset-2">{s.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-600 hidden sm:table-cell">{s.contact_name || "—"}</td>
                    <td className="px-4 py-3 text-neutral-600 hidden md:table-cell">{s.phone || "—"}</td>
                    <td className="px-4 py-3 text-neutral-600 hidden lg:table-cell">{s.email || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/admin/warehouse/suppliers/${s.id}`}
                          className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-md hover:bg-neutral-100 transition-colors"
                          aria-label="Chi tiết">
                          <IconEye />
                        </Link>
                        <button type="button" onClick={() => openEdit(s)}
                          className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-md hover:bg-neutral-100 transition-colors">
                          <IconPencil />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
