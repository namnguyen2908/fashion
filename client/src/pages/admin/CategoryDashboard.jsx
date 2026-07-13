import { useState, useEffect, useCallback, useMemo } from "react";
import api from "../../services/api";
import { IconSpinner, IconChevron, IconPencil, IconTrash } from "../../components/admin/Icons";
import ConfirmDialog from "../../components/admin/ConfirmDialog";

function buildCategoryTree(flatList) {
  const parents = flatList.filter((c) => c.parent_id == null);
  return parents.map((parent) => ({
    ...parent,
    children: flatList.filter((c) => c.parent_id === parent.id),
  }));
}

function getRootCategories(flatList, excludeId = null) {
  return flatList.filter((c) => c.parent_id == null && c.id !== excludeId);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL FORM — Thêm / Sửa danh mục
// ─────────────────────────────────────────────────────────────────────────────

function CategoryModal({
  open,
  mode,
  form,
  rootOptions,
  submitting,
  error,
  onClose,
  onChange,
  onSubmit,
}) {
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
        aria-labelledby="category-modal-title"
      >
        <h2 id="category-modal-title" className="text-lg font-medium tracking-wide text-neutral-900 mb-6">
          {mode === "create" ? "Thêm danh mục mới" : "Chỉnh sửa danh mục"}
        </h2>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label htmlFor="category-name" className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
              Tên danh mục
            </label>
            <input
              id="category-name"
              type="text"
              value={form.name}
              onChange={(e) => onChange("name", e.target.value)}
              required
              placeholder="Nhập tên danh mục..."
              className="w-full border border-neutral-200 rounded-md px-4 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="category-parent" className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
              Danh mục cha
            </label>
            <select
              id="category-parent"
              value={form.parent_id}
              onChange={(e) => onChange("parent_id", e.target.value)}
              className="w-full border border-neutral-200 rounded-md px-4 py-2.5 text-sm text-neutral-900 bg-white outline-none focus:border-neutral-400 transition-colors"
            >
              <option value="">Không chọn / Là danh mục gốc</option>
              {rootOptions.map((root) => (
                <option key={root.id} value={String(root.id)}>
                  {root.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-neutral-400">
              Chọn danh mục gốc để tạo danh mục con (tối đa 2 tầng).
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {error}
            </p>
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

// ─────────────────────────────────────────────────────────────────────────────
// TREE ROW — Một dòng danh mục (cha hoặc con)
// ─────────────────────────────────────────────────────────────────────────────

function CategoryRow({ category, depth = 0, onEdit, onDelete }) {
  const isChild = depth > 0;

  return (
    <div
      className={`group flex items-center justify-between gap-4 px-4 py-3 border-b border-neutral-100 hover:bg-neutral-50/80 transition-colors ${
        isChild ? "pl-12 sm:pl-14 bg-neutral-50/40" : ""
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className={`text-sm truncate ${isChild ? "text-neutral-600 font-light" : "text-neutral-900 font-medium"}`}>
          {category.name}
        </span>
        <span className="hidden sm:inline text-xs text-neutral-400 truncate">/{category.slug}</span>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 shrink-0">
        <button
          type="button"
          onClick={() => onEdit(category.id)}
          aria-label={`Sửa ${category.name}`}
          className="p-2 text-neutral-400 hover:text-neutral-900 rounded-md hover:bg-neutral-100 transition-colors"
        >
          <IconPencil />
        </button>
        <button
          type="button"
          onClick={() => onDelete(category)}
          aria-label={`Xóa ${category.name}`}
          className="p-2 text-neutral-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
        >
          <IconTrash />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TREE NODE — Danh mục cha + khối con có thể expand/collapse
// ─────────────────────────────────────────────────────────────────────────────

function ParentTreeNode({ node, expanded, onToggleExpand, onEdit, onDelete }) {
  const hasChildren = node.children.length > 0;

  return (
    <div className="border border-neutral-100 rounded-lg overflow-hidden bg-white mb-3 last:mb-0">
      {/* Dòng danh mục cha + nút expand Tree View */}
      <div className="group flex items-center gap-1 sm:gap-2 hover:bg-neutral-50/80 transition-colors">
        <button
          type="button"
          onClick={() => onToggleExpand(node.id)}
          disabled={!hasChildren}
          aria-expanded={hasChildren ? expanded : undefined}
          aria-label={hasChildren ? (expanded ? "Thu gọn" : "Mở rộng") : "Không có danh mục con"}
          className={`ml-1 p-2 rounded-md transition-colors shrink-0 ${
            hasChildren
              ? "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
              : "text-neutral-200 cursor-default"
          }`}
        >
          <IconChevron expanded={expanded && hasChildren} />
        </button>
        <div className="flex-1 min-w-0 border-b border-neutral-100">
          <CategoryRow category={node} depth={0} onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>

      {/* Khối con: grid-rows animate expand/collapse */}
      {hasChildren && (
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden border-t border-neutral-50">
            {node.children.map((child) => (
              <CategoryRow
                key={child.id}
                category={child}
                depth={1}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY DASHBOARD — Trang chính
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_FORM = { name: "", parent_id: "" };

export default function CategoryDashboard() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  // Tree View: Set chứa ID các danh mục cha đang được mở rộng (expanded)
  const [expandedIds, setExpandedIds] = useState(new Set());

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  const rootOptions = useMemo(
    () => getRootCategories(categories, editingId),
    [categories, editingId]
  );

  // ── Re-fetch danh sách sau mỗi thao tác CRUD thành công ──
  const fetchCategories = useCallback(async () => {
    setListError("");
    try {
      const { data } = await api.get("/categories");
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      setListError(err?.response?.data?.message || "Không thể tải danh sách danh mục.");
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchCategories().finally(() => setLoading(false));
  }, [fetchCategories]);

  const toggleExpand = (parentId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  const openCreateModal = () => {
    setModalMode("create");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = async (id) => {
    setModalMode("edit");
    setEditingId(id);
    setFormError("");
    setModalOpen(true);
    setFormLoading(true);

    try {
      const { data } = await api.get(`/categories/${id}`);
      setForm({
        name: data.name ?? "",
        parent_id: data.parent_id != null ? String(data.parent_id) : "",
      });
    } catch (err) {
      setFormError(err?.response?.data?.message || "Không thể tải chi tiết danh mục.");
      setModalOpen(false);
    } finally {
      setFormLoading(false);
    }
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    const payload = {
      name: form.name.trim(),
      parent_id: form.parent_id ? Number(form.parent_id) : null,
    };

    try {
      if (modalMode === "create") {
        await api.post("/categories/create-category", payload);
      } else {
        await api.put(`/categories/update-category/${editingId}`, payload);
      }
      closeModal();
      await fetchCategories();
    } catch (err) {
      setFormError(err?.response?.data?.message || "Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRequest = (category) => {
    const isParent = category.parent_id == null;
    const childCount = isParent
      ? categories.filter((c) => c.parent_id === category.id).length
      : 0;

    if (isParent && childCount > 0) {
      setDeleteTarget({
        category,
        blocked: true,
        message: `Danh mục "${category.name}" đang có ${childCount} danh mục con. Vui lòng xóa hoặc chuyển các danh mục con trước khi xóa danh mục cha.`,
      });
      return;
    }

    setDeleteTarget({
      category,
      blocked: false,
      message: `Bạn có chắc muốn xóa danh mục "${category.name}"? Hành động này không thể hoàn tác.`,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleteTarget.blocked) {
      setDeleteTarget(null);
      return;
    }

    setDeleteSubmitting(true);
    try {
      await api.delete(`/categories/delete-category/${deleteTarget.category.id}`);
      setDeleteTarget(null);
      await fetchCategories();
    } catch (err) {
      setDeleteTarget((prev) =>
        prev
          ? {
              ...prev,
              blocked: true,
              message: err?.response?.data?.message || "Không thể xóa danh mục.",
            }
          : null
      );
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="text-neutral-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-neutral-900">
              Quản lý danh mục
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Cấu trúc 2 tầng — Danh mục cha &amp; danh mục con
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center px-5 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 transition-colors shrink-0"
          >
            Thêm danh mục mới
          </button>
        </header>

        {listError && (
          <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">
            {listError}
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-neutral-400 gap-2">
            <IconSpinner className="w-5 h-5" />
            <span className="text-sm">Đang tải danh sách...</span>
          </div>
        ) : categoryTree.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-neutral-200 rounded-lg bg-white">
            <p className="text-sm text-neutral-500">Chưa có danh mục nào.</p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 text-sm text-neutral-900 underline underline-offset-4 hover:text-neutral-600"
            >
              Thêm danh mục đầu tiên
            </button>
          </div>
        ) : (
          <div role="tree" aria-label="Danh sách danh mục sản phẩm">
            {categoryTree.map((node) => (
              <ParentTreeNode
                key={node.id}
                node={node}
                expanded={expandedIds.has(node.id)}
                onToggleExpand={toggleExpand}
                onEdit={openEditModal}
                onDelete={handleDeleteRequest}
              />
            ))}
          </div>
        )}
      </div>

      <CategoryModal
        open={modalOpen && !formLoading}
        mode={modalMode}
        form={form}
        rootOptions={rootOptions}
        submitting={submitting}
        error={formError}
        onClose={closeModal}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
      />

      {modalOpen && formLoading && (
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
