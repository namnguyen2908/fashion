export function getParentCategories(categories) {
  return categories.filter((c) => c.parent_id == null);
}

export function getChildCategories(categories, parentId) {
  if (!parentId) return [];
  return categories.filter((c) => c.parent_id === Number(parentId));
}

export function isLeafParent(categories, parentId) {
  if (!parentId) return false;
  return getChildCategories(categories, parentId).length === 0;
}

/** Khởi tạo chọn danh mục 2 bước từ category_id hiện có */
export function resolveCategorySelection(categories, categoryId) {
  if (!categoryId) return { parentId: "", categoryId: "" };
  const cat = categories.find((c) => c.id === Number(categoryId));
  if (!cat) return { parentId: "", categoryId: String(categoryId) };
  if (cat.parent_id == null) {
    const hasChildren = categories.some((c) => c.parent_id === cat.id);
    if (!hasChildren) return { parentId: String(cat.id), categoryId: String(cat.id) };
    return { parentId: String(cat.id), categoryId: "" };
  }
  return { parentId: String(cat.parent_id), categoryId: String(cat.id) };
}
