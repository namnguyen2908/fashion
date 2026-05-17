import { useState } from "react";
import axios from "axios";
import api from "../../services/api";

// ─────────────────────────────────────────────
// Floating Label Input Component (inline, không tách file riêng)
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

const validatePhone = (phone) =>
  /^[0-9]{9,11}$/.test(phone.replace(/\s/g, ""));

// ─────────────────────────────────────────────
// REGISTER PAGE
// ─────────────────────────────────────────────
export default function RegisterPage() {
  // ── State: form fields ──
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ── State: validation errors ──
  const [errors, setErrors] = useState({});

  // ── State: loading khi submit ──
  const [isLoading, setIsLoading] = useState(false);

  // ── State: thông báo server ──
  const [serverMsg, setServerMsg] = useState({ type: "", text: "" });



  const passwordRules = {
  minLength: password.length >= 8,
  uppercase: /[A-Z]/.test(password),
  lowercase: /[a-z]/.test(password),
  number: /[0-9]/.test(password),
  special: /[^A-Za-z0-9]/.test(password),
};

  const isPasswordValid = Object.values(passwordRules).every(Boolean);


  // ────────────────────────────────────────────
  // Validate toàn bộ form
  // ────────────────────────────────────────────
  const validate = () => {
    const newErrors = {};

    if (!name.trim()) {
      newErrors.name = "Vui lòng nhập họ và tên của bạn.";
    } else if (name.trim().length < 2) {
      newErrors.name = "Họ và tên phải có ít nhất 2 ký tự.";
    }

    if (!phone) {
      newErrors.phone = "Vui lòng nhập số điện thoại.";
    } else if (!validatePhone(phone)) {
      newErrors.phone = "Số điện thoại không hợp lệ (9–11 chữ số).";
    }

    if (!email) {
      newErrors.email = "Vui lòng nhập địa chỉ email.";
    } else if (!validateEmail(email)) {
      newErrors.email = "Định dạng email không hợp lệ.";
    }

    if (!password) {
      newErrors.password = "Vui lòng nhập mật khẩu.";
    } else if (!isPasswordValid) {
      newErrors.password = "Mật khẩu chưa đáp ứng đầy đủ yêu cầu bảo mật.";
    }

    return newErrors;
  };

  // ────────────────────────────────────────────
  // Helper: xoá error của 1 field khi user gõ lại
  // ────────────────────────────────────────────
  const clearError = (field) => {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
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

    // Bật loading
    setIsLoading(true);

    try {
      // ── Gọi API Register (URL giả định) ──
      const response = await api.post("/api/auth/register", {
        name: name.trim(),
        phone: phone.replace(/\s/g, ""),
        email: email.trim(),
        password,
      });

      console.log("✅ Đăng ký thành công:", response.data);
      setServerMsg({
        type: "success",
        text: "Tài khoản đã được tạo thành công. Kiểm tra email để xác nhận.",
      });

      // TODO: Redirect hoặc auto-login
      // navigate("/verify-email");
    } catch (err) {
      console.error("❌ Đăng ký thất bại:", err);
      const msg =
        err?.response?.data?.message ||
        "Đăng ký thất bại. Email này có thể đã được sử dụng.";
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
      {/* ── TRÁI: Form đăng ký (đổi vị trí so với Login để tạo sự đa dạng) ── */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center
                      bg-[#faf9f7] px-8 sm:px-16 xl:px-24 py-16 order-2 lg:order-1">
        <div className="w-full max-w-[420px]">

          {/* Logo (hiện trên mobile) */}
          <div className="lg:hidden text-center mb-10">
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
              Tham gia cùng
              <br />
              <span className="italic">chúng tôi.</span>
            </h1>
            <p className="mt-3 text-[13px] tracking-[0.08em] text-[#9e9089] font-sans font-light">
              Tạo tài khoản để khám phá những bộ sưu tập độc quyền
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
          <form onSubmit={handleSubmit} noValidate className="space-y-7">

            {/* Name */}
            <FloatingInput
              id="reg-name"
              label="Họ và tên"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); clearError("name"); }}
              error={errors.name}
            />

            {/* Phone */}
            <FloatingInput
              id="reg-phone"
              label="Số điện thoại"
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); clearError("phone"); }}
              error={errors.phone}
            />

            {/* Email */}
            <FloatingInput
              id="reg-email"
              label="Địa chỉ email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
              error={errors.email}
            />

            {/* Password */}
            <FloatingInput
              id="reg-password"
              label="Mật khẩu (tối thiểu 6 ký tự)"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError("password"); }}
              error={errors.password}
            />

            {/* Strength indicator: hiển thị độ mạnh mật khẩu */}
            {password.length > 0 && (
              <div className="-mt-4 space-y-1">
                <div className="space-y-1 text-[11px] font-sans">
                  <p className={passwordRules.minLength ? "text-emerald-500" : "text-rose-400"}>
                    {passwordRules.minLength ? "✓" : "✗"} Ít nhất 8 ký tự
                  </p>

                  <p className={passwordRules.uppercase ? "text-emerald-500" : "text-rose-400"}>
                    {passwordRules.uppercase ? "✓" : "✗"} Có chữ in hoa
                  </p>

                  <p className={passwordRules.lowercase ? "text-emerald-500" : "text-rose-400"}>
                    {passwordRules.lowercase ? "✓" : "✗"} Có chữ thường
                  </p>

                  <p className={passwordRules.number ? "text-emerald-500" : "text-rose-400"}>
                    {passwordRules.number ? "✓" : "✗"} Có số
                  </p>

                  <p className={passwordRules.special ? "text-emerald-500" : "text-rose-400"}>
                    {passwordRules.special ? "✓" : "✗"} Có ký tự đặc biệt
                  </p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`
                w-full h-[52px] mt-1
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
                  <span>Đang tạo tài khoản...</span>
                </>
              ) : (
                "Tạo tài khoản"
              )}
            </button>
          </form>

          {/* Link sang Login */}
          <p className="mt-8 text-center text-[12px] tracking-wide font-sans text-[#9e9089]">
            Đã có tài khoản?{" "}
            <a
              href="/"
              className="text-[#1a1a1a] underline underline-offset-2 hover:text-[#5c4f45]
                         transition-colors duration-200 tracking-[0.05em]"
            >
              Đăng nhập ngay
            </a>
          </p>
        </div>
      </div>

      {/* ── PHẢI: Hình ảnh campaign ── */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden order-1 lg:order-2">
        <img
          src="https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1200&q=90&fit=crop"
          alt="Fashion Campaign"
          className="absolute inset-0 w-full h-full object-cover object-top scale-105
                     transition-transform duration-[8s] ease-out hover:scale-100"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-tl from-black/40 via-transparent to-black/20" />

        {/* Logo góc trên phải */}
        <div className="absolute top-10 right-12 text-white">
          <p
            className="text-2xl tracking-[0.3em] font-light"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            MAISON
          </p>
        </div>

        {/* Caption góc dưới */}
        <div className="absolute bottom-12 right-12 text-right text-white/80">
          <p className="text-[10px] tracking-[0.4em] uppercase mb-1 font-sans font-light">
            Phong cách
          </p>
          <p className="text-3xl tracking-[0.12em] font-light">Không giới hạn</p>
        </div>

        {/* Decorative corner element */}
        <div className="absolute top-24 right-12 w-[1px] h-16 bg-white/30" />
        <div className="absolute bottom-32 left-12 w-16 h-[1px] bg-white/30" />
      </div>
    </div>
  );
}