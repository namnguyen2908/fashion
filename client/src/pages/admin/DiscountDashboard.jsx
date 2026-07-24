import { useState, useEffect, useCallback } from "react";
import api from "../../services/api";
import { IconSpinner, IconPencil, IconTrash } from "../../components/admin/Icons";
import ConfirmDialog from "../../components/admin/ConfirmDialog";

const TRIGGER_TYPES = [
  { value: "total_spent", label: "Tổng chi tiêu" },
  { value: "order_count", label: "Số đơn hàng" },
  { value: "product_purchase", label: "Mua sản phẩm" },
  { value: "category_purchase", label: "Mua danh mục" },
];

const REWARD_TYPES = [
  { value: "percentage", label: "Phần trăm (%)" },
  { value: "fixed", label: "Số tiền cố định" },
];

const emptyForm = {
  name: "",
  description: "",
  trigger_type: "total_spent",
  trigger_value: {},
  reward_type: "percentage",
  reward_value: "",
  min_order_amount: "0",
  max_usage_per_user: "1",
  expires_at: "",
  is_active: true,
};

function getTriggerValueFromForm(triggerType, raw) {
  if (triggerType === "total_spent") return { min_total: Number(raw.min_total) || 0 };
  if (triggerType === "order_count") return { min_orders: Number(raw.min_orders) || 0 };
  if (triggerType === "product_purchase") {
    const ids = raw.product_ids ? raw.product_ids.split(",").map(s => Number(s.trim())).filter(Boolean) : [];
    return { product_ids: ids };
  }
  if (triggerType === "category_purchase") {
    const ids = raw.category_ids ? raw.category_ids.split(",").map(s => Number(s.trim())).filter(Boolean) : [];
    return { category_ids: ids };
  }
  return {};
}

function getTriggerValueDisplay(rule) {
  const v = rule.trigger_value || {};
  switch (rule.trigger_type) {
    case "total_spent": return `≥ ${v.min_total?.toLocaleString() || 0}đ`;
    case "order_count": return `≥ ${v.min_orders || 0} đơn`;
    case "product_purchase": return `SP #${(v.product_ids || []).join(", #")}`;
    case "category_purchase": return `DM #${(v.category_ids || []).join(", #")}`;
    default: return JSON.stringify(v);
  }
}

