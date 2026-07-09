import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { paymentService } from '../../services/payment';

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const fetchOrderDetail = useCallback(async () => {
    try {
      const { data } = await paymentService.getOrderDetail(orderId);
      if (data.success) {
        setOrder(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch order:', err);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrderDetail();
  }, [fetchOrderDetail]);

  // Auto-refresh when tab becomes visible (for unpaid orders)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchOrderDetail();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchOrderDetail]);

  const handleCancel = async () => {
    if (!confirm('Bạn có chắc muốn hủy đơn hàng này?')) return;
    try {
      setCancelling(true);
      const { data } = await paymentService.cancelOrder(orderId);
      if (data.success) {
        fetchOrderDetail();
      }
    } catch (err) {
      console.error('Cancel order error:', err);
    } finally {
      setCancelling(false);
    }
  };

  // Poll every 10s if order is not paid and not cancelled
  useEffect(() => {
    if (!order || order.payment_status === 'PAID' || order.status === 'CANCELLED') return;
    const interval = setInterval(fetchOrderDetail, 10000);
    return () => clearInterval(interval);
  }, [order, fetchOrderDetail]);

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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (paymentStatus, status) => {
    if (paymentStatus === 'PAID') {
      return <span className="px-4 py-2 bg-green-100 text-green-700 rounded-full font-medium">✓ Đã thanh toán</span>;
    }
    if (status === 'CANCELLED') {
      return <span className="px-4 py-2 bg-red-100 text-red-700 rounded-full font-medium">Đã hủy</span>;
    }
    if (status === 'CONFIRMED') {
      return <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full font-medium">Đã xác nhận</span>;
    }
    return <span className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-full font-medium">Chờ thanh toán</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Không tìm thấy đơn hàng</h2>
          <button
            onClick={() => navigate('/orders')}
            className="mt-4 py-3 px-6 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-all"
          >
            Xem danh sách đơn
          </button>
        </div>
      </div>
    );
  }

  const subtotal = order.items?.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0) || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/orders')}
          className="flex items-center gap-2 text-gray-600 hover:text-black mb-6 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Quay lại đơn hàng
        </button>

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500">Mã đơn hàng</p>
              <h1 className="text-2xl font-bold text-gray-900">#{order.id}</h1>
            </div>
            {getStatusBadge(order.payment_status, order.status)}
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Ngày đặt: {formatDate(order.created_at)}
          </div>
        </div>

        {/* Payment Info - Only show if not paid */}
        {order.payment_status !== 'PAID' && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl shadow-lg p-6 border border-yellow-200 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Chưa thanh toán</h2>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Số tiền cần thanh toán</p>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(Number(order.total_amount))}</p>
              </div>
              <button
                onClick={() => navigate(`/payment/${order.id}`)}
                className="py-3 px-6 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-all transform hover:scale-105"
              >
                Thanh toán ngay
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="py-3 px-6 border border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50 transition-all disabled:opacity-50"
              >
                {cancelling ? 'Đang hủy...' : 'Hủy đơn'}
              </button>
            </div>
          </div>
        )}

        {/* Order Items */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sản phẩm ({order.items?.length || 0})</h2>
          <div className="space-y-4">
              {order.items?.map((item, index) => (
                  <div key={index} className="flex gap-4 p-4 bg-gray-50 rounded-xl">
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{item.product_name}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {item.color && `${item.color} / `}{item.size}
                  </p>
                  <p className="text-sm text-gray-500">Số lượng: {item.quantity}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{formatPrice(Number(item.price) * item.quantity)}</p>
                  <p className="text-sm text-gray-500">{formatPrice(Number(item.price))} x {item.quantity}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="space-y-2">
              <div className="flex justify-between text-gray-600">
                <span>Tạm tính</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-gray-900">
                <span>Tổng cộng</span>
                <span>{formatPrice(Number(order.total_amount))}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Shipping Info */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Thông tin giao hàng</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <div>
                <p className="text-sm text-gray-500">Người nhận</p>
                <p className="font-medium text-gray-900">{order.shipping_full_name}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <div>
                <p className="text-sm text-gray-500">Số điện thoại</p>
                <p className="font-medium text-gray-900">{order.shipping_phone}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <p className="text-sm text-gray-500">Địa chỉ</p>
                <p className="font-medium text-gray-900">{order.shipping_address}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Details */}
        {order.payment_status === 'PAID' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Thông tin thanh toán</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Phương thức</span>
                <span className="font-medium text-gray-900">{order.payment_method || 'Chuyển khoản'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Thời gian thanh toán</span>
                <span className="font-medium text-gray-900">{formatDate(order.paid_at)}</span>
              </div>
              {order.transaction_id && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Mã giao dịch</span>
                  <span className="font-mono text-sm text-gray-900">{order.transaction_id}</span>
                </div>
              )}
              {order.payment_code && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Mã thanh toán</span>
                  <span className="font-mono text-sm text-gray-900">{order.payment_code}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}