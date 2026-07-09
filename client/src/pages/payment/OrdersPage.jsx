import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentService } from '../../services/payment';

export default function OrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  useEffect(() => {
    fetchOrders();
  }, [page]);

  const fetchOrders = async () => {
    try {
      const { data } = await paymentService.getMyOrders(page, limit);
      if (data.success) {
        setOrders(data.data);
        setTotal(data.total);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getStatusBadge = (paymentStatus, status) => {
    if (paymentStatus === 'PAID') {
      return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">Đã thanh toán</span>;
    }
    if (status === 'CANCELLED') {
      return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">Đã hủy</span>;
    }
    return <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">Chờ thanh toán</span>;
  };

  const totalPages = Math.ceil(total / limit);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Đơn hàng của tôi</h1>
          <p className="text-gray-500 mt-2">Quản lý và theo dõi đơn hàng</p>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Chưa có đơn hàng nào</h2>
            <p className="text-gray-500 mb-6">Hãy mua sắm để tạo đơn hàng của bạn</p>
            <button
              onClick={() => navigate('/')}
              className="py-3 px-6 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-all"
            >
              Mua sắm ngay
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order, index) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all cursor-pointer transform hover:-translate-y-1"
                onClick={() => navigate(`/orders/${order.id}`)}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-sm text-gray-500">Mã đơn hàng</p>
                    <p className="text-lg font-bold text-gray-900">#{order.id}</p>
                  </div>
                  {getStatusBadge(order.payment_status, order.status)}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Ngày đặt</p>
                    <p className="font-medium text-gray-900">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-500">Tổng tiền</p>
                    <p className="font-bold text-lg text-gray-900">{formatPrice(Number(order.total_amount))}</p>
                  </div>
                </div>

                {order.payment_code && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-500">
                      Mã thanh toán: <span className="font-mono text-gray-700">{order.payment_code}</span>
                    </p>
                  </div>
                )}

                {order.payment_status !== 'PAID' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/payment/${order.id}`);
                    }}
                    className="mt-4 w-full py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-all"
                  >
                    Thanh toán ngay
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-all"
            >
              ← Trước
            </button>
            <span className="px-4 py-2 text-gray-600">
              Trang {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-all"
            >
              Sau →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}