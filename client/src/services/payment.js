import api from './api';

export const paymentService = {
  // Create new order
  createOrder: (orderData) => api.post('/orders', orderData),

  // Get user's orders
  getMyOrders: (page = 1, limit = 10) => api.get(`/orders?page=${page}&limit=${limit}`),

  // Get order detail
  getOrderDetail: (orderId) => api.get(`/orders/${orderId}`),
  cancelOrder: (orderId) => api.put(`/orders/${orderId}/cancel`),
  getMyDiscounts: () => api.get('/discounts/my'),
  validateDiscount: (code, orderTotal) => api.post('/discounts/validate', { code, order_total: orderTotal }),

  // Generate payment QR
  generatePaymentQR: (orderId) => api.post('/payment/generate-qr', { orderId }),

  // Get payment status
  getPaymentStatus: (orderId) => api.get(`/payment/status/${orderId}`),
};