import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import ProtectedRoute from './components/ProtectedRoute'
import { ADMIN_ROLES } from './constants/roles'
import PublicLayout from './layouts/PublicLayout';
import HomePage from './pages/HomePage';
import ProductDetailPage from './pages/products/ProductDetailPage';
import CartPage from './pages/cart/CartPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPassword from './pages/auth/ForgotPassword';
import CheckoutPage from './pages/payment/CheckoutPage';
import PaymentPage from './pages/payment/PaymentPage';
import PaymentSuccessPage from './pages/payment/PaymentSuccessPage';
import OrdersPage from './pages/payment/OrdersPage';
import OrderDetailPage from './pages/payment/OrderDetailPage';
import AdminLayout from './layouts/AdminLayout';
import CategoryDashboard from './pages/admin/CategoryDashboard';
import CreateProduct from './pages/admin/CreateProduct';
import ProductList from './pages/admin/ProductList';
import ProductDetail from './pages/admin/ProductDetail';

function App() {
  return (
    <AuthProvider>
      <CartProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/products/:slug" element={<ProductDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/payment/:orderId" element={<PaymentPage />} />
            <Route path="/payment/success/:orderId" element={<PaymentSuccessPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:orderId" element={<OrderDetailPage />} />
          </Route>
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<CategoryDashboard />} />
            <Route path="categories" element={<CategoryDashboard />} />
            <Route path="products" element={<ProductList />} />
            <Route path="products/create" element={<CreateProduct />} />
            <Route path="products/:id" element={<ProductDetail />} />
          </Route>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Routes>
      </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  )
}

export default App
