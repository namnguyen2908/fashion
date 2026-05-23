import { useState, useRef, useEffect } from "react";
import api from "../../services/api";

// ─────────────────────────────────────────────────────────────
// FLOATING LABEL INPUT (inline, không tách file)
// ─────────────────────────────────────────────────────────────
function FloatingInput({ id, label, type = "text", value, onChange, error }) {
  const [focused, setFocused] = useState(false);
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
          w-full border-b bg-transparent pt-5 pb-1 px-0
          text-[#1a1a1a] text-[15px] tracking-wide outline-none
          transition-all duration-300
          ${error
            ? "border-rose-400"
            : focused
            ? "border-[#1a1a1a]"
            : "border-[#c8c0b8]"}
        `}
      />

      {/* Floating label */}
      <label
        htmlFor={id}
        className={`
          absolute left-0 pointer-events-none
          transition-all duration-300 ease-out origin-left
          ${isFloating
            ? "top-0 text-[10px] tracking-[0.15em] uppercase text-[#8c7f74]"
            : "top-5 text-[14px] tracking-wide text-[#a89f97]"}
          ${error ? "!text-rose-400" : ""}
        `}
      >
        {label}
      </label>

      {/* Animated underline */}
      <span
        className={`
          absolute bottom-0 left-0 h-[1px] bg-[#1a1a1a]
          transition-all duration-300 ease-out
          ${focused ? "w-full" : "w-0"}
        `}
      />

      {error && (
        <p className="mt-1.5 text-[11px] tracking-wide text-rose-400 font-sans font-light">
          {error}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LOADING SPINNER (dùng lại ở các nút)
// ─────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-white/70"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="2" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// VALIDATE HELPERS
// ─────────────────────────────────────────────────────────────
const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT: ForgotPassword
// ─────────────────────────────────────────────────────────────
export default function ForgotPassword() {
  // ── Bước hiện tại: 0 | 1 | 2 (tương ứng Step 1 / 2 / 3) ──
  const [step, setStep] = useState(0);

  // ── Step 1: Email ──
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  // ── Step 2: OTP — lưu dạng mảng 6 phần tử ──
  const [otp, setOtp] = useState(Array(6).fill(""));
  const [otpError, setOtpError] = useState("");
  const otpRefs = useRef([]); // Refs cho 6 ô OTP để điều khiển focus

  // ── Step 3: Mật khẩu mới ──
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwErrors, setPwErrors] = useState({ newPassword: "", confirmPassword: "" });

  // ── Trạng thái loading chung ──
  const [isLoading, setIsLoading] = useState(false);

  // ── Thông báo server (lỗi tổng) ──
  const [serverMsg, setServerMsg] = useState({ type: "", text: "" });

  // ── Trạng thái thành công bước 3 ──
  const [resetSuccess, setResetSuccess] = useState(false);

  // ─────────────────────────────────────────────
  // CÁCH HOẠT ĐỘNG CỦA SLIDER:
  //
  // Container bên trong có width = 300% (3 panel x 100%)
  // Mỗi panel chiếm 1/3 container = 100% viewport của wrapper
  //
  // translateX được tính bằng:
  //   step 0 → translateX(0%)
  //   step 1 → translateX(-33.333...)%   → panel 2 vào view
  //   step 2 → translateX(-66.666...%)   → panel 3 vào view
  //
  // Tailwind không hỗ trợ giá trị phần trăm động nên dùng inline style
  // kết hợp class transition-transform duration-500 ease-out
  // ─────────────────────────────────────────────

  // ─────────────────────────────────────────────
  // STEP 1: Gửi email lấy OTP
  // ─────────────────────────────────────────────
  const handleSendOtp = async () => {
    setServerMsg({ type: "", text: "" });

    if (!email) {
      setEmailError("Vui lòng nhập địa chỉ email.");
      return;
    }
    if (!isValidEmail(email)) {
      setEmailError("Định dạng email không hợp lệ.");
      return;
    }
    setEmailError("");
    setIsLoading(true);

    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      console.log("✅ OTP đã gửi tới:", email);
      setStep(1); // → Slider trượt sang Step 2
    } catch (err) {
      console.error("❌ Gửi OTP thất bại:", err);
      setServerMsg({
        type: "error",
        text: err?.response?.data?.message || "Không tìm thấy tài khoản với email này.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────
  // STEP 2: Xử lý nhập OTP
  //
  // AUTO-FOCUS LOGIC:
  // - Khi gõ 1 số vào ô [i]: cập nhật otp[i], rồi gọi
  //   otpRefs.current[i+1]?.focus() để nhảy sang ô kế tiếp
  // - Khi bấm Backspace tại ô [i] (đang rỗng): xóa otp[i-1]
  //   và gọi otpRefs.current[i-1]?.focus() để quay lại ô trước
  // - Chỉ cho phép ký tự số (replace non-digit)
  // ─────────────────────────────────────────────
  const handleOtpChange = (e, index) => {
    const val = e.target.value.replace(/\D/g, ""); // Chỉ lấy số
    if (!val) return;

    const newOtp = [...otp];
    newOtp[index] = val[val.length - 1]; // Lấy ký tự cuối (tránh paste nhiều số)
    setOtp(newOtp);
    setOtpError("");

    // Auto-focus ô tiếp theo
    if (index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (e, index) => {
    if (e.key === "Backspace") {
      const newOtp = [...otp];
      if (otp[index]) {
        // Ô hiện tại có giá trị → xóa nó
        newOtp[index] = "";
        setOtp(newOtp);
      } else if (index > 0) {
        // Ô hiện tại rỗng → xóa ô trước và focus về đó
        newOtp[index - 1] = "";
        setOtp(newOtp);
        otpRefs.current[index - 1]?.focus();
      }
    }
  };

  // Khi dán (paste) cả chuỗi OTP
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newOtp = Array(6).fill("");
    pasted.split("").forEach((ch, i) => { newOtp[i] = ch; });
    setOtp(newOtp);
    // Focus vào ô cuối cùng được điền
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  // Gọi API verify OTP
  const handleVerifyOtp = async () => {
    const otpString = otp.join("");
    setServerMsg({ type: "", text: "" });

    if (otpString.length < 6) {
      setOtpError("Vui lòng nhập đủ 6 chữ số.");
      return;
    }
    setIsLoading(true);

    try {
      await api.post("/auth/verify-otp", {
        email: email.trim(),
        otp: otpString,
      });
      console.log("✅ OTP hợp lệ");
      setStep(2); // → Slider trượt sang Step 3
    } catch (err) {
      console.error("❌ OTP không hợp lệ:", err);
      setOtpError(err?.response?.data?.message || "Mã OTP không đúng hoặc đã hết hạn.");
    } finally {
      setIsLoading(false);
    }
  };

  // Gửi lại OTP
  const handleResendOtp = async () => {
    setOtp(Array(6).fill(""));
    setOtpError("");
    setServerMsg({ type: "", text: "" });
    setIsLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      setServerMsg({ type: "success", text: "Mã mới đã được gửi lại vào email của bạn." });
    } catch {
      setServerMsg({ type: "error", text: "Không thể gửi lại mã. Thử lại sau." });
    } finally {
      setIsLoading(false);
      // Focus ô OTP đầu tiên sau khi gửi lại
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  };

  // Auto-submit khi đủ 6 số
  useEffect(() => {
    if (step === 1 && otp.every((d) => d !== "") && !isLoading) {
      handleVerifyOtp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  // ─────────────────────────────────────────────
  // STEP 3: Đặt lại mật khẩu
  // ─────────────────────────────────────────────
  const handleResetPassword = async () => {
    setServerMsg({ type: "", text: "" });
    const errs = {};

    if (!newPassword) {
      errs.newPassword = "Vui lòng nhập mật khẩu mới.";
    } else if (newPassword.length < 6) {
      errs.newPassword = "Mật khẩu phải có ít nhất 6 ký tự.";
    }
    if (!confirmPassword) {
      errs.confirmPassword = "Vui lòng xác nhận mật khẩu.";
    } else if (newPassword !== confirmPassword) {
      errs.confirmPassword = "Mật khẩu xác nhận không khớp.";
    }

    if (Object.keys(errs).length > 0) {
      setPwErrors(errs);
      return;
    }
    setPwErrors({ newPassword: "", confirmPassword: "" });
    setIsLoading(true);

    try {
      await api.post("/auth/reset-password", {
        email: email.trim(),
        otp: otp.join(""),
        newPassword,
      });
      console.log("✅ Đặt lại mật khẩu thành công");
      setResetSuccess(true);
    } catch (err) {
      console.error("❌ Reset thất bại:", err);
      setServerMsg({
        type: "error",
        text: err?.response?.data?.message || "Không thể cập nhật mật khẩu. Vui lòng thử lại.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────
  // STEP INDICATOR — 3 chấm ở trên cùng
  // ─────────────────────────────────────────────
  const StepDots = () => (
    <div className="flex items-center gap-2 mb-10">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`
            rounded-full transition-all duration-500
            ${i === step
              ? "w-6 h-1.5 bg-[#1a1a1a]"
              : i < step
              ? "w-1.5 h-1.5 bg-[#9e9089]"
              : "w-1.5 h-1.5 bg-[#d9d3cd]"}
          `}
        />
      ))}
    </div>
  );

  // ─────────────────────────────────────────────
  // SERVER MESSAGE BANNER
  // ─────────────────────────────────────────────
  const ServerBanner = () =>
    serverMsg.text ? (
      <div
        className={`mb-6 px-4 py-3 text-[12px] tracking-wide font-sans font-light border-l-2
          ${serverMsg.type === "success"
            ? "border-emerald-400 text-emerald-700 bg-emerald-50"
            : "border-rose-400 text-rose-600 bg-rose-50"}`}
      >
        {serverMsg.text}
      </div>
    ) : null;

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex"
      style={{ fontFamily: " serif" }}
    >
      {/* ══════════════════════════════════════
          TRÁI: Hình ảnh campaign (cố định)
          ══════════════════════════════════════ */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200&q=90&fit=crop"
          alt="Fashion Campaign"
          className="absolute inset-0 w-full h-full object-cover object-center
                     scale-105 transition-transform duration-[10s] ease-out hover:scale-100"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/25 via-transparent to-black/55" />

        {/* Logo */}
        <div className="absolute top-10 left-12 text-white">
          <p className="text-2xl tracking-[0.3em] font-light">MAISON</p>
        </div>

        {/* Caption */}
        <div className="absolute bottom-12 left-12 text-white/80">
          <p className="text-[10px] tracking-[0.4em] uppercase mb-1 font-sans font-light">
            Tài khoản của bạn
          </p>
          <p className="text-3xl tracking-[0.1em] font-light leading-tight">
            Luôn được<br />
            <span className="italic">bảo vệ.</span>
          </p>
        </div>

        {/* Decorative lines */}
        <div className="absolute top-28 left-12 w-[1px] h-12 bg-white/25" />
        <div className="absolute bottom-32 right-12 w-12 h-[1px] bg-white/25" />
      </div>

      {/* ══════════════════════════════════════
          PHẢI: SLIDER CONTAINER
          overflow-hidden giấu các panel ngoài viewport
          ══════════════════════════════════════ */}
      <div className="w-full lg:w-1/2 bg-[#faf9f7] flex flex-col justify-center overflow-hidden relative">

        {/* ── INNER TRACK: width 300%, xếp 3 panel ngang ──
            translateX được điều khiển bởi state `step`:
              step=0 → 0%        (panel 1 hiển thị)
              step=1 → -33.333%  (panel 2 hiển thị)
              step=2 → -66.667%  (panel 3 hiển thị)
        */}
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{
            width: "300%",
            transform: `translateX(${-(step * 33.333)}%)`,
          }}
        >

          {/* ════════════════════════════════
              PANEL 1 — NHẬP EMAIL
              chiếm 1/3 track = 100% viewport
          ════════════════════════════════ */}
          <div
            className="flex justify-center items-center px-8 sm:px-16 xl:px-24 py-16"
            style={{ width: "33.333%" }}
          >
            <div className="w-full max-w-[400px]">
              {/* Logo mobile */}
              <div className="lg:hidden text-center mb-10">
                <p className="text-3xl tracking-[0.35em] text-[#1a1a1a]">MAISON</p>
              </div>

              <StepDots />

              <div className="mb-10">
                <h1 className="text-[30px] font-light text-[#1a1a1a] tracking-wide leading-tight">
                  Khôi phục<br />
                  <span className="italic">mật khẩu.</span>
                </h1>
                <p className="mt-3 text-[13px] tracking-[0.06em] text-[#9e9089] font-sans font-light">
                  Nhập email đã đăng ký — chúng tôi sẽ gửi mã xác thực ngay.
                </p>
              </div>

              <ServerBanner />

              <div className="space-y-8">
                <FloatingInput
                  id="forgot-email"
                  label="Địa chỉ email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  error={emailError}
                />

                <button
                  onClick={handleSendOtp}
                  disabled={isLoading}
                  className={`
                    w-full h-[52px] bg-[#1a1a1a] text-white
                    text-[12px] tracking-[0.25em] uppercase font-sans font-light
                    flex items-center justify-center gap-3
                    transition-all duration-300
                    ${isLoading ? "opacity-60 cursor-not-allowed" : "hover:bg-[#333] active:scale-[0.99]"}
                  `}
                >
                  {isLoading ? (
                    <><Spinner /><span>Đang gửi...</span></>
                  ) : (
                    "Gửi mã xác thực"
                  )}
                </button>
              </div>

              <div className="mt-8 text-center">
                <a
                  href="/"
                  className="text-[11px] tracking-[0.12em] text-[#9e9089] font-sans
                             hover:text-[#1a1a1a] transition-colors duration-200
                             underline underline-offset-2"
                >
                  ← Quay lại đăng nhập
                </a>
              </div>
            </div>
          </div>

          {/* ════════════════════════════════
              PANEL 2 — NHẬP OTP
          ════════════════════════════════ */}
          <div
            className="flex justify-center items-center px-8 sm:px-16 xl:px-24 py-16"
            style={{ width: "33.333%" }}
          >
            <div className="w-full max-w-[400px]">
              <StepDots />

              <div className="mb-10">
                <h1 className="text-[30px] font-light text-[#1a1a1a] tracking-wide leading-tight">
                  Nhập mã<br />
                  <span className="italic">xác thực.</span>
                </h1>
                <p className="mt-3 text-[13px] tracking-[0.06em] text-[#9e9089] font-sans font-light leading-relaxed">
                  Mã gồm 6 chữ số đã được gửi đến
                  <br />
                  <span className="text-[#5c4f45] tracking-wide">{email}</span>
                </p>
              </div>

              <ServerBanner />

              {/* ── 6 Ô OTP ──
                  Mỗi ô: ref lưu vào otpRefs.current[i]
                  onChange → auto-focus next
                  onKeyDown → Backspace → auto-focus prev
                  onPaste → điền toàn bộ
              */}
              <div className="flex gap-3 justify-between mb-2">
                {otp.map((digit, i) => (
                  <div key={i} className="relative flex-1">
                    <input
                      ref={(el) => (otpRefs.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(e, i)}
                      onKeyDown={(e) => handleOtpKeyDown(e, i)}
                      onPaste={i === 0 ? handleOtpPaste : undefined}
                      className={`
                        w-full h-14 text-center text-[22px] font-light tracking-wider
                        border-b-2 bg-transparent outline-none
                        text-[#1a1a1a] transition-all duration-200
                        ${otpError
                          ? "border-rose-400"
                          : digit
                          ? "border-[#1a1a1a]"
                          : "border-[#c8c0b8] focus:border-[#1a1a1a]"}
                        caret-transparent
                      `}
                    />
                    {/* Dot placeholder khi ô trống */}
                    {!digit && (
                      <span className="absolute inset-0 flex items-end justify-center pb-3
                                       pointer-events-none text-[#d9d3cd] text-[8px]">
                        ●
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {otpError && (
                <p className="mb-4 text-[11px] tracking-wide text-rose-400 font-sans">
                  {otpError}
                </p>
              )}

              <button
                onClick={handleVerifyOtp}
                disabled={isLoading}
                className={`
                  w-full h-[52px] mt-6 bg-[#1a1a1a] text-white
                  text-[12px] tracking-[0.25em] uppercase font-sans font-light
                  flex items-center justify-center gap-3
                  transition-all duration-300
                  ${isLoading ? "opacity-60 cursor-not-allowed" : "hover:bg-[#333] active:scale-[0.99]"}
                `}
              >
                {isLoading ? (
                  <><Spinner /><span>Đang xác thực...</span></>
                ) : (
                  "Xác nhận mã"
                )}
              </button>

              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={handleResendOtp}
                  disabled={isLoading}
                  className="text-[11px] tracking-[0.1em] font-sans text-[#9e9089]
                             hover:text-[#1a1a1a] transition-colors duration-200
                             underline underline-offset-2 disabled:opacity-40"
                >
                  Gửi lại mã
                </button>
                <button
                  onClick={() => {
                    setStep(0);
                    setOtp(Array(6).fill(""));
                    setOtpError("");
                    setServerMsg({ type: "", text: "" });
                  }}
                  className="text-[11px] tracking-[0.1em] font-sans text-[#9e9089]
                             hover:text-[#1a1a1a] transition-colors duration-200"
                >
                  ← Đổi email
                </button>
              </div>
            </div>
          </div>

          {/* ════════════════════════════════
              PANEL 3 — ĐẶT LẠI MẬT KHẨU
          ════════════════════════════════ */}
          <div
            className="flex justify-center items-center px-8 sm:px-16 xl:px-24 py-16"
            style={{ width: "33.333%" }}
          >
            <div className="w-full max-w-[400px]">
              <StepDots />

              {!resetSuccess ? (
                <>
                  <div className="mb-10">
                    <h1 className="text-[30px] font-light text-[#1a1a1a] tracking-wide leading-tight">
                      Tạo mật khẩu<br />
                      <span className="italic">mới.</span>
                    </h1>
                    <p className="mt-3 text-[13px] tracking-[0.06em] text-[#9e9089] font-sans font-light">
                      Mật khẩu mới phải có ít nhất 6 ký tự.
                    </p>
                  </div>

                  <ServerBanner />

                  <div className="space-y-8">
                    <FloatingInput
                      id="new-password"
                      label="Mật khẩu mới"
                      type="password"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (pwErrors.newPassword)
                          setPwErrors((p) => ({ ...p, newPassword: "" }));
                      }}
                      error={pwErrors.newPassword}
                    />

                    <FloatingInput
                      id="confirm-password"
                      label="Xác nhận mật khẩu mới"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (pwErrors.confirmPassword)
                          setPwErrors((p) => ({ ...p, confirmPassword: "" }));
                      }}
                      error={pwErrors.confirmPassword}
                    />

                    {/* Password match indicator */}
                    {confirmPassword.length > 0 && (
                      <div className={`flex items-center gap-2 -mt-4 text-[11px] font-sans tracking-wide
                        ${newPassword === confirmPassword ? "text-emerald-600" : "text-[#b8b0a8]"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-300
                          ${newPassword === confirmPassword ? "bg-emerald-500" : "bg-[#d9d3cd]"}`} />
                        {newPassword === confirmPassword ? "Mật khẩu khớp" : "Chưa khớp"}
                      </div>
                    )}

                    <button
                      onClick={handleResetPassword}
                      disabled={isLoading}
                      className={`
                        w-full h-[52px] bg-[#1a1a1a] text-white
                        text-[12px] tracking-[0.25em] uppercase font-sans font-light
                        flex items-center justify-center gap-3
                        transition-all duration-300
                        ${isLoading ? "opacity-60 cursor-not-allowed" : "hover:bg-[#333] active:scale-[0.99]"}
                      `}
                    >
                      {isLoading ? (
                        <><Spinner /><span>Đang cập nhật...</span></>
                      ) : (
                        "Cập nhật mật khẩu"
                      )}
                    </button>
                  </div>
                </>
              ) : (
                /* ── Trạng thái thành công ── */
                <div className="text-center py-8">
                  {/* Icon checkmark */}
                  <div className="w-16 h-16 rounded-full bg-[#f0ece8] flex items-center
                                  justify-center mx-auto mb-8">
                    <svg className="w-7 h-7 text-[#5c4f45]" fill="none" viewBox="0 0 24 24"
                         stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>

                  <h2 className="text-[26px] font-light text-[#1a1a1a] tracking-wide mb-3">
                    Thành công!
                  </h2>
                  <p className="text-[13px] tracking-[0.06em] text-[#9e9089] font-sans font-light
                                leading-relaxed mb-10">
                    Mật khẩu của bạn đã được cập nhật.<br />
                    Vui lòng đăng nhập lại để tiếp tục.
                  </p>

                  <a
                    href="/login"
                    className="
                      inline-flex items-center justify-center
                      w-full h-[52px] bg-[#1a1a1a] text-white
                      text-[12px] tracking-[0.25em] uppercase font-sans font-light
                      hover:bg-[#333] transition-all duration-300 active:scale-[0.99]
                    "
                  >
                    Đăng nhập ngay
                  </a>

                  {/* Decorative divider */}
                  <div className="mt-8 flex items-center gap-4">
                    <div className="flex-1 h-px bg-[#e2ddd9]" />
                    <span className="text-[#d9d3cd] text-lg font-light italic">✦</span>
                    <div className="flex-1 h-px bg-[#e2ddd9]" />
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
        {/* ── end inner track ── */}

        {/* Footer */}
        <p className="absolute bottom-6 left-0 right-0 text-center
                      text-[10px] tracking-[0.12em] text-[#c4bcb5] font-sans uppercase">
          © 2025 Maison. Mọi quyền được bảo lưu.
        </p>
      </div>
    </div>
  );
}