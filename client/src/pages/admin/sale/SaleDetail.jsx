import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../../../services/api";
import { IconSpinner, IconTrash, IconSearch } from "../../../components/admin/Icons";

export default function SaleDetail() {
  const { id } = useParams();
  const [sale, setSale] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addResults, setAddResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productVariants, setProductVariants] = useState([]);
  const [bulkPrice, setBulkPrice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/sales/${id}`);
        setSale(data?.data ?? null);
        setItems(data?.data?.items ?? []);
      } catch (err) {
        setError(err?.response?.data?.message || "Không thể tải thông tin sale.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!addSearch.trim()) { setAddResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/products", { params: { search: addSearch, limit: 8 } });
        setAddResults(data?.data ?? []);
      } catch { setAddResults([]); }
    }, 400);
    return () => clearTimeout(timer);
  }, [addSearch]);

  const selectProduct = async (product) => {
    try {
      const { data } = await api.get(`/products/${product.id}`);
      const pv = data?.data?.variants ?? [];
      setSelectedProduct(product);
      setProductVariants(pv.map((v) => ({ ...v, sale_price: "", _selected: false })));
      setAddSearch("");
      setAddResults([]);
    } catch { }
  };

  const handleAddVariants = async () => {
    const selected = productVariants.filter((v) => v.sale_price || v._selected);
    if (selected.length === 0) return;
    setSaving(true);
    try {
      await api.post(`/sales/${id}/variants`, {
        items: selected.map((v) => ({
          variant_id: v.id,
          sale_price: Number(v.sale_price)
        }))
      });
      setSelectedProduct(null);
      setProductVariants([]);
      setBulkPrice("");
      const { data } = await api.get(`/sales/${id}`);
      setItems(data?.data?.items ?? []);
    } catch { } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (variantId) => {
    if (!confirm("Xoá variant khỏi chương trình sale?")) return;
    try {
      await api.delete(`/sales/${id}/variants/${variantId}`);
      setItems((prev) => prev.filter((i) => i.variant_id !== variantId));
    } catch { }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 flex items-center justify-center text-neutral-400 gap-2">
        <IconSpinner className="w-5 h-5" /><span className="text-sm">Đang tải...</span>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-sm text-red-600">{error || "Không tìm thấy sale."}</p>
        <Link to="/admin/sales" className="inline-block mt-4 text-sm underline underline-offset-4">← Quay lại</Link>
      </div>
    );
  }

  const alreadyInSale = new Set(items.map((i) => i.variant_id));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full">
      <Link to="/admin/sales" className="inline-block mb-6 text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
        ← Quay lại chương trình sale
      </Link>

      <div className="bg-white border border-neutral-200 rounded-lg p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-medium tracking-tight">{sale.name}</h1>
            <p className="text-sm text-neutral-500 mt-1">
              {new Date(sale.starts_at).toLocaleDateString("vi-VN")} → {new Date(sale.expires_at).toLocaleDateString("vi-VN")}
            </p>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            sale.is_active ? "text-green-600 bg-green-50" : "text-neutral-400 bg-neutral-50"
          }`}>{sale.is_active ? "Đang hoạt động" : "Đã tắt"}</span>
        </div>
        {sale.description && <p className="mt-3 text-sm text-neutral-500">{sale.description}</p>}
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-medium text-neutral-900 uppercase tracking-wider">Sản phẩm trong sale ({items.length})</h2>
          <button type="button" onClick={() => setShowAdd(!showAdd)}
            className="text-sm text-neutral-600 hover:text-neutral-900 underline underline-offset-2">+ Thêm sản phẩm</button>
        </div>

        {showAdd && (
          <div className="p-4 bg-neutral-50 border-b border-neutral-100">
            {!selectedProduct ? (
              <div className="relative">
                <label className="block text-xs text-neutral-500 mb-1">Tìm sản phẩm</label>
                <div className="relative">
                  <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none z-10" />
                  <input type="text" value={addSearch} onChange={(e) => setAddSearch(e.target.value)}
                    placeholder="Gõ tên sản phẩm..."
                    className="w-full border border-neutral-200 rounded-md pl-10 pr-4 py-2 text-sm outline-none focus:border-neutral-400 bg-white"
                  />
                </div>
                {addResults.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {addResults.map((p) => (
                      <button key={p.id} type="button" onMouseDown={() => selectProduct(p)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 border-b border-neutral-50">
                        {p.name} {alreadyInSale.has(p.id) ? "(đã có)" : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-neutral-900">{selectedProduct.name}</span>
                  <button type="button" onClick={() => { setSelectedProduct(null); setProductVariants([]); }}
                    className="text-xs text-neutral-500 hover:text-neutral-900 underline underline-offset-2">Đổi sản phẩm</button>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-neutral-500">Giá sale chung:</span>
                  <input type="number" min="0" value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)}
                    placeholder="Nhập giá..."
                    className="w-32 border border-neutral-200 rounded px-2 py-1 text-sm outline-none focus:border-neutral-400"
                  />
                  <button type="button" onClick={() => {
                    if (!bulkPrice) return;
                    setProductVariants((prev) => prev.map((v) => ({ ...v, sale_price: bulkPrice })));
                  }}
                    className="text-xs text-neutral-600 hover:text-neutral-900 underline underline-offset-2">Áp dụng</button>
                </div>
                <div className="border border-neutral-200 rounded-md overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white text-left text-xs uppercase text-neutral-500">
                        <th className="px-3 py-2 font-medium">Màu</th>
                        <th className="px-3 py-2 font-medium">Size</th>
                        <th className="px-3 py-2 font-medium">SKU</th>
                        <th className="px-3 py-2 font-medium text-right">Giá gốc</th>
                        <th className="px-3 py-2 font-medium text-right">Giá sale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productVariants.map((v, idx) => (
                        <tr key={v.id} className="border-t border-neutral-50 hover:bg-neutral-50/50">
                          <td className="px-3 py-1.5 text-neutral-700">{v.color || "—"}</td>
                          <td className="px-3 py-1.5 text-neutral-700">{v.size || "—"}</td>
                          <td className="px-3 py-1.5 text-neutral-400 text-xs font-mono">{v.sku}</td>
                          <td className="px-3 py-1.5 text-right text-neutral-600">{Number(v.price).toLocaleString("vi-VN")}₫</td>
                          <td className="px-3 py-1.5">
                            <input type="number" min="0" value={v.sale_price}
                              onChange={(e) => {
                                const updated = [...productVariants];
                                updated[idx] = { ...updated[idx], sale_price: e.target.value };
                                setProductVariants(updated);
                              }}
                              className="w-full border border-neutral-200 rounded px-2 py-1 text-sm text-right outline-none focus:border-neutral-400"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end mt-3">
                  <button type="button" onClick={handleAddVariants} disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2 text-sm bg-black text-white rounded-md hover:bg-neutral-800 disabled:opacity-60">
                    {saving && <IconSpinner />} Thêm vào sale
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {items.length === 0 ? (
          <div className="p-12 text-center"><p className="text-sm text-neutral-500">Chưa có sản phẩm nào trong chương trình sale.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                  <th className="px-6 py-3 font-medium">Sản phẩm</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Màu</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Size</th>
                  <th className="px-4 py-3 font-medium text-right">Giá gốc</th>
                  <th className="px-4 py-3 font-medium text-right">Giá sale</th>
                  <th className="px-4 py-3 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-t border-neutral-100 hover:bg-neutral-50/80 transition-colors">
                    <td className="px-6 py-3 font-medium text-neutral-900">{i.product_name}</td>
                    <td className="px-4 py-3 text-neutral-500 text-xs font-mono">{i.sku}</td>
                    <td className="px-4 py-3 text-neutral-600 hidden sm:table-cell">{i.color || "—"}</td>
                    <td className="px-4 py-3 text-neutral-600 hidden sm:table-cell">{i.size || "—"}</td>
                    <td className="px-4 py-3 text-right text-neutral-600">{Number(i.price).toLocaleString("vi-VN")}₫</td>
                    <td className="px-4 py-3 text-right font-medium text-red-600">{Number(i.sale_price).toLocaleString("vi-VN")}₫</td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => handleRemove(i.variant_id)}
                        className="p-1.5 text-neutral-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors">
                        <IconTrash className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
