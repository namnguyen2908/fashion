import { useState, useEffect } from 'react';
import { paymentService } from '../../services/payment';

const formatPrice = (price) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(price));

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('vi-VN');
}

export default function MyVouchersPage() {
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    paymentService.getMyDiscounts().then(({ data }) => {
      if (data.success) setDiscounts(data.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleCopy = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const active = discounts.filter(d => !d.is_used && (!d.expires_at || new Date(d.expires_at) > new Date()));
  const used = discounts.filter(d => d.is_used || (d.expires_at && new Date(d.expires_at) <= new Date()));

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-neutral-900 mb-2">Voucher của tôi</h1>
      <p className="text-sm text-neutral-500 mb-8">Mã giảm giá tự động nhận khi mua hàng</p>

      {/* Active */}
      {active.length === 0 ? (
        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-8 text-center mb-8">
          <p className="text-neutral-500 mb-2">Bạn chưa có voucher nào</p>
          <p className="text-xs text-neutral-400">Mua hàng để nhận voucher giảm giá cho lần tiếp theo</p>
        </div>
      ) : (
        <div className="space-y-4 mb-10">
          <h2 className="text-sm font-medium text-neutral-700">Còn hiệu lực ({active.length})</h2>
          {active.map((d) => (
            <div key={d.id} className="bg-white border border-neutral-200 rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-neutral-900">
                    {d.discount_type === 'percentage'
                      ? `Giảm ${d.discount_value}%`
                      : `Giảm ${formatPrice(d.discount_value)}`
                    }
                  </p>
                  <p className="text-sm text-neutral-600 mt-1">{d.rule_name || d.rule_description}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-neutral-500">
                    {Number(d.min_order_amount) > 0 && (
                      <span>Đơn tối thiểu: {formatPrice(d.min_order_amount)}</span>
                    )}
                    {d.expires_at && (
                      <span>Hết hạn: {formatDate(d.expires_at)}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <code className="px-3 py-1.5 bg-neutral-100 rounded-lg text-sm font-mono font-bold tracking-wider text-neutral-900">
                    {d.code}
                  </code>
                  <button
                    onClick={() => handleCopy(d.code, d.id)}
                    className="text-xs px-3 py-1.5 bg-black text-white rounded-md hover:bg-neutral-800 transition-colors"
                  >
                    {copiedId === d.id ? 'Đã copy' : 'Copy mã'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Used / Expired */}
      {used.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-neutral-500 mb-3">Đã dùng / Hết hạn ({used.length})</h2>
          <div className="space-y-2">
            {used.map((d) => (
              <div key={d.id} className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 opacity-60">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-700">{d.code}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {d.discount_type === 'percentage' ? `${d.discount_value}%` : formatPrice(d.discount_value)}
                      {d.is_used ? ' — Đã dùng' : ' — Hết hạn'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
