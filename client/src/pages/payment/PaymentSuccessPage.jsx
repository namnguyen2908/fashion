import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { paymentService } from '../../services/payment';

export default function PaymentSuccessPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrderDetail();
  }, [orderId]);

  const fetchOrderDetail = async () => {
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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Success Animation */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-6 animate-scale-in">
            <svg className="w-12 h-12 text-green-600 animate-check" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 animate-fade-in">Thanh toán thành công!</h1>
          <p className="text-gray-600 mt-2 animate-fade-in-delay">Cảm ơn bạn đã đặt hàng</p>
        </div>

        {/* Order Card */}
        {order && (
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-green-100 mb-6 animate-slide-up">
            <div className="flex justify-between items-start pb-4 border-b border-gray-100">
              <div>
                <p className="text-sm text-gray-500">Mã đơn hàng</p>
                <p className="text-xl font-bold text-gray-900">#{order.id}</p>
              </div>
              <span className="px-4 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                ✓ Đã thanh toán
              </span>
            </div>

            <div className="py-4 space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Tổng tiền</span>
                <span className="font-bold text-xl text-gray-900">{formatPrice(Number(order.total_amount))}</span>
              </div>
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
            </div>

            {/* Shipping Info */}
            <div className="pt-4 border-t border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-3">Thông tin giao hàng</h3>
              <div className="space-y-2 text-sm">
                <p className="text-gray-600">
                  <span className="font-medium text-gray-900">Người nhận:</span> {order.shipping_full_name}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium text-gray-900">Điện thoại:</span> {order.shipping_phone}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium text-gray-900">Địa chỉ:</span> {order.shipping_address}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Order Items */}
        {order?.items && order.items.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 mb-6 animate-slide-up-delay">
            <h3 className="font-semibold text-gray-900 mb-4">Sản phẩm đã đặt</h3>
            <div className="space-y-3">
              {order.items.map((item, index) => (
                <div key={index} className="flex gap-4 p-3 bg-gray-50 rounded-xl">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.product_name}</p>
                    <p className="text-sm text-gray-500">{item.color && `${item.color} / `}{item.size}</p>
                    <p className="text-sm text-gray-500">SL: {item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{formatPrice(Number(item.price) * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4 animate-fade-in-delay">
          <button
            onClick={() => navigate('/')}
            className="flex-1 py-4 px-6 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Tiếp tục mua sắm
          </button>
          <button
            onClick={() => navigate(`/orders/${orderId}`)}
            className="flex-1 py-4 px-6 border-2 border-black text-gray-900 rounded-xl font-semibold hover:bg-gray-50 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Xem chi tiết đơn
          </button>
        </div>

        {/* Support Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">Cần hỗ trợ?</p>
          <p className="text-sm text-gray-600">
            Liên hệ chúng tôi qua <span className="font-medium text-black">hotline@example.com</span>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes scale-in {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-up {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-scale-in {
          animation: scale-in 0.5s ease-out forwards;
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out 0.2s forwards;
          opacity: 0;
        }
        .animate-fade-in-delay {
          animation: fade-in 0.5s ease-out 0.4s forwards;
          opacity: 0;
        }
        .animate-slide-up {
          animation: slide-up 0.5s ease-out 0.3s forwards;
          opacity: 0;
        }
        .animate-slide-up-delay {
          animation: slide-up 0.5s ease-out 0.5s forwards;
          opacity: 0;
        }
        .animate-check {
          stroke-dasharray: 24;
          stroke-dashoffset: 24;
          animation: draw-check 0.5s ease-out 0.3s forwards;
        }
        @keyframes draw-check {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}