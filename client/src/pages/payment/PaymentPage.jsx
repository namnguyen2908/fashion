import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function PaymentPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [qrUrl, setQrUrl] = useState(null);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef(null);
  const mountedRef = useRef(true);

  const buildQrUrl = (info) => {
    return `https://vietqr.app/img?acc=${info.accountNumber}&bank=${info.bankName}&amount=${info.amount}&des=${encodeURIComponent(info.content)}`;
  };

  const checkPaymentStatus = useCallback(async () => {
    try {
      const { data } = await api.get(`/payment/status/${orderId}?_=${Date.now()}`);
      if (data.success && data.data.payment_status === 'PAID') {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        navigate(`/payment/success/${orderId}`);
      }
    } catch (err) {
      console.error('Failed to fetch payment status:', err);
    }
  }, [orderId, navigate]);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(checkPaymentStatus, 3000);
  }, [checkPaymentStatus]);

  const generateNewQR = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.post('/payment/generate-qr', { orderId });
      if (data.success) {
        setPaymentInfo(data.data);
        setQrUrl(data.data.qrUrl);
        startPolling();
      }
    } catch (err) {
      console.error('Failed to generate QR:', err);
      if (mountedRef.current) {
        setError(err.response?.data?.message || 'Không thể tạo mã thanh toán');
      }
    }
  }, [orderId, startPolling]);

  const fetchOrderAndPayment = useCallback(async () => {
    try {
      const { data: orderRes } = await api.get(`/orders/${orderId}`);
      if (orderRes.success) {
        const orderData = orderRes.data;
        if (!mountedRef.current) return;
        setOrder(orderData);

        if (orderData.payment_status === 'PAID') {
          navigate(`/payment/success/${orderId}`);
          return;
        }

        if (orderData.payment_code && orderData.bank_name && orderData.account_number) {
          const info = {
            paymentCode: orderData.payment_code,
            content: orderData.payment_content,
            amount: Number(orderData.total_amount),
            bankId: orderData.bank_id,
            bankName: orderData.bank_name,
            accountNumber: orderData.account_number,
          };
          setPaymentInfo(info);
          setQrUrl(buildQrUrl(info));
          startPolling();
        } else {
          await generateNewQR();
        }
      }
    } catch (err) {
      console.error('Failed to fetch order:', err);
      if (mountedRef.current) {
        setError('Không thể tải thông tin đơn hàng');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [orderId, navigate, generateNewQR, startPolling]);

  useEffect(() => {
    mountedRef.current = true;
    const init = async () => {
      await fetchOrderAndPayment();
    };
    init();
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchOrderAndPayment]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải thông tin...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Không tìm thấy đơn hàng</h2>
          <button
            onClick={() => navigate('/')}
            className="mt-4 py-3 px-6 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-all"
          >
            Về trang chủ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Thanh toán đơn hàng</h1>
          <p className="text-gray-500 mt-2">Mã đơn hàng: <span className="font-mono font-semibold">#{orderId}</span></p>
        </div>

        {/* Order Info Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 mb-6">
          <div className="flex justify-between items-center pb-4 border-b border-gray-100">
            <div>
              <p className="text-sm text-gray-500">Tổng tiền</p>
              <p className="text-2xl font-bold text-gray-900">{formatPrice(Number(order.total_amount))}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Ngày đặt</p>
              <p className="font-medium text-gray-900">{formatDate(order.created_at)}</p>
            </div>
          </div>
        </div>

        {/* QR Payment */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">Quét mã QR để thanh toán</h2>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
              {error}
              <button
                onClick={() => { setError(''); generateNewQR(); }}
                className="ml-2 underline font-medium"
              >
                Thử lại
              </button>
            </div>
          )}

          {!qrUrl && !error ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Đang tạo mã thanh toán...</p>
            </div>
          ) : qrUrl ? (
            <div className="space-y-6">
              {/* QR Code Display */}
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-2xl border-2 border-gray-100 shadow-inner">
                  <img
                    src={qrUrl}
                    alt="Payment QR Code"
                    className="w-64 h-64 object-contain"
                  />
                </div>
              </div>

              {/* Payment Details */}
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500 mb-1">Ngân hàng</p>
                  <p className="font-semibold text-gray-900">
                    {paymentInfo?.bankName} - {paymentInfo?.accountNumber}
                  </p>
                </div>

                <div
                  className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-all"
                  onClick={() => copyToClipboard(paymentInfo?.content)}
                >
                  <p className="text-sm text-gray-500 mb-1">Nội dung chuyển khoản</p>
                  <div className="flex items-center justify-between">
                    <p className="font-mono font-bold text-lg text-gray-900">{paymentInfo?.content}</p>
                    <span className="text-xs text-blue-600 font-medium">
                      {copied ? 'Đã copy!' : 'Copy'}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-green-50 rounded-xl">
                  <p className="text-sm text-gray-500 mb-1">Số tiền</p>
                  <p className="font-bold text-2xl text-green-700">{formatPrice(paymentInfo?.amount)}</p>
                </div>

                {paymentInfo?.paymentCode && (
                  <div className="p-4 bg-purple-50 rounded-xl">
                    <p className="text-sm text-gray-500 mb-1">Mã đơn</p>
                    <p className="font-mono font-bold text-lg text-gray-900">{paymentInfo?.paymentCode}</p>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <h3 className="font-semibold text-yellow-800 mb-2">Hướng dẫn thanh toán</h3>
                <ol className="text-sm text-yellow-800 space-y-1">
                  <li>1. Mở app ngân hàng (MB Bank, TPBank, Vietcombank...)</li>
                  <li>2. Chọn "Quét QR" và quét mã bên trên</li>
                  <li>3. Kiểm tra thông tin hiện ra (số tiền, nội dung)</li>
                  <li>4. Xác nhận chuyển tiền</li>
                  <li>5. Đợi hệ thống xác nhận (khoảng 5-10 giây)</li>
                </ol>
              </div>
            </div>
          ) : null}
        </div>

        {/* Waiting Animation */}
        {qrUrl && (
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-center gap-3 py-4">
              <div className="flex gap-1">
                <div className="w-3 h-3 bg-black rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-3 h-3 bg-black rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-3 h-3 bg-black rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            <span className="text-gray-600 font-medium">Đang chờ thanh toán...</span>
          </div>
          <p className="text-center text-sm text-gray-500">
            Hệ thống sẽ tự động cập nhật khi nhận được thanh toán
          </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex-1 py-3 px-6 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
          >
            Về trang chủ
          </button>
          <button
            onClick={() => navigate(`/orders/${orderId}`)}
            className="flex-1 py-3 px-6 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-all"
          >
            Xem chi tiết đơn
          </button>
        </div>
      </div>
    </div>
  );
}