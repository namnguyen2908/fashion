import { useState, useEffect } from "react";
import api from "../../services/api";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { isAdminRole } from "../../constants/roles";

// ─────────────────────────────────────────────
// Floating Label Input Component (inline, no separate file)
// ─────────────────────────────────────────────
function FloatingInput({ id, label, type = "text", value, onChange, error }) {
  const [focused, setFocused] = useState(false);

  // Label nổi lên khi: đang focus HOẶC đã có giá trị
  const isFloating = focused || value.length > 0;

  return (
    <div className="relative w-full">
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete="off"
        className={`
          peer w-full border-b bg-transparent pt-5 pb-1 px-0
          text-[#1a1a1a] text-[15px] tracking-wide outline-none
          transition-all duration-300
          ${error ? "border-rose-400" : focused ? "border-[#1a1a1a]" : "border-[#c8c0b8]"}
        `}
      />
      {/* Floating Label */}
      <label
        htmlFor={id}
        className={`
          absolute left-0 pointer-events-none
          transition-all duration-300 ease-out origin-left
          ${isFloating
            ? "top-0 text-[10px] tracking-[0.15em] uppercase text-[#8c7f74]"
            : "top-5 text-[14px] tracking-wide text-[#a89f97]"
          }
          ${error ? "text-rose-400" : ""}
        `}
      >
        {label}
      </label>

      {/* Animated underline khi focus */}
      <span
        className={`
          absolute bottom-0 left-0 h-[1px] bg-[#1a1a1a]
          transition-all duration-400 ease-out
          ${focused ? "w-full" : "w-0"}
        `}
      />

      {/* Thông báo lỗi */}
      {error && (
        <p className="mt-1.5 text-[11px] tracking-wide text-rose-400 font-light">
          {error}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Validate helpers
// ─────────────────────────────────────────────
const validateEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const validatePassword = (password) => password.length >= 6;

// ─────────────────────────────────────────────
// LOGIN PAGE
// ─────────────────────────────────────────────
export default function LoginPage() {
  // ── State: form fields ──
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ── State: validation errors ──
  const [errors, setErrors] = useState({});

  // ── State: loading khi submit ──
  const [isLoading, setIsLoading] = useState(false);

  // ── State: thông báo server (thành công / lỗi tổng) ──
  const [serverMsg, setServerMsg] = useState({ type: "", text: "" });


  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, login } = useAuth();

  useEffect(() => {
    if (authLoading || !user) return;
    const from = location.state?.from?.pathname;
    if (from && (!from.startsWith("/admin") || isAdminRole(user.role))) {
      navigate(from, { replace: true });
    } else if (isAdminRole(user.role)) {
      navigate("/admin/products", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }, [authLoading, user, location.state, navigate]);
  // ────────────────────────────────────────────
  // Validate toàn bộ form, trả về object errors
  // ────────────────────────────────────────────
  const validate = () => {
    const newErrors = {};
    if (!email) {
      newErrors.email = "Vui lòng nhập địa chỉ email.";
    } else if (!validateEmail(email)) {
      newErrors.email = "Định dạng email không hợp lệ.";
    }
    if (!password) {
      newErrors.password = "Vui lòng nhập mật khẩu.";
    } else if (!validatePassword(password)) {
      newErrors.password = "Mật khẩu phải có ít nhất 6 ký tự.";
    }
    return newErrors;
  };

  // ────────────────────────────────────────────
  // Xử lý Submit
  // ────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault(); // Ngăn reload trang
    setServerMsg({ type: "", text: "" });

    // Client-side validation
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    // Bật trạng thái loading
    setIsLoading(true);

    try {
      // ── Gọi API Login (URL giả định) ──
      const response = await api.post("/auth/login", {
        email: email.trim(),
        password,
      });

      const user = response.data?.user;
      if (user) login(user);

      setServerMsg({ type: "success", text: "Đăng nhập thành công. Đang chuyển hướng..." });

      const from = location.state?.from?.pathname;
      if (from && (!from.startsWith("/admin") || isAdminRole(user?.role))) {
        navigate(from, { replace: true });
      } else if (isAdminRole(user?.role)) {
        navigate("/admin/products", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (err) {
      console.error("❌ Login thất bại:", err);
      const msg =
        err?.response?.data?.message ||
        "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.";
      setServerMsg({ type: "error", text: msg });
    } finally {
      // Tắt loading dù thành công hay thất bại
      setIsLoading(false);
    }
  };

  // ────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex"
    >
      {/* ── TRÁI: Hình ảnh campaign ── */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1200&q=90&fit=crop"
          alt="Fashion Campaign"
          className="absolute inset-0 w-full h-full object-cover object-center scale-105
                     transition-transform duration-[8s] ease-out hover:scale-100"
        />
        {/* Gradient overlay để tạo chiều sâu */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/30 via-transparent to-black/50" />

        {/* Logo góc trên */}
        <div className="absolute top-10 left-12 text-white">
          <p
            className="text-2xl tracking-[0.3em] font-light"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            MAISON
          </p>
        </div>
      </div>

      {/* ── PHẢI: Form đăng nhập ── */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center
                      bg-[#faf9f7] px-8 sm:px-16 xl:px-24 py-16">
        <div className="w-full max-w-[400px]">

          {/* Logo (hiện trên mobile) */}
          <div className="lg:hidden text-center mb-12">
            <p
              className="text-3xl tracking-[0.35em] text-[#1a1a1a]"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              MAISON
            </p>
          </div>

          {/* Tiêu đề */}
          <div className="mb-10">
            <h1
              className="text-[32px] font-light text-[#1a1a1a] tracking-wide leading-tight"
              style={{ letterSpacing: "0.04em" }}
            >
              Chào mừng
              <br />
              <span className="italic">trở lại.</span>
            </h1>
            <p className="mt-3 text-[13px] tracking-[0.08em] text-[#9e9089] font-sans font-light">
              Đăng nhập để tiếp tục hành trình của bạn
            </p>
          </div>

          {/* Thông báo server */}
          {serverMsg.text && (
            <div
              className={`mb-6 px-4 py-3 text-[12px] tracking-wide font-sans font-light border-l-2
                ${serverMsg.type === "success"
                  ? "border-emerald-400 text-emerald-700 bg-emerald-50"
                  : "border-rose-400 text-rose-600 bg-rose-50"
                }`}
            >
              {serverMsg.text}
            </div>
          )}

          {/* FORM */}
          <form onSubmit={handleSubmit} noValidate className="space-y-8">

            {/* Email */}
            <FloatingInput
              id="login-email"
              label="Địa chỉ email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
              }}
              error={errors.email}
            />

            {/* Password */}
            <FloatingInput
              id="login-password"
              label="Mật khẩu"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: "" }));
              }}
              error={errors.password}
            />

            {/* Quên mật khẩu */}
            <div className="flex justify-end -mt-4">
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="text-[11px] tracking-[0.1em] text-[#9e9089] hover:text-[#1a1a1a]
                           transition-colors duration-200 font-sans underline underline-offset-2 cursor-pointer"
              >
                Quên mật khẩu?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`
                w-full h-[52px] mt-2
                bg-[#1a1a1a] text-white text-[12px] tracking-[0.25em] uppercase font-sans font-light
                flex items-center justify-center gap-3
                transition-all duration-300
                ${isLoading
                  ? "opacity-60 cursor-not-allowed"
                  : "hover:bg-[#333] active:scale-[0.99]"
                }
              `}
            >
              {isLoading ? (
                <>
                  {/* Loading spinner */}
                  <svg
                    className="animate-spin h-4 w-4 text-white/70"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="2"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  <span>Đang xử lý...</span>
                </>
              ) : (
                "Đăng nhập"
              )}
            </button>
          </form>

          {/* Link sang Register */}
          <p className="mt-6 text-center text-[12px] tracking-wide font-sans text-[#9e9089]">
            Chưa có tài khoản?{" "}
            <Link to="/register" className="text-[#1a1a1a] underline underline-offset-2 hover:text-[#5c4f45] transition-colors duration-200 tracking-[0.05em]">
              Tạo tài khoản ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}