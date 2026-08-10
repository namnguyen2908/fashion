import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../../../services/api";
import { IconSpinner, IconSearch, IconChevron } from "../../../components/admin/Icons";

export default function StockList() {
  const { warehouseSlug } = useParams();
  const [products, setProducts] = useState([]);
  const [warehouse, setWarehouse] = useState(null);
  const [warehouseLoaded, setWarehouseLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [variantStock, setVariantStock] = useState({});
  const [loadingVariants, setLoadingVariants] = useState({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [threshold, setThreshold] = useState(5);
  const debounceRef = useRef(null);

  useEffect(() => {
    api.get("/warehouse/warehouses")
      .then(({ data }) => {
        const list = Array.isArray(data?.data) ? data.data : [];
        const found = list.find(
          (w) => String(w.slug) === String(warehouseSlug) || String(w.id) === String(warehouseSlug)
        );
        setWarehouse(found || null);
      })
      .catch(() => {})
      .finally(() => setWarehouseLoaded(true));
  }, [warehouseSlug]);

  useEffect(() => {
    setPage(1);
    setSearch("");
    setSearchInput("");
    setExpandedId(null);
    setVariantStock({});
  }, [warehouseSlug]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, limit: 15 };
      if (search.trim()) params.search = search.trim();
      const { data } = await api.get("/products", { params });
      const list = data?.data ?? [];
      setProducts(list);
      setTotalPages(data?.totalPages ?? 1);
      setTotal(data?.total ?? 0);
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể tải danh sách.");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const toggleExpand = async (productId) => {
    if (expandedId === productId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(productId);

    if (!warehouse) return;

    if (!variantStock[productId]) {
      setLoadingVariants((prev) => ({ ...prev, [productId]: true }));
      try {
        const { data } = await api.get(`/warehouse/stocks/product/${productId}`, {
          params: { warehouse_id: warehouse.id }
        });
        const stockMap = {};
        (data?.data ?? []).forEach((v) => {
          stockMap[v.variant_id] = v.stock_qty;
        });
        setVariantStock((prev) => ({
          ...prev,
          [productId]: { variants: data?.data ?? [], stockMap }
        }));
      } catch {
        setVariantStock((prev) => ({ ...prev, [productId]: { variants: [], stockMap: {} } }));
      } finally {
        setLoadingVariants((prev) => ({ ...prev, [productId]: false }));
      }
    }
  };

  const isLow = (qty) => qty > 0 && qty < threshold;
  const isOut = (qty) => qty === 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full">
      <Link to="/admin/warehouse/stocks"
        className="inline-block mb-4 text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
        ← Tất cả kho
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-medium tracking-tight">
            {warehouse?.name || "Tồn kho"}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {total > 0 ? `${total} sản phẩm` : "Danh sách tồn kho"}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-600 cursor-pointer">
          <input type="checkbox" checked={lowStock}
            onChange={() => { setLowStock(!lowStock); setPage(1); }}
            className="rounded border-neutral-300 text-black focus:ring-black"
          />
          Tồn thấp (&lt;{threshold})
        </label>
      </div>

      <div className="mb-6">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none z-10" />
          <input type="text" value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              clearTimeout(debounceRef.current);
              debounceRef.current = setTimeout(() => { setSearch(e.target.value); setPage(1); }, 500);
            }}
            placeholder="Tìm theo tên sản phẩm..."
            className="w-full border border-neutral-200 rounded-md pl-10 pr-4 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 transition-colors"
          />
        </div>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">{error}</p>
      )}

      {warehouseLoaded && !warehouse ? (
        <div className="border border-dashed border-neutral-200 rounded-lg bg-white p-12 text-center">
          <p className="text-sm text-neutral-500">Không tìm thấy kho.</p>
          <Link to="/admin/warehouse/stocks"
            className="inline-block mt-4 text-sm underline underline-offset-4 hover:text-neutral-600">
            Quay lại danh sách kho
          </Link>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-neutral-400 gap-2">
          <IconSpinner className="w-5 h-5" />
          <span className="text-sm">Đang tải...</span>
        </div>
      ) : products.length === 0 ? (
        <div className="border border-dashed border-neutral-200 rounded-lg bg-white p-12 text-center">
          <p className="text-sm text-neutral-500">
            {search ? "Không tìm thấy sản phẩm phù hợp." : "Chưa có sản phẩm nào."}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                    <th className="px-4 py-3 font-medium w-8"></th>
                    <th className="px-4 py-3 font-medium">Sản phẩm</th>
                    <th className="px-4 py-3 font-medium hidden sm:table-cell">Danh mục</th>
                    <th className="px-4 py-3 font-medium text-right">Tồn kho</th>
                    <th className="px-4 py-3 font-medium text-right hidden md:table-cell">Biến thể</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const stockData = variantStock[p.id];
                    const totalQty = stockData?.variants?.reduce((s, v) => s + Number(v.stock_qty), 0) ?? null;
                    const lowCount = stockData?.variants?.filter((v) => isLow(v.stock_qty)).length ?? 0;
                    const outCount = stockData?.variants?.filter((v) => v.stock_qty === 0).length ?? 0;
                    const isExpanded = expandedId === p.id;

                    return (
                      <tr key={p.id} className="border-t border-neutral-100 transition-colors">
                        <td colSpan={5} className="p-0">
                          <button type="button" onClick={() => toggleExpand(p.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50/80 transition-colors text-left"
                          >
                            <IconChevron expanded={isExpanded} className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <span className="flex-1 font-medium text-neutral-900">{p.name}</span>
                            <span className="hidden sm:table-cell text-sm text-neutral-500">{p.category_name || "—"}</span>
                            <span className="text-sm text-right w-16 shrink-0">
                              {totalQty !== null ? (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                  totalQty === 0 ? "text-red-600 bg-red-50" : (lowCount > 0 || outCount > 0) ? "text-amber-600 bg-amber-50" : "text-green-600 bg-green-50"
                                }`}>
                                  {totalQty}
                                </span>
                              ) : (
                                <span className="text-neutral-400">—</span>
                              )}
                            </span>
                            <span className="hidden md:table-cell text-sm text-neutral-400 text-right w-16 shrink-0">
                              {stockData?.variants?.length ?? "—"}
                            </span>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-neutral-100 bg-neutral-50/50">
                              {loadingVariants[p.id] ? (
                                <div className="flex items-center justify-center py-6 text-neutral-400 gap-2">
                                  <IconSpinner className="w-4 h-4" />
                                  <span className="text-xs">Đang tải...</span>
                                </div>
                              ) : variantStock[p.id]?.variants?.length > 0 ? (
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-left text-xs uppercase tracking-wider text-neutral-400">
                                      <th className="pl-10 pr-4 py-2 font-medium w-8"></th>
                                      <th className="px-4 py-2 font-medium">Màu</th>
                                      <th className="px-4 py-2 font-medium hidden sm:table-cell">Size</th>
                                      <th className="px-4 py-2 font-medium">SKU</th>
                                      <th className="px-4 py-2 font-medium text-right">Tồn kho</th>
                                      <th className="px-4 py-2 font-medium text-right hidden md:table-cell">Giá bán</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {variantStock[p.id].variants.map((v) => {
                                      const low = isLow(v.stock_qty);
                                      const out = isOut(v.stock_qty);
                                      return (
                                        <tr key={v.variant_id} className="border-t border-neutral-50 hover:bg-white transition-colors">
                                          <td className="pl-10 pr-4 py-2"></td>
                                          <td className="px-4 py-2 text-neutral-700">{v.color || "—"}</td>
                                          <td className="px-4 py-2 text-neutral-700 hidden sm:table-cell">{v.size || "—"}</td>
                                          <td className="px-4 py-2 text-neutral-400 text-xs font-mono">{v.sku}</td>
                                          <td className="px-4 py-2 text-right">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                              out ? "text-red-600 bg-red-50" : low ? "text-amber-600 bg-amber-50" : "text-green-600 bg-green-50"
                                            }`}>
                                              {out ? "Hết" : v.stock_qty}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2 text-right text-neutral-600 hidden md:table-cell">
                                            {v.price ? `${Number(v.price).toLocaleString("vi-VN")}₫` : "—"}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              ) : (
                                <div className="py-6 text-center text-xs text-neutral-400">
                                  Không có biến thể nào.
                                </div>
                              )}
                            </div>
                          )}
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
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 text-sm border border-neutral-200 rounded-md disabled:opacity-40 hover:bg-neutral-50">
                Trước
              </button>
              <span className="text-sm text-neutral-500">Trang {page} / {totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 text-sm border border-neutral-200 rounded-md disabled:opacity-40 hover:bg-neutral-50">
                Sau
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
