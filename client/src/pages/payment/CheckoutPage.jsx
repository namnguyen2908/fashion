import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { paymentService } from '../../services/payment';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items: cart, loading: cartLoading, refreshCart } = useCart();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [discountError, setDiscountError] = useState('');
  const [validatingDisc, setValidatingDisc] = useState(false);
  const [myDiscounts, setMyDiscounts] = useState([]);

  const [formData, setFormData] = useState({
    shipping_full_name: '',
    shipping_phone: '',
    shipping_address: '',
    payment_method: 'BANK_TRANSFER',
  });

  // Calculate totals
  const subtotal = (cart && Array.isArray(cart)) ? cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0) : 0;
  const shipping = subtotal > 500000 ? 0 : 30000;
  const discountAmount = appliedDiscount ? appliedDiscount.discount_amount : 0;
  const total = Math.max(0, subtotal + shipping - discountAmount);

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) return;
    setValidatingDisc(true);
    setDiscountError('');
    try {
      const { data } = await paymentService.validateDiscount(discountCode.trim(), subtotal + shipping);
      if (data.success) {
        setAppliedDiscount(data.data);
      } else {
        setDiscountError(data.message || 'Mã không hợp lệ');
      }
    } catch (err) {
      setDiscountError(err.response?.data?.message || 'Lỗi kiểm tra mã');
    } finally {
      setValidatingDisc(false);
    }
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCode('');
    setDiscountError('');
  };

  // Fetch user's available discounts
  useEffect(() => {
    if (!isAuthenticated) return;
    paymentService.getMyDiscounts().then(({ data }) => {
      if (data.success) setMyDiscounts(data.data.filter(d => !d.is_used));
    }).catch(() => {});
  }, [isAuthenticated]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Transform cart items to order items format
      const items = cart.map(item => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
      }));

      const { data } = await api.post('/orders', {
        ...formData,
        items,
        discount_code: appliedDiscount ? appliedDiscount.code : undefined,
      });

      if (data.success) {
        // Clear cart via API and navigate to payment page
        await api.delete('/carts');
        refreshCart();
        navigate(`/payment/${data.data.id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  // Format currency
  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  if (cartLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!cart || cart.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Giỏ hàng trống</h2>
          <p className="text-gray-500 mb-6">Hãy thêm sản phẩm vào giỏ hàng trước khi thanh toán</p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 px-6 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-all duration-300"
          >
            Tiếp tục mua sắm
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Thanh toán</h1>
          <p className="text-gray-500 mt-2">Hoàn tất đơn hàng của bạn</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Shipping Info */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Thông tin giao hàng
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Họ và tên</label>
                  <input
                    type="text"
                    name="shipping_full_name"
                    value={formData.shipping_full_name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-black focus:ring-2 focus:ring-black/10 transition-all duration-200 outline-none"
                    placeholder="Nguyễn Văn A"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Số điện thoại</label>
                  <input
                    type="tel"
                    name="shipping_phone"
                    value={formData.shipping_phone}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-black focus:ring-2 focus:ring-black/10 transition-all duration-200 outline-none"
                    placeholder="0912345678"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Địa chỉ</label>
                  <textarea
                    name="shipping_address"
                    value={formData.shipping_address}
                    onChange={handleChange}
                    required
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-black focus:ring-2 focus:ring-black/10 transition-all duration-200 outline-none resize-none"
                    placeholder="123 Đường ABC, Quận 1, TP.HCM"
                  />
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 px-6 bg-black text-white rounded-xl font-semibold text-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Đang xử lý...
                    </span>
                  ) : (
                    'Đặt hàng ngay'
                  )}
                </button>
              </form>
            </div>

            {/* Cart Items Preview */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                Sản phẩm ({cart.length})
              </h2>

              <div className="space-y-4">
                {cart.map((item, index) => (
                  <div
                    key={item.variant_id || index}
                    className="flex gap-4 p-4 bg-gray-50 rounded-xl animate-fade-in"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{item.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {item.color && `${item.color} / `}{item.size}
                      </p>
                      <p className="text-sm text-gray-500">Số lượng: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 sticky top-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Tổng quan đơn hàng</h2>

              {/* Discount Input */}
              <div className="mb-6">
                {appliedDiscount ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-green-700">Mã giảm giá</p>
                      <p className="text-xs text-green-600">{appliedDiscount.code}</p>
                      <p className="text-xs text-green-500 mt-0.5">
                        -{formatPrice(appliedDiscount.discount_amount)}
                      </p>
                    </div>
                    <button
                      onClick={handleRemoveDiscount}
                      className="p-1.5 text-green-600 hover:text-green-800 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={discountCode}
                        onChange={(e) => setDiscountCode(e.target.value)}
                        placeholder="Nhập mã giảm giá"
                        className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-black transition-colors"
                      />
                      <button
                        onClick={handleApplyDiscount}
                        disabled={validatingDisc || !discountCode.trim()}
                        className="px-4 py-2.5 text-sm bg-black text-white rounded-xl hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {validatingDisc ? '...' : 'Áp dụng'}
                      </button>
                    </div>
                    {discountError && (
                      <p className="text-xs text-red-500 mt-1.5">{discountError}</p>
                    )}
                    {myDiscounts.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1.5">Mã của bạn:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {myDiscounts.slice(0, 3).map((d) => (
                            <button
                              key={d.id}
                              onClick={() => {
                                setDiscountCode(d.code);
                                paymentService.validateDiscount(d.code, subtotal + shipping).then(({ data }) => {
                                  if (data.success) setAppliedDiscount(data.data);
                                }).catch(() => {});
                              }}
                              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 transition-colors"
                            >
                              {d.code}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex justify-between text-gray-600">
                  <span>Tạm tính</span>
                  <span className="font-medium">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Phí vận chuyển</span>
                  <span className="font-medium">
                    {shipping === 0 ? (
                      <span className="text-green-600">Miễn phí</span>
                    ) : (
                      formatPrice(shipping)
                    )}
                  </span>
                </div>
                {shipping > 0 && (
                  <p className="text-xs text-gray-500">Miễn phí vận chuyển đơn hàng từ 500.000đ</p>
                )}
                {appliedDiscount && (
                  <div className="flex justify-between text-green-600">
                    <span>Giảm giá</span>
                    <span className="font-medium">-{formatPrice(discountAmount)}</span>
                  </div>
                )}
                <div className="border-t pt-4 flex justify-between text-xl font-bold text-gray-900">
                  <span>Tổng cộng</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Bảo đảm an toàn</p>
                    <p className="text-xs text-gray-500">Thông tin thanh toán được bảo mật</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}