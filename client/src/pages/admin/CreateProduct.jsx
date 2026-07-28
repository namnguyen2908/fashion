import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../services/api";
import { IconSpinner } from "../../components/admin/Icons";
import ColorMultiSelect from "../../components/admin/ColorMultiSelect";

import {
  getParentCategories,
  getChildCategories,
  isLeafParent,
} from "../../utils/adminCategories";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — Tích đề-các biến thể
// ─────────────────────────────────────────────────────────────────────────────

/** Tích Đề-Các: màu × size → danh sách dòng biến thể */
function cartesianVariants(colors, sizes) {
  const cols = colors.length ? colors : [""];
  const rows = sizes.length ? sizes : [""];
  return cols.flatMap((color) =>
    rows.map((size) => ({
      key: `${color}-${size}`,
      color,
      size,
      cost_price: "",
      list_price: "",
    }))
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP PROGRESS BAR
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Thông tin sản phẩm" },
  { id: 2, label: "Biến thể" },
  { id: 3, label: "Hình ảnh" },
];

function StepProgressBar({ currentStep, completedSteps }) {
  return (
    <nav aria-label="Tiến trình tạo sản phẩm" className="mb-10">
      <ol className="flex items-center justify-between max-w-2xl mx-auto">
        {STEPS.map((step, index) => {
          const done = completedSteps.has(step.id);
          const active = currentStep === step.id;
          return (
            <li key={step.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-2 min-w-0">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium border transition-colors ${
                    done
                      ? "bg-neutral-900 border-neutral-900 text-white"
                      : active
                        ? "border-neutral-900 text-neutral-900"
                        : "border-neutral-300 text-neutral-400"
                  }`}
                >
                  {done ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    step.id
                  )}
                </span>
                <span
                  className={`text-[10px] sm:text-xs uppercase tracking-wider text-center hidden sm:block ${
                    active ? "text-neutral-900" : "text-neutral-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`h-px flex-1 mx-2 sm:mx-4 transition-colors ${
                    completedSteps.has(step.id) ? "bg-neutral-900" : "bg-neutral-200"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAG INPUT — Nhập nhanh màu / size dạng chips
// ─────────────────────────────────────────────────────────────────────────────

function TagInput({ label, tags, onChange, placeholder }) {
  const [input, setInput] = useState("");

  const addTags = (raw) => {
    const parts = raw
      .split(/[,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...tags];
    parts.forEach((p) => {
      if (!next.includes(p)) next.push(p);
    });
    onChange(next);
    setInput("");
  };

  const removeTag = (tag) => onChange(tags.filter((t) => t !== tag));

  return (
    <div>
      <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
        {label}
      </label>
      <div className="flex flex-wrap gap-2 p-3 border border-neutral-200 rounded-md bg-white min-h-[48px]">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-100 text-sm text-neutral-800 rounded-full"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-neutral-400 hover:text-neutral-900"
              aria-label={`Xóa ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTags(input);
            }
          }}
          onBlur={() => input.trim() && addTags(input)}
          placeholder={placeholder}
          className="flex-1 min-w-[120px] text-sm outline-none bg-transparent"
        />
      </div>
      <p className="mt-1.5 text-xs text-neutral-400">Nhập giá trị rồi Enter hoặc dấu phẩy để thêm.</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE PRODUCT PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function CreateProduct() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeProductId = searchParams.get("productId");
  const resumeStep = Number(searchParams.get("step")) || 1;
  const isResume = !!resumeProductId;

  const [step, setStep] = useState(isResume ? resumeStep : 1);
  const [completedSteps, setCompletedSteps] = useState(new Set(isResume ? [1] : []));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [productId, setProductId] = useState(resumeProductId ? Number(resumeProductId) : null);

  // Bước 1
  const [categories, setCategories] = useState([]);
  const [productForm, setProductForm] = useState({
    name: "",
    category_id: "",
    description: "",
  });
  const [selectedParentId, setSelectedParentId] = useState("");

  // Bước 2
  const [colorTags, setColorTags] = useState([]);
  const [sizeTags, setSizeTags] = useState([]);
  const [variantRows, setVariantRows] = useState([]);
  const [savingVariants, setSavingVariants] = useState(false);
  const [savedVariantKeys, setSavedVariantKeys] = useState(new Set());

  // Bước 3 — ảnh local + metadata (color, thumbnail)
  const [imageItems, setImageItems] = useState([]);

  const parentCategories = useMemo(() => getParentCategories(categories), [categories]);
  const childCategories = useMemo(
    () => getChildCategories(categories, selectedParentId),
    [categories, selectedParentId]
  );
  const parentIsLeaf = useMemo(
    () => isLeafParent(categories, selectedParentId),
    [categories, selectedParentId]
  );

  const handleParentChange = (parentId) => {
    setSelectedParentId(parentId);
    if (!parentId) {
      setProductForm((f) => ({ ...f, category_id: "" }));
      return;
    }
    if (isLeafParent(categories, parentId)) {
      setProductForm((f) => ({ ...f, category_id: parentId }));
    } else {
      setProductForm((f) => ({ ...f, category_id: "" }));
    }
  };

  const handleChildChange = (childId) => {
    setProductForm((f) => ({ ...f, category_id: childId }));
  };

  const uniqueColors = useMemo(
    () => [...new Set(variantRows.map((v) => v.color).filter(Boolean))],
    [variantRows]
  );

  useEffect(() => {
    api
      .get("/categories")
      .then((res) => setCategories(Array.isArray(res.data) ? res.data : []))
      .catch(() => setCategories([]));
  }, []);

  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [step]);

  const markStepDone = (stepId) => {
    setCompletedSteps((prev) => new Set([...prev, stepId]));
  };

  // ── BƯỚC 1: Tạo sản phẩm → API → lấy productId ──
  const handleStep1Submit = async (e) => {
    e.preventDefault();
    if (!productForm.category_id) {
      setError("Vui lòng chọn đầy đủ danh mục cha và danh mục con.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const { data } = await api.post("/products/create-product", {
        name: productForm.name.trim(),
        category_id: Number(productForm.category_id),
        description: productForm.description.trim() || null,
      });
      setProductId(data.data.id);
      markStepDone(1);
      setStep(2);
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể tạo sản phẩm.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── BƯỚC 2: Sinh dòng biến thể (frontend) ──
  const handleGenerateVariants = () => {
    if (!colorTags.length && !sizeTags.length) {
      setError("Vui lòng nhập ít nhất một màu hoặc một kích thước.");
      return;
    }
    setError("");
    setVariantRows(cartesianVariants(colorTags, sizeTags));
  };

  const updateVariantRow = (key, field, value) => {
    setVariantRows((rows) =>
      rows.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    );
  };

  // ── BƯỚC 2: Lưu từng biến thể qua API ──
  const handleStep2Submit = async () => {
    if (!variantRows.length) {
      setError('Nhấn "Tự động sinh biến thể" trước khi lưu.');
      return;
    }
    for (const row of variantRows) {
      if (!row.cost_price || Number(row.cost_price) <= 0) {
        setError("Mỗi biến thể cần có giá vốn hợp lệ.");
        return;
      }
    }

    setError("");
    setSavingVariants(true);
    try {
      await Promise.all(
        variantRows.map(async (row) => {
          const { data } = await api.post("/product-variants/create-variant", {
            product_id: productId,
            color: row.color,
            size: row.size,
            cost_price: Number(row.cost_price),
            list_price: row.list_price ? Number(row.list_price) : null,
          });
          return data;
        })
      );
      markStepDone(2);
      setStep(3);
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể lưu biến thể.");
    } finally {
      setSavingVariants(false);
    }
  };

  // ── BƯỚC 3: Chọn file ảnh (preview local) ──
  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    const newItems = files.map((file) => ({
      localId: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      color: uniqueColors[0] || "",
      is_thumbnail: imageItems.length === 0,
    }));
    setImageItems((prev) => {
      const hasThumb = prev.some((i) => i.is_thumbnail) || newItems.some((i) => i.is_thumbnail);
      if (!hasThumb && newItems.length) newItems[0].is_thumbnail = true;
      return [...prev, ...newItems];
    });
    e.target.value = "";
  };

  const updateImageItem = (localId, patch) => {
    setImageItems((items) => items.map((i) => (i.localId === localId ? { ...i, ...patch } : i)));
  };

  const setThumbnail = (localId) => {
    setImageItems((items) =>
      items.map((i) => ({ ...i, is_thumbnail: i.localId === localId }))
    );
  };

  const removeImageItem = (localId) => {
    setImageItems((items) => {
      const target = items.find((i) => i.localId === localId);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      const next = items.filter((i) => i.localId !== localId);
      if (target?.is_thumbnail && next.length) next[0].is_thumbnail = true;
      return next;
    });
  };

  const [uploadingImages, setUploadingImages] = useState(false);

  // ── BƯỚC 3: Upload từng ảnh qua API ──
  const handleStep3Finish = async () => {
    if (!imageItems.length) {
      setError("Vui lòng tải lên ít nhất một hình ảnh.");
      return;
    }
    if (!imageItems.some((i) => i.is_thumbnail)) {
      setError("Vui lòng chọn một ảnh đại diện (thumbnail).");
      return;
    }

    setError("");
    setUploadingImages(true);
    try {
      await Promise.all(
        imageItems.map(async (item) => {
          const fd = new FormData();
          fd.append("images", item.file);
          fd.append("product_id", String(productId));
          if (item.color) fd.append("color", item.color);
          fd.append("is_thumbnail", item.is_thumbnail ? "true" : "false");

          await api.post("/product-images/create-product-images", fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        })
      );

      markStepDone(3);
      navigate("/admin/products", {
        state: { message: "Tạo sản phẩm thành công!" },
      });
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể tải ảnh lên.");
    } finally {
      setUploadingImages(false);
    }
  };



  const inputClass =
    "w-full border border-neutral-200 rounded-md px-4 py-2.5 text-sm outline-none focus:border-neutral-400 transition-colors";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full">
      <header className="mb-6">
        <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-neutral-900">
          {isResume ? "Tiếp tục tạo sản phẩm" : "Tạo sản phẩm mới"}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {isResume
            ? `Đang tiếp tục sản phẩm #${productId} — bước ${step}/3`
            : "Luồng 3 bước — Thông tin, biến thể, hình ảnh"}
        </p>
      </header>

      <StepProgressBar currentStep={step} completedSteps={completedSteps} />

      {error && (
        <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">
          {error}
        </p>
      )}

      {/* Panel trượt 3 bước — inner rộng 300%, mỗi step chiếm 1/3 viewport */}
      <div ref={scrollRef} className="overflow-hidden w-full">
        <div
          className="flex w-[300%] transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${((step - 1) / 3) * 100}%)` }}
        >
          {/* ─── STEP 1 ─── */}
          <section className="w-1/3 shrink-0 px-0.5">
            <form onSubmit={handleStep1Submit} className="bg-white border border-neutral-200 rounded-lg p-6 space-y-5">
              <div>
                <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
                  Tên sản phẩm
                </label>
                <input
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                  placeholder="Ví dụ: Áo sơ mi linen"
                />
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
                    Danh mục cha
                  </label>
                  <select
                    required
                    value={selectedParentId}
                    onChange={(e) => handleParentChange(e.target.value)}
                    className={`${inputClass} bg-white`}
                  >
                    <option value="">Chọn danh mục cha</option>
                    {parentCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedParentId && !parentIsLeaf && (
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
                      Danh mục con
                    </label>
                    <select
                      required
                      value={productForm.category_id}
                      onChange={(e) => handleChildChange(e.target.value)}
                      className={`${inputClass} bg-white`}
                    >
                      <option value="">Chọn danh mục con</option>
                      {childCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    {childCategories.length === 0 && (
                      <p className="mt-2 text-xs text-amber-700">
                        Danh mục cha này chưa có danh mục con. Hãy tạo danh mục con trước.
                      </p>
                    )}
                  </div>
                )}

                {selectedParentId && parentIsLeaf && (
                  <p className="text-xs text-neutral-500 bg-neutral-50 border border-neutral-100 rounded-md px-3 py-2">
                    Danh mục &quot;{parentCategories.find((c) => String(c.id) === selectedParentId)?.name}&quot; không có cấp con — sản phẩm sẽ gán trực tiếp vào danh mục này.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
                  Mô tả
                </label>
                <textarea
                  rows={4}
                  value={productForm.description}
                  onChange={(e) => setProductForm((f) => ({ ...f, description: e.target.value }))}
                  className={`${inputClass} resize-y min-h-[100px]`}
                  placeholder="Mô tả ngắn về sản phẩm..."
                />
              </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 disabled:opacity-60 transition-colors"
                >
                  {submitting && <IconSpinner />}
                  Tạo sản phẩm
                </button>
            </form>
          </section>

          {/* ─── STEP 2 ─── */}
          <section className="w-1/3 shrink-0 px-0.5">
            <div className="bg-white border border-neutral-200 rounded-lg p-6 space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <ColorMultiSelect
                  label="Màu sắc"
                  selected={colorTags}
                  onChange={setColorTags}
                />
                <TagInput
                  label="Kích thước"
                  tags={sizeTags}
                  onChange={setSizeTags}
                  placeholder="S, M, L..."
                />
              </div>

              <button
                type="button"
                onClick={handleGenerateVariants}
                className="w-full sm:w-auto px-5 py-2.5 text-sm border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors"
              >
                Tự động sinh biến thể
              </button>

              {variantRows.length > 0 && (
                <div className="overflow-x-auto border border-neutral-100 rounded-md">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                        <th className="px-3 py-3">Biến thể</th>
                        <th className="px-3 py-3">Giá vốn</th>
                        <th className="px-3 py-3">Giá niêm yết</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variantRows.map((row) => (
                        <tr key={row.key} className="border-t border-neutral-100">
                          <td className="px-3 py-2 font-medium text-neutral-800 whitespace-nowrap">
                            {[row.color, row.size].filter(Boolean).join(" · ") || "—"}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="1"
                              required
                              value={row.cost_price}
                              onChange={(e) => updateVariantRow(row.key, "cost_price", e.target.value)}
                              className="w-28 border border-neutral-200 rounded px-2 py-1.5 text-sm"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              value={row.list_price}
                              onChange={(e) => updateVariantRow(row.key, "list_price", e.target.value)}
                              className="w-28 border border-neutral-200 rounded px-2 py-1.5 text-sm"
                              placeholder="—"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="px-3 py-2 text-xs text-neutral-400 border-t border-neutral-100">
                    SKU do hệ thống tự sinh khi lưu (API create-variant).
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 text-sm text-neutral-600 hover:text-neutral-900"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={handleStep2Submit}
                  disabled={savingVariants || !variantRows.length}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 disabled:opacity-60"
                >
                  {savingVariants && <IconSpinner />}
                  Lưu biến thể
                </button>
              </div>
            </div>
          </section>

          {/* ─── STEP 3 ─── */}
          <section className="w-1/3 shrink-0 px-0.5">
            <div className="bg-white border border-neutral-200 rounded-lg p-6 space-y-6">
              <div>
                <label className="inline-flex items-center gap-2 px-5 py-2.5 text-sm border border-dashed border-neutral-300 rounded-md cursor-pointer hover:bg-neutral-50 transition-colors">
                  <span>+ Tải ảnh lên</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="sr-only"
                    onChange={handleFilesSelected}
                  />
                </label>
                <p className="mt-2 text-xs text-neutral-400">
                  JPG, PNG, WEBP — tối đa 5MB/ảnh. Gán màu nếu ảnh hiển thị theo màu, hoặc chọn "Ảnh chung" cho ảnh size chart, lifestyle.
                </p>
              </div>

              {imageItems.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {imageItems.map((item) => (
                    <div
                      key={item.localId}
                      className="border border-neutral-200 rounded-lg overflow-hidden bg-neutral-50"
                    >
                      <div className="relative aspect-square">
                        <img
                          src={item.preview}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImageItem(item.localId)}
                          className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full text-sm hover:bg-black/80"
                          aria-label="Xóa ảnh"
                        >
                          ×
                        </button>
                      </div>
                      <div className="p-3 space-y-3">
                        <select
                          value={item.color}
                          onChange={(e) => updateImageItem(item.localId, { color: e.target.value })}
                          className="w-full text-xs border border-neutral-200 rounded-md px-2 py-2 bg-white"
                        >
                          <option value="">Ảnh chung (không gán màu)</option>
                          {uniqueColors.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="thumbnail"
                            checked={item.is_thumbnail}
                            onChange={() => setThumbnail(item.localId)}
                            className="sr-only"
                          />
                          <span
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              item.is_thumbnail ? "border-neutral-900" : "border-neutral-300"
                            }`}
                          >
                            {item.is_thumbnail && (
                              <span className="w-2 h-2 rounded-full bg-neutral-900" />
                            )}
                          </span>
                          <span className="text-xs text-neutral-600">Ảnh đại diện</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={uploadingImages}
                  className="px-5 py-2.5 text-sm text-neutral-600 hover:text-neutral-900"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={handleStep3Finish}
                  disabled={uploadingImages}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 disabled:opacity-60"
                >
                  {uploadingImages && <IconSpinner />}
                  Tải ảnh lên
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
