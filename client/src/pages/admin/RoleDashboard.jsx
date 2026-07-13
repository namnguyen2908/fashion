import { useState, useEffect, useCallback } from "react";
import api from "../../services/api";

// ── Icons ──────────────────────────────────────────────────────────────────

function IconSpinner({ className = "w-4 h-4" }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function IconPencil({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
  );
}

function IconTrash({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  );
}

function IconShield({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  );
}

// ── Role Modal (Create / Edit) ─────────────────────────────────────────────

function RoleModal({ open, mode, form, submitting, error, onClose, onChange, onSubmit }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white shadow-2xl rounded-lg border border-neutral-100 p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className="text-lg font-medium tracking-wide text-neutral-900 mb-6">
          {mode === "create" ? "Thêm vai trò mới" : "Chỉnh sửa vai trò"}
        </h2>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
              Tên vai trò
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => onChange("name", e.target.value)}
              required
              placeholder="VD: Quản lý kho"
              className="w-full border border-neutral-200 rounded-md px-4 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
              Mô tả
            </label>
            <textarea
              value={form.description}
              onChange={(e) => onChange("description", e.target.value)}
              rows={3}
              placeholder="Mô tả ngắn về vai trò này..."
              className="w-full border border-neutral-200 rounded-md px-4 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 transition-colors resize-none"
            />
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

// ── Permission Assignment Modal ───────────────────────────────────────────

function PermissionModal({ open, role, groupedPermissions, selectedIds, submitting, onClose, onToggle, onToggleGroup, onSubmit }) {
  if (!open) return null;

  const allIds = groupedPermissions.flatMap((g) => g.permissions.map((p) => p.id));

  const totalSelected = selectedIds.length;
  const totalAll = allIds.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white shadow-2xl rounded-lg border border-neutral-100 p-6 w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div>
            <h2 className="text-lg font-medium tracking-wide text-neutral-900">
              Phân quyền — {role?.name}
            </h2>
            <p className="text-sm text-neutral-500 mt-1">
              Đã chọn {totalSelected}/{totalAll} quyền
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-4">
          {groupedPermissions.map((group) => {
            const groupIds = group.permissions.map((p) => p.id);
            const allSelected = groupIds.every((id) => selectedIds.includes(id));
            const someSelected = groupIds.some((id) => selectedIds.includes(id));

            return (
              <div key={group.group} className="border border-neutral-200 rounded-lg overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-neutral-50 border-b border-neutral-100">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => onToggleGroup(groupIds, !allSelected)}
                    className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                  />
                  <span className="text-sm font-medium text-neutral-700 uppercase tracking-wider">
                    {group.group}
                  </span>
                  <span className="text-xs text-neutral-400 ml-auto">
                    {groupIds.filter((id) => selectedIds.includes(id)).length}/{groupIds.length}
                  </span>
                </div>
                <div className={`divide-y divide-neutral-50 transition-opacity ${!someSelected ? "opacity-50" : ""}`}>
                  {group.permissions.map((perm) => (
                    <label
                      key={perm.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(perm.id)}
                        onChange={() => onToggle(perm.id)}
                        className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-neutral-900">{perm.name}</span>
                        <span className="ml-2 text-xs text-neutral-400">{perm.slug}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100 mt-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900 transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 transition-colors disabled:opacity-60 disabled:pointer-events-none"
          >
            {submitting && <IconSpinner />}
            Lưu phân quyền
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Dialog ────────────────────────────────────────────────────────

function ConfirmDialog({ open, title, message, submitting, blocked, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="bg-white shadow-2xl rounded-lg border border-neutral-100 p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        <h3 className="text-base font-medium text-neutral-900 mb-2">{title}</h3>
        <p className="text-sm text-neutral-600 leading-relaxed mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          {!blocked && (
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900 disabled:opacity-50"
            >
              Hủy
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md disabled:opacity-60 ${
              blocked
                ? "bg-neutral-900 text-white hover:bg-neutral-800"
                : "bg-black text-white hover:bg-neutral-800"
            }`}
          >
            {submitting && <IconSpinner />}
            {blocked ? "Đã hiểu" : "Xóa"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export default function RoleDashboard() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", slug: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [permModalOpen, setPermModalOpen] = useState(false);
  const [permRole, setPermRole] = useState(null);
  const [groupedPermissions, setGroupedPermissions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [permSubmitting, setPermSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchRoles = useCallback(async () => {
    setListError("");
    try {
      const { data } = await api.get("/roles");
      setRoles(Array.isArray(data) ? data : []);
    } catch (err) {
      setListError(err?.response?.data?.message || "Không thể tải danh sách vai trò.");
      setRoles([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchRoles().finally(() => setLoading(false));
  }, [fetchRoles]);

  const openCreateModal = () => {
    setModalMode("create");
    setEditingId(null);
    setForm({ name: "", slug: "", description: "" });
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (role) => {
    setModalMode("edit");
    setEditingId(role.id);
    setForm({ name: role.name, slug: role.slug, description: role.description || "" });
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
    setEditingId(null);
    setForm({ name: "", slug: "", description: "" });
    setFormError("");
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      if (modalMode === "create") {
        await api.post("/roles/create-role", form);
      } else {
        await api.put(`/roles/update-role/${editingId}`, form);
      }
      closeModal();
      await fetchRoles();
    } catch (err) {
      setFormError(err?.response?.data?.message || "Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const openPermissionModal = async (role) => {
    setPermRole(role);
    setPermSubmitting(true);

    try {
      const [groupedRes, roleRes] = await Promise.all([
        api.get("/roles/grouped"),
        api.get(`/roles/${role.id}`),
      ]);

      const grouped = Array.isArray(groupedRes.data) ? groupedRes.data : [];
      setGroupedPermissions(grouped);

      const currentPermIds = (roleRes.data?.permissions || []).map((p) => p.id);
      setSelectedIds(currentPermIds);
      setPermModalOpen(true);
    } catch (err) {
      setFormError(err?.response?.data?.message || "Không thể tải danh sách quyền.");
    } finally {
      setPermSubmitting(false);
    }
  };

  const closePermissionModal = () => {
    if (permSubmitting) return;
    setPermModalOpen(false);
    setPermRole(null);
    setSelectedIds([]);
  };

  const togglePermission = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  const toggleGroup = (groupIds, select) => {
    setSelectedIds((prev) => {
      const filtered = prev.filter((id) => !groupIds.includes(id));
      return select ? [...filtered, ...groupIds] : filtered;
    });
  };

  const savePermissions = async () => {
    setPermSubmitting(true);
    try {
      await api.post(`/roles/${permRole.id}/permissions`, { permission_ids: selectedIds });
      closePermissionModal();
      await fetchRoles();
    } catch (err) {
      setFormError(err?.response?.data?.message || "Không thể lưu phân quyền.");
    } finally {
      setPermSubmitting(false);
    }
  };

  const handleDeleteRequest = (role) => {
    if (role.is_system) {
      setDeleteTarget({
        role,
        blocked: true,
        message: `Vai trò "${role.name}" là vai trò hệ thống và không thể xóa.`,
      });
      return;
    }
    setDeleteTarget({
      role,
      blocked: false,
      message: `Bạn có chắc muốn xóa vai trò "${role.name}"? Hành động này không thể hoàn tác.`,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleteTarget.blocked) {
      setDeleteTarget(null);
      return;
    }

    setDeleteSubmitting(true);
    try {
      await api.delete(`/roles/delete-role/${deleteTarget.role.id}`);
      setDeleteTarget(null);
      await fetchRoles();
    } catch (err) {
      setDeleteTarget((prev) =>
        prev
          ? { ...prev, blocked: true, message: err?.response?.data?.message || "Không thể xóa vai trò." }
          : null
      );
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const totalPerms = groupedPermissions.reduce((sum, g) => sum + g.permissions.length, 0);

  return (
    <div className="text-neutral-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-neutral-900">
              Vai trò & Phân quyền
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Quản lý vai trò và gán quyền truy cập cho từng vai trò
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center px-5 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 transition-colors shrink-0"
          >
            Thêm vai trò mới
          </button>
        </header>

        {listError && (
          <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">
            {listError}
          </p>
        )}

        {formError && (
          <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">
            {formError}
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-neutral-400 gap-2">
            <IconSpinner className="w-5 h-5" />
            <span className="text-sm">Đang tải danh sách...</span>
          </div>
        ) : roles.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-neutral-200 rounded-lg bg-white">
            <p className="text-sm text-neutral-500">Chưa có vai trò nào.</p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 text-sm text-neutral-900 underline underline-offset-4 hover:text-neutral-600"
            >
              Thêm vai trò đầu tiên
            </button>
          </div>
        ) : (
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/80">
                    <th className="text-left px-4 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wider">Vai trò</th>
                    <th className="text-left px-4 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wider hidden sm:table-cell">Slug</th>
                    <th className="text-left px-4 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wider hidden md:table-cell">Mô tả</th>
                    <th className="text-center px-4 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wider">Quyền</th>
                    <th className="text-center px-4 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wider">Hệ thống</th>
                    <th className="text-right px-4 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {roles.map((role) => (
                    <tr key={role.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="px-4 py-3.5">
                        <span className="font-medium text-neutral-900">{role.name}</span>
                      </td>
                      <td className="px-4 py-3.5 text-neutral-500 hidden sm:table-cell">{role.slug}</td>
                      <td className="px-4 py-3.5 text-neutral-500 hidden md:table-cell max-w-[200px] truncate">
                        {role.description || "—"}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 text-sm">
                          <IconShield className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{Array.isArray(role.permissions) ? role.permissions.length : 0}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {role.is_system ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600">
                            Hệ thống
                          </span>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openPermissionModal(role)}
                            className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-md hover:bg-neutral-100 transition-colors"
                            aria-label="Phân quyền"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(role)}
                            className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-md hover:bg-neutral-100 transition-colors"
                            aria-label={`Sửa ${role.name}`}
                          >
                            <IconPencil />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRequest(role)}
                            className="p-1.5 text-neutral-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                            aria-label={`Xóa ${role.name}`}
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
          </div>
        )}
      </div>

      <RoleModal
        open={modalOpen}
        mode={modalMode}
        form={form}
        submitting={submitting}
        error={formError}
        onClose={closeModal}
        onChange={handleFormChange}
        onSubmit={handleFormSubmit}
      />

      <PermissionModal
        open={permModalOpen}
        role={permRole}
        groupedPermissions={groupedPermissions}
        selectedIds={selectedIds}
        submitting={permSubmitting}
        onClose={closePermissionModal}
        onToggle={togglePermission}
        onToggleGroup={toggleGroup}
        onSubmit={savePermissions}
      />

      {permModalOpen && permSubmitting && groupedPermissions.length === 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg px-6 py-4 flex items-center gap-3 shadow-xl">
            <IconSpinner />
            <span className="text-sm text-neutral-600">Đang tải dữ liệu...</span>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        blocked={deleteTarget?.blocked}
        title={deleteTarget?.blocked ? "Không thể xóa" : "Xác nhận xóa"}
        message={deleteTarget?.message ?? ""}
        submitting={deleteSubmitting}
        onCancel={() => !deleteSubmitting && setDeleteTarget(null)}
        onConfirm={deleteTarget?.blocked ? () => setDeleteTarget(null) : handleDeleteConfirm}
      />
    </div>
  );
}
