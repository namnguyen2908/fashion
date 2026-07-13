import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../../services/api";
import { IconSpinner, IconEye, IconTrash, IconPlay, IconSearch } from "../../components/admin/Icons";
import AutocompleteSelect from "../../components/admin/AutocompleteSelect";

const formatDate = (value) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
};

const STATUS_LABELS = {
  incomplete: { icon: "!", class: "text-amber-600 bg-amber-50 border-amber-200", label: "Chưa hoàn thành" },
  missing_variants: { icon: "!", class: "text-amber-600 bg-amber-50 border-amber-200", label: "Thiếu biến thể" },
  missing_images: { icon: "!", class: "text-amber-600 bg-amber-50 border-amber-200", label: "Thiếu hình ảnh" },
  ok: { icon: "✓", class: "text-green-600 bg-green-50 border-green-200", label: "Hoàn chỉnh" },
};

function getProductStatus(product) {
  const vc = Number(product.variant_count) || 0;
  const ic = Number(product.image_count) || 0;
  if (vc === 0 && ic === 0) return "incomplete";
  if (vc === 0) return "missing_variants";
  if (ic === 0) return "missing_images";
  return "ok";
}

function getContinueUrl(product) {
  const vc = Number(product.variant_count) || 0;
  const ic = Number(product.image_count) || 0;
  const step = ic === 0 ? 3 : vc === 0 ? 2 : 1;
  return `/admin/products/create?productId=${product.id}&step=${step}`;
}

export default function ProductList() {
  const location = useLocation();
  const successMessage = location.state?.message;

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const debounceRef = useRef(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, limit: 15 };
      if (search.trim()) params.search = search.trim();
      if (categoryFilter) params.category = categoryFilter;

      const { data } = await api.get("/products", { params });
      setProducts(data?.data ?? []);
      setTotalPages(data?.totalPages ?? 1);
      setTotal(data?.total ?? 0);
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể tải danh sách sản phẩm.");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter]);

  useEffect(() => {
    fetchProducts();
    api.get("/categories").then(({ data }) => setCategories(Array.isArray(data) ? data : [])).catch(() => {});
  }, [fetchProducts]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/products/delete-product/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchProducts();
    } catch (err) {
      alert(err?.response?.data?.message || "Không thể xóa sản phẩm.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full">
      {successMessage && (
        <p className="mb-6 text-sm text-green-800 bg-green-50 border border-green-100 rounded-md px-4 py-3">
          {successMessage}
        </p>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-medium tracking-tight">Sản phẩm</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {total > 0 ? `${total} sản phẩm` : "Danh sách sản phẩm trong hệ thống"}
          </p>
        </div>
        <Link
          to="/admin/products/create"
          className="inline-flex justify-center px-5 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 transition-colors shrink-0"
        >
          Tạo sản phẩm mới
        </Link>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-2">
        <AutocompleteSelect
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          value={categoryFilter}
          onChange={(v) => { setCategoryFilter(v); setPage(1); }}
          placeholder="Tất cả danh mục..."
        />
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none z-10" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              clearTimeout(debounceRef.current);
                    debounceRef.current = setTimeout(() => {
                      setSearch(e.target.value);
                      setPage(1);
                    }, 500);
            }}
            placeholder="Tìm theo tên sản phẩm..."
            className="w-full border border-neutral-200 rounded-md pl-10 pr-4 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 transition-colors"
          />
        </div>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-neutral-400 gap-2">
          <IconSpinner className="w-5 h-5" />
          <span className="text-sm">Đang tải...</span>
        </div>
      ) : products.length === 0 ? (
        <div className="border border-dashed border-neutral-200 rounded-lg bg-white p-12 text-center">
          <p className="text-sm text-neutral-500">
            {search ? "Không tìm thấy sản phẩm phù hợp." : "Chưa có sản phẩm nào."}
          </p>
          <Link
            to="/admin/products/create"
            className="inline-block mt-4 text-sm underline underline-offset-4 hover:text-neutral-600"
          >
            Tạo sản phẩm đầu tiên
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                      <th className="px-4 py-3 font-medium">Tên sản phẩm</th>
                      <th className="px-4 py-3 font-medium hidden sm:table-cell">Danh mục</th>
                      <th className="px-4 py-3 font-medium hidden md:table-cell">Trạng thái</th>
                      <th className="px-4 py-3 font-medium hidden lg:table-cell">Ngày tạo</th>
                      <th className="px-4 py-3 font-medium text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => {
                      const status = getProductStatus(product);
                      const st = STATUS_LABELS[status];
                      const isIncomplete = status !== "ok";

                      return (
                        <tr
                          key={product.id}
                          className={`border-t border-neutral-100 hover:bg-neutral-50/80 transition-colors ${isIncomplete ? "bg-amber-50/30" : ""}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {isIncomplete && (
                                <span
                                  className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${st.class}`}
                                  title={st.label}
                                >
                                  {st.icon}
                                </span>
                              )}
                              <Link
                                to={`/admin/products/${product.id}`}
                                className="font-medium text-neutral-900 hover:underline underline-offset-2"
                              >
                                {product.name}
                              </Link>
                            </div>
                            <p className="sm:hidden text-xs text-neutral-500 mt-0.5">
                              {product.category_name || "—"}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-neutral-600 hidden sm:table-cell">
                            {product.category_name || "—"}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${st.class}`}>
                              {st.icon}
                              <span>{st.label}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-neutral-500 text-xs hidden lg:table-cell whitespace-nowrap">
                            {formatDate(product.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              {isIncomplete && (
                                <Link
                                  to={getContinueUrl(product)}
                                  className="p-1.5 text-amber-600 hover:text-amber-800 rounded-md hover:bg-amber-50 transition-colors"
                                  aria-label="Tiếp tục"
                                >
                                  <IconPlay />
                                </Link>
                              )}
                              <Link
                                to={`/admin/products/${product.id}`}
                                className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-md hover:bg-neutral-100 transition-colors"
                                aria-label="Chi tiết"
                              >
                                <IconEye />
                              </Link>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(product)}
                                className="p-1.5 text-neutral-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                                aria-label="Xóa"
                              >
                                <IconTrash />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 text-sm border border-neutral-200 rounded-md disabled:opacity-40 hover:bg-neutral-50"
              >
                Trước
              </button>
              <span className="text-sm text-neutral-500">
                Trang {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 text-sm border border-neutral-200 rounded-md disabled:opacity-40 hover:bg-neutral-50"
              >
                Sau
              </button>
            </div>
          )}
        </>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="bg-white rounded-lg border border-neutral-100 shadow-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-medium mb-2">Xóa sản phẩm</h3>
            <p className="text-sm text-neutral-600 mb-6">
              Xóa &quot;{deleteTarget.name}&quot;? Hành động không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" disabled={deleting} onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-neutral-600">
                Hủy
              </button>
              <button type="button" disabled={deleting} onClick={handleDelete} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-black text-white rounded-md disabled:opacity-60">
                {deleting && <IconSpinner />}
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
