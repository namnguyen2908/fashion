import { useState, useEffect, useCallback, useRef } from "react";
import api from "../../../services/api";
import { IconSpinner, IconSearch } from "../../../components/admin/Icons";

const formatMoney = (value) => (value ? `${Number(value).toLocaleString("vi-VN")}₫` : "—");

export default function CostList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debounceRef = useRef(null);

  const fetchCosts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = search.trim() ? { search: search.trim() } : {};
      const { data } = await api.get("/warehouse/costs", { params });
      setItems(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể tải giá vốn.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchCosts(); }, [fetchCosts]);

  const totalCost = items.reduce((s, i) => s + Number(i.current_cost || 0), 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-medium tracking-tight">Giá vốn</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Giá vốn bình quân gia quyền của từng biến thể (cập nhật khi nhập kho)
        </p>
      </div>

      <div className="mb-6">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none z-10" />
          <input type="text" value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              clearTimeout(debounceRef.current);
              debounceRef.current = setTimeout(() => setSearch(e.target.value), 500);
            }}
            placeholder="Tìm theo sản phẩm hoặc SKU..."
            className="w-full border border-neutral-200 rounded-md pl-10 pr-4 py-2 text-sm outline-none focus:border-neutral-400 transition-colors"
          />
        </div>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-neutral-400 gap-2">
          <IconSpinner className="w-5 h-5" />
          <span className="text-sm">Đang tải...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-neutral-200 rounded-lg bg-white p-12 text-center">
          <p className="text-sm text-neutral-500">Chưa có dữ liệu giá vốn.</p>
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                  <th className="px-4 py-3 font-medium">Sản phẩm</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">SKU</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Màu / Size</th>
                  <th className="px-4 py-3 font-medium text-right">Giá vốn hiện hành</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.variant_id} className="border-t border-neutral-100 hover:bg-neutral-50/80 transition-colors">
                    <td className="px-4 py-3 font-medium text-neutral-900">{c.product_name}</td>
                    <td className="px-4 py-3 text-neutral-500 text-xs font-mono hidden sm:table-cell">{c.sku}</td>
                    <td className="px-4 py-3 text-neutral-600 hidden md:table-cell">
                      {[c.color, c.size].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatMoney(c.current_cost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-neutral-200 bg-neutral-50">
                  <td colSpan={3} className="px-4 py-3 text-xs uppercase tracking-wider text-neutral-500">Tổng giá trị tồn theo giá vốn</td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(totalCost)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
