import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";
import { IconSpinner } from "../../components/admin/Icons";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import ColorSelect from "../../components/admin/ColorSelect";
import { normalizeColorName } from "../../constants/colors";
import {
  getUniqueColorsFromVariants,
} from "../../utils/productImages";
import {
  getParentCategories,
  getChildCategories,
  isLeafParent,
  resolveCategorySelection,
} from "../../utils/adminCategories";

const formatDate = (v) =>
  v ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v)) : "—";

const TABS = [
  { id: "info", label: "Thông tin" },
  { id: "variants", label: "Biến thể" },
  { id: "images", label: "Hình ảnh" },
];

const inputClass =
  "w-full border border-neutral-200 rounded-md px-3 py-2 text-sm outline-none focus:border-neutral-400";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [tab, setTab] = useState("info");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [product, setProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [variants, setVariants] = useState([]);
  const [images, setImages] = useState([]);

  const [infoForm, setInfoForm] = useState({ name: "", category_id: "", description: "" });
  const [selectedParentId, setSelectedParentId] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);

  const [variantEdits, setVariantEdits] = useState({});
  const [savingVariantId, setSavingVariantId] = useState(null);
  const [savingAll, setSavingAll] = useState(false);
  const [newVariant, setNewVariant] = useState({ color: "", size: "", price: "" });
  const [addingVariant, setAddingVariant] = useState(false);

  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageUploadColor, setImageUploadColor] = useState("");

  const [confirm, setConfirm] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const parentCategories = useMemo(() => getParentCategories(categories), [categories]);
  const childCategories = useMemo(() => getChildCategories(categories, selectedParentId), [categories, selectedParentId]);
  const parentIsLeaf = useMemo(() => isLeafParent(categories, selectedParentId), [categories, selectedParentId]);

  const productColors = useMemo(
    () => getUniqueColorsFromVariants(variants),
    [variants]
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [productRes, categoriesRes, variantsRes, imagesRes] = await Promise.all([
        api.get(`/products/${id}`),
        api.get("/categories"),
        api.get(`/product-variants/products/${id}/variants`),
        api.get(`/product-images/${id}`),
      ]);

      const p = productRes.data?.data;
      const cats = Array.isArray(categoriesRes.data) ? categoriesRes.data : [];
      const vars = variantsRes.data?.data ?? [];
      const imgs = imagesRes.data?.data ?? [];

      setProduct(p);
      setCategories(cats);
      setVariants(vars);
      setImages(imgs);

      const sel = resolveCategorySelection(cats, p?.category_id);
      setSelectedParentId(sel.parentId);
      setInfoForm({
        name: p?.name ?? "",
        category_id: sel.categoryId,
        description: p?.description ?? "",
      });

      const edits = {};
      vars.forEach((v) => {
        edits[v.id] = {
          color: normalizeColorName(v.color ?? ""),
          size: v.size ?? "",
          price: v.price != null ? String(v.price) : "",
        };
      });
      setVariantEdits(edits);
      const colors = getUniqueColorsFromVariants(vars);
      if (colors.length) {
        setImageUploadColor((prev) => prev || colors[0]);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể tải sản phẩm.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleParentChange = (parentId) => {
    setSelectedParentId(parentId);
    if (!parentId) {
      setInfoForm((f) => ({ ...f, category_id: "" }));
      return;
    }
    if (isLeafParent(categories, parentId)) {
      setInfoForm((f) => ({ ...f, category_id: parentId }));
    } else {
      setInfoForm((f) => ({ ...f, category_id: "" }));
    }
  };

  const saveInfo = async (e) => {
    e.preventDefault();
    if (!infoForm.category_id) {
      setError("Vui lòng chọn đầy đủ danh mục.");
      return;
    }
    setSavingInfo(true);
    setError("");
    try {
      await api.put(`/products/update-product/${id}`, {
        name: infoForm.name.trim(),
        category_id: Number(infoForm.category_id),
        description: infoForm.description.trim() || null,
      });
      setMessage("Đã cập nhật thông tin sản phẩm.");
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể cập nhật.");
    } finally {
      setSavingInfo(false);
    }
  };

  const updateVariantEdit = (variantId, field, value) => {
    setVariantEdits((prev) => ({
      ...prev,
      [variantId]: { ...prev[variantId], [field]: value },
    }));
  };

  const saveVariant = async (variantId) => {
    const row = variantEdits[variantId];
    setSavingVariantId(variantId);
    setError("");
    try {
      await api.patch(`/product-variants/update-variant/${variantId}`, {
        color: row.color,
        size: row.size,
        price: row.price ? Number(row.price) : null,
      });
      setMessage("Đã cập nhật biến thể.");
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể cập nhật biến thể.");
    } finally {
      setSavingVariantId(null);
    }
  };

  const saveAllVariants = async () => {
    setSavingAll(true);
    setError("");
    try {
      const ids = Object.keys(variantEdits);
      await Promise.all(ids.map((variantId) => {
        const row = variantEdits[variantId];
        return api.patch(`/product-variants/update-variant/${variantId}`, {
          color: row.color,
          size: row.size,
          price: row.price ? Number(row.price) : null,
        });
      }));
      setMessage("Đã cập nhật tất cả biến thể.");
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.message || "Lỗi khi lưu biến thể.");
    } finally {
      setSavingAll(false);
    }
  };

  const addVariant = async (e) => {
    e.preventDefault();
    if (!newVariant.color) {
      setError("Vui lòng chọn màu cho biến thể mới.");
      return;
    }
    setAddingVariant(true);
    setError("");
    try {
      await api.post("/product-variants/create-variant", {
        product_id: Number(id),
        color: newVariant.color,
        size: newVariant.size,
        price: newVariant.price ? Number(newVariant.price) : null,
      });
      setNewVariant({ color: "", size: "", price: "" });
      setMessage("Đã thêm biến thể mới.");
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể thêm biến thể.");
    } finally {
      setAddingVariant(false);
    }
  };

  const handleDeleteVariant = async (variantId) => {
    setConfirmLoading(true);
    try {
      await api.delete(`/product-variants/delete-variant/${variantId}`);
      setConfirm(null);
      setMessage("Đã xóa biến thể.");
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể xóa biến thể.");
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleUploadImages = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingImages(true);
    setError("");
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("images", file);
        fd.append("product_id", id);
        if (imageUploadColor) fd.append("color", imageUploadColor);
        fd.append("is_thumbnail", images.length === 0 ? "true" : "false");
        await api.post("/product-images/create-product-images", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      setMessage("Đã tải ảnh lên.");
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể tải ảnh.");
    } finally {
      setUploadingImages(false);
      e.target.value = "";
    }
  };

  const setThumbnail = async (imageId) => {
    setError("");
    try {
      await api.patch(`/product-images/${imageId}/thumbnail`);
      setMessage("Đã đặt ảnh đại diện.");
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể đặt thumbnail.");
    }
  };

  const handleDeleteImage = async (imageId) => {
    setConfirmLoading(true);
    try {
      await api.delete(`/product-images/${imageId}`);
      setConfirm(null);
      setMessage("Đã xóa ảnh.");
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể xóa ảnh.");
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleDeleteProduct = async () => {
    setConfirmLoading(true);
    try {
      await api.delete(`/products/delete-product/${id}`);
      navigate("/admin/products", { state: { message: "Đã xóa sản phẩm." } });
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể xóa sản phẩm.");
      setConfirm(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-neutral-400 gap-2">
        <IconSpinner className="w-5 h-5" />
        <span className="text-sm">Đang tải sản phẩm...</span>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-neutral-500 mb-4">{error || "Không tìm thấy sản phẩm."}</p>
        <Link to="/admin/products" className="text-sm underline">← Quay lại danh sách</Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full">
      <div className="mb-6">
        <Link to="/admin/products" className="text-xs uppercase tracking-wider text-neutral-500 hover:text-neutral-800">
          ← Danh sách sản phẩm
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mt-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-medium tracking-tight">{product.name}</h1>
            <p className="mt-1 text-sm text-neutral-500">
              ID {product.id} · {product.category_name} · {formatDate(product.created_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setConfirm({
                type: "product",
                title: "Xóa sản phẩm",
                message: `Xóa "${product.name}" và toàn bộ dữ liệu liên quan? Không thể hoàn tác.`,
              })
            }
            className="text-sm text-red-600 border border-red-200 px-4 py-2 rounded-md hover:bg-red-50 shrink-0"
          >
            Xóa sản phẩm
          </button>
        </div>
      </div>

      {message && (
        <p className="mb-4 text-sm text-green-800 bg-green-50 border border-green-100 rounded-md px-4 py-3">{message}</p>
      )}
      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">{error}</p>
      )}

      <nav className="flex gap-1 border-b border-neutral-200 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); setMessage(""); setError(""); }}
            className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-neutral-900 text-neutral-900 font-medium"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {t.label}
            {t.id === "variants" && ` (${variants.length})`}
            {t.id === "images" && ` (${images.length})`}
          </button>
        ))}
      </nav>

      {tab === "info" && (
        <form onSubmit={saveInfo} className="bg-white border border-neutral-200 rounded-lg p-6 space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">Tên sản phẩm</label>
            <input required value={infoForm.name} onChange={(e) => setInfoForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">Danh mục cha</label>
              <select required value={selectedParentId} onChange={(e) => handleParentChange(e.target.value)} className={`${inputClass} bg-white`}>
                <option value="">Chọn danh mục cha</option>
                {parentCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {selectedParentId && !parentIsLeaf && (
              <div>
                <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">Danh mục con</label>
                <select required value={infoForm.category_id} onChange={(e) => setInfoForm((f) => ({ ...f, category_id: e.target.value }))} className={`${inputClass} bg-white`}>
                  <option value="">Chọn danh mục con</option>
                  {childCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">Mô tả</label>
            <textarea rows={5} value={infoForm.description} onChange={(e) => setInfoForm((f) => ({ ...f, description: e.target.value }))} className={`${inputClass} resize-y`} />
          </div>
          <p className="text-xs text-neutral-400">Slug: /{product.slug}</p>
          <button type="submit" disabled={savingInfo} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 disabled:opacity-60">
            {savingInfo && <IconSpinner />}
            Lưu thông tin
          </button>
        </form>
      )}

      {tab === "variants" && (
        <div className="space-y-6">
          {variants.length === 0 ? (
            <p className="text-sm text-neutral-500 bg-white border border-neutral-200 rounded-lg p-6">Chưa có biến thể.</p>
          ) : (
            <div className="bg-white border border-neutral-200 rounded-lg overflow-x-auto w-full">
              <div className="flex items-center gap-3 px-4 py-2.5 bg-neutral-50 border-b border-neutral-100">
                <span className="text-xs text-neutral-500">Giá bán chung:</span>
                <input type="number" min="0"
                  onChange={(e) => {
                    if (!e.target.value) return;
                    setVariantEdits((prev) => {
                      const next = { ...prev };
                      Object.keys(next).forEach((id) => { next[id] = { ...next[id], price: e.target.value }; });
                      return next;
                    });
                  }}
                  placeholder="Nhập giá → áp dụng cho tất cả..."
                  className="w-44 border border-neutral-200 rounded px-2 py-1.5 text-sm outline-none focus:border-neutral-400 bg-white"
                />
                <button type="button" onClick={saveAllVariants} disabled={savingAll}
                  className="inline-flex items-center gap-1 ml-auto px-3 py-1.5 text-xs bg-black text-white rounded-md hover:bg-neutral-800 disabled:opacity-60">
                  {savingAll && <IconSpinner className="w-3 h-3" />}
                  Lưu tất cả
                </button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500 text-left">
                    <th className="px-3 py-3">SKU</th>
                    <th className="px-3 py-3">Màu</th>
                    <th className="px-3 py-3">Size</th>
                    <th className="px-3 py-3">Giá bán</th>
                    <th className="px-3 py-3 w-28" />
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => (
                    <tr key={v.id} className="border-t border-neutral-100">
                      <td className="px-3 py-2 text-xs text-neutral-500 font-mono">{v.sku}</td>
                      <td className="px-3 py-2">
                        <ColorSelect
                          value={variantEdits[v.id]?.color ?? ""}
                          onChange={(val) => updateVariantEdit(v.id, "color", val)}
                          className="min-w-[8.5rem] border border-neutral-200 rounded px-2 py-1 text-sm bg-white"
                          required
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input value={variantEdits[v.id]?.size ?? ""} onChange={(e) => updateVariantEdit(v.id, "size", e.target.value)} className="w-20 border border-neutral-200 rounded px-2 py-1 text-sm" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" value={variantEdits[v.id]?.price ?? ""} onChange={(e) => updateVariantEdit(v.id, "price", e.target.value)} className="w-24 border border-neutral-200 rounded px-2 py-1 text-sm" />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button type="button" onClick={() => saveVariant(v.id)} disabled={savingVariantId === v.id} className="text-xs px-2 py-1 bg-black text-white rounded hover:bg-neutral-800 disabled:opacity-50">
                            {savingVariantId === v.id ? "..." : "Lưu"}
                          </button>
                          <button type="button" onClick={() => setConfirm({ type: "variant", id: v.id, title: "Xóa biến thể", message: `Xóa biến thể ${v.sku}?`})} className="text-xs px-2 py-1 text-red-600 border border-red-100 rounded hover:bg-red-50">Xóa</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form onSubmit={addVariant} className="bg-white border border-neutral-200 rounded-lg p-6">
            <h3 className="text-sm font-medium mb-4">Thêm biến thể mới</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <ColorSelect
                value={newVariant.color}
                onChange={(val) => setNewVariant((v) => ({ ...v, color: val }))}
                className={inputClass}
                required
              />
              <input placeholder="Size" value={newVariant.size} onChange={(e) => setNewVariant((v) => ({ ...v, size: e.target.value }))} className={inputClass} />
              <input type="number" placeholder="Giá bán" value={newVariant.price} onChange={(e) => setNewVariant((v) => ({ ...v, price: e.target.value }))} className={inputClass} />
            </div>
            <button type="submit" disabled={addingVariant} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 text-sm border border-neutral-300 rounded-md hover:bg-neutral-50 disabled:opacity-60">
              {addingVariant && <IconSpinner />}
              Thêm biến thể
            </button>
          </form>
        </div>
      )}

      {tab === "images" && (
        <div className="space-y-6">
          <div className="bg-white border border-neutral-200 rounded-lg p-6 flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
                Gắn ảnh theo màu
              </label>
              <select
                value={imageUploadColor}
                onChange={(e) => setImageUploadColor(e.target.value)}
                className={`${inputClass} bg-white`}
                disabled={!productColors.length}
              >
                <option value="">Ảnh chung (không gắn màu)</option>
                {productColors.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-neutral-400">
                Mỗi màu chỉ cần tải ảnh một lần — áp dụng cho mọi size cùng màu.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 px-5 py-2.5 text-sm border border-dashed border-neutral-300 rounded-md cursor-pointer hover:bg-neutral-50">
              {uploadingImages ? <IconSpinner /> : "+ Tải ảnh"}
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={handleUploadImages} disabled={uploadingImages} />
            </label>
          </div>

          {images.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-12 border border-dashed border-neutral-200 rounded-lg bg-white">Chưa có hình ảnh.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((img) => (
                <div key={img.id} className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
                  <div className="relative aspect-square bg-neutral-100">
                    <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                    {img.is_thumbnail && (
                      <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider bg-black text-white px-2 py-0.5 rounded">
                        Đại diện
                      </span>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-xs text-neutral-500 truncate">
                      {img.color || "Ảnh chung"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {!img.is_thumbnail && (
                        <button type="button" onClick={() => setThumbnail(img.id)} className="text-xs px-2 py-1 border border-neutral-200 rounded hover:bg-neutral-50">
                          Đặt đại diện
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setConfirm({
                            type: "image",
                            id: img.id,
                            title: "Xóa ảnh",
                            message: "Xóa ảnh này khỏi sản phẩm?",
                          })
                        }
                        className="text-xs px-2 py-1 text-red-600 border border-red-100 rounded hover:bg-red-50"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        submitting={confirmLoading}
        confirmLabel={confirm?.type === "product" ? "Xóa sản phẩm" : "Xóa"}
        onCancel={() => !confirmLoading && setConfirm(null)}
        onConfirm={() => {
          if (confirm?.type === "product") handleDeleteProduct();
          else if (confirm?.type === "variant") handleDeleteVariant(confirm.id);
          else if (confirm?.type === "image") handleDeleteImage(confirm.id);
        }}
      />
    </div>
  );
}