function DiscountModal({ open, mode, form, triggerForm, submitting, error, onClose, onChange, onTriggerChange, onSubmit }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white shadow-2xl rounded-lg border border-neutral-100 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className="text-lg font-medium tracking-wide text-neutral-900 mb-6">
          {mode === "create" ? "Thêm quy tắc giảm giá" : "Chỉnh sửa quy tắc"}
        </h2>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">Tên quy tắc</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => onChange("name", e.target.value)}
                required
                placeholder="VD: VIP 1 triệu"
                className="w-full border border-neutral-200 rounded-md px-4 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 transition-colors"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">Mô tả</label>
              <textarea
                value={form.description}
                onChange={(e) => onChange("description", e.target.value)}
                rows={2}
                className="w-full border border-neutral-200 rounded-md px-4 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">Điều kiện</label>
              <select
                value={form.trigger_type}
                onChange={(e) => onChange("trigger_type", e.target.value)}
                className="w-full border border-neutral-200 rounded-md px-4 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 transition-colors"
              >
                {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">Loại giảm giá</label>
              <select
                value={form.reward_type}
                onChange={(e) => onChange("reward_type", e.target.value)}
                className="w-full border border-neutral-200 rounded-md px-4 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 transition-colors"
              >
                {REWARD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {form.trigger_type === "total_spent" && (
              <div>
                <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">Chi tiêu tối thiểu (VNĐ)</label>
                <input
                  type="number"
                  value={triggerForm.min_total || ""}
                  onChange={(e) => onTriggerChange("min_total", e.target.value)}
                  className="w-full border border-neutral-200 rounded-md px-4 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 transition-colors"
                />
              </div>
            )}

            {form.trigger_type === "order_count" && (
              <div>
                <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">Số đơn tối thiểu</label>
                <input
                  type="number"
                  value={triggerForm.min_orders || ""}
                  onChange={(e) => onTriggerChange("min_orders", e.target.value)}
                  className="w-full border border-neutral-200 rounded-md px-4 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 transition-colors"
                />
              </div>
            )}

            {form.trigger_type === "product_purchase" && (
              <div className="col-span-2">
                <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">ID sản phẩm (cách nhau bằng dấu phẩy)</label>
                <input
                  type="text"
                  value={triggerForm.product_ids || ""}
                  onChange={(e) => onTriggerChange("product_ids", e.target.value)}
                  placeholder="VD: 5, 12, 20"
                  className="w-full border border-neutral-200 rounded-md px-4 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 transition-colors"
                />
              </div>
            )}

            {form.trigger_type === "category_purchase" && (
              <div className="col-span-2">
                <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">ID danh mục (cách nhau bằng dấu phẩy)</label>
                <input
                  type="text"
                  value={triggerForm.category_ids || ""}
                  onChange={(e) => onTriggerChange("category_ids", e.target.value)}
                  placeholder="VD: 1, 2"
                  className="w-full border border-neutral-200 rounded-md px-4 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">Giá trị giảm</label>
              <input
                type="number"
                value={form.reward_value}
                onChange={(e) => onChange("reward_value", e.target.value)}
                required
                className="w-full border border-neutral-200 rounded-md px-4 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">Đơn tối thiểu (VNĐ)</label>
              <input
                type="number"
                value={form.min_order_amount}
                onChange={(e) => onChange("min_order_amount", e.target.value)}
                className="w-full border border-neutral-200 rounded-md px-4 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">Dùng tối đa / user</label>
              <input
                type="number"
                value={form.max_usage_per_user}
                onChange={(e) => onChange("max_usage_per_user", e.target.value)}
                className="w-full border border-neutral-200 rounded-md px-4 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">Hết hạn</label>
              <input
                type="date"
                value={form.expires_at ? form.expires_at.slice(0, 10) : ""}
                onChange={(e) => onChange("expires_at", e.target.value ? `${e.target.value}T23:59:59` : "")}
                className="w-full border border-neutral-200 rounded-md px-4 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 transition-colors"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900 transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 transition-colors disabled:opacity-60 disabled:pointer-events-none"
            >
              {submitting && <IconSpinner />}
              {mode === "create" ? "Thêm mới" : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DiscountDashboard() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState({ open: false, mode: "create" });
  const [form, setForm] = useState({ ...emptyForm });
  const [triggerForm, setTriggerForm] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchRules = useCallback(async () => {
    try {
      const { data } = await api.get("/discounts");
      if (data.success) setRules(data.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const openCreate = () => {
    setForm({ ...emptyForm });
    setTriggerForm({});
    setModal({ open: true, mode: "create" });
    setError("");
  };

  const openEdit = (rule) => {
    const tf = {};
    const v = rule.trigger_value || {};
    if (rule.trigger_type === "total_spent") tf.min_total = v.min_total || "";
    if (rule.trigger_type === "order_count") tf.min_orders = v.min_orders || "";
    if (rule.trigger_type === "product_purchase") tf.product_ids = (v.product_ids || []).join(", ");
    if (rule.trigger_type === "category_purchase") tf.category_ids = (v.category_ids || []).join(", ");

    setForm({
      name: rule.name,
      description: rule.description || "",
      trigger_type: rule.trigger_type,
      reward_type: rule.reward_type,
      reward_value: String(rule.reward_value),
      min_order_amount: String(rule.min_order_amount),
      max_usage_per_user: String(rule.max_usage_per_user),
      expires_at: rule.expires_at || "",
      is_active: rule.is_active,
    });
    setTriggerForm(tf);
    setModal({ open: true, mode: "edit", ruleId: rule.id });
    setError("");
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleTriggerChange = (field, value) => {
    setTriggerForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const trigger_value = getTriggerValueFromForm(form.trigger_type, triggerForm);

    const body = {
      ...form,
      trigger_value,
      reward_value: Number(form.reward_value),
      min_order_amount: Number(form.min_order_amount),
      max_usage_per_user: Number(form.max_usage_per_user),
      expires_at: form.expires_at || null,
    };

    try {
      const { data } = modal.mode === "create"
        ? await api.post("/discounts", body)
        : await api.put(`/discounts/${modal.ruleId}`, body);

      if (data.success) {
        setModal({ open: false });
        fetchRules();
      } else {
        setError(data.message || "Lỗi không xác định");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Không thể lưu quy tắc");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      const { data } = await api.delete(`/discounts/${confirmDelete}`);
      if (data.success) {
        setConfirmDelete(null);
        fetchRules();
      }
    } catch { /* ignore */ }
  };

  const formatCurrency = (val) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(val));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <IconSpinner className="w-6 h-6" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-neutral-900">Quy tắc giảm giá</h1>
          <p className="text-sm text-neutral-500 mt-1">Tự động phát discount dựa trên hành vi mua hàng</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 transition-colors"
        >
          + Thêm quy tắc
        </button>
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-neutral-500 font-medium">Tên</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-neutral-500 font-medium">Điều kiện</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-neutral-500 font-medium">Giảm giá</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-neutral-500 font-medium">Đơn tối thiểu</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-neutral-500 font-medium">Dùng / user</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-neutral-500 font-medium">Trạng thái</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-neutral-500 font-medium">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rules.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-neutral-400">
                  Chưa có quy tắc giảm giá nào
                </td>
              </tr>
            )}
            {rules.map((rule) => (
              <tr key={rule.id} className="hover:bg-neutral-50 transition-colors">
                <td className="px-4 py-3.5">
                  <p className="font-medium text-neutral-900">{rule.name}</p>
                  {rule.description && <p className="text-xs text-neutral-500 mt-0.5">{rule.description}</p>}
                </td>
                <td className="px-4 py-3.5 text-neutral-600">{getTriggerValueDisplay(rule)}</td>
                <td className="px-4 py-3.5 text-neutral-900 font-medium">
                  {rule.reward_type === "percentage" ? `${rule.reward_value}%` : formatCurrency(rule.reward_value)}
                </td>
                <td className="px-4 py-3.5 text-neutral-600">
                  {Number(rule.min_order_amount) > 0 ? formatCurrency(rule.min_order_amount) : "—"}
                </td>
                <td className="px-4 py-3.5 text-neutral-600">{rule.max_usage_per_user}</td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${rule.is_active ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"}`}>
                    {rule.is_active ? "Đang chạy" : "Tắt"}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEdit(rule)}
                      className="p-2 text-neutral-400 hover:text-neutral-900 transition-colors rounded-md hover:bg-neutral-100"
                      title="Sửa"
                    >
                      <IconPencil />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(rule.id)}
                      className="p-2 text-neutral-400 hover:text-red-600 transition-colors rounded-md hover:bg-red-50"
                      title="Xóa"
                    >
                      <IconTrash />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit/Create Modal */}
      <DiscountModal
        open={modal.open}
        mode={modal.mode}
        form={form}
        triggerForm={triggerForm}
        submitting={submitting}
        error={error}
        onClose={() => setModal({ open: false })}
        onChange={handleChange}
        onTriggerChange={handleTriggerChange}
        onSubmit={handleSubmit}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Xóa quy tắc"
        message="Bạn có chắc muốn xóa quy tắc giảm giá này? Các discount đã phát cho user vẫn còn hiệu lực."
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
