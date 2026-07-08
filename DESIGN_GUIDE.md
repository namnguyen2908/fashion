# Design Guide — Maison Fashion

> Design system nội bộ cho frontend (admin + public).  
> Agent phải đọc file này trước khi chỉnh sửa giao diện.

---

## 1. Design DNA

- **Phong cách**: Tối giản, hiện đại, tập trung vào nội dung (content-first).
- **Cảm giác**: Sạch sẽ (clean), thanh lịch (refined), không trang trí thừa.
- **Tone giọng**: Trung tính, sang trọng nhẹ, chữ hoa nhỏ (uppercase) cho label.
- **Ảnh hưởng**: Apple / minimal editorial — không agency, không brutalist, không playful.

---

## 2. Color Palette

### 2.1 Neutral (Zinc family — Tailwind `neutral`)

| Token | Value | Usage |
|---|---|---|
| `bg-neutral-50` | `#fafafa` | Nền trang (page background) |
| `white` | `#ffffff` | Nền card, sidebar, input |
| `border-neutral-100` | `#f5f5f5` | Divider nhẹ, border phụ |
| `border-neutral-200` | `#e5e5e5` | Border chính (card, input, table) |
| `border-neutral-300` | `#d4d4d4` | Border outline button (hover) |
| `text-neutral-400` | `#a3a3a3` | Text mờ nhất (placeholder, meta phụ) |
| `text-neutral-500` | `#737373` | Label, meta text, description |
| `text-neutral-600` | `#525252` | Body text chính |
| `text-neutral-800` | `#262626` | Text đậm (heading phụ) |
| `text-neutral-900` / `black` | `#1a1a1a` | Text chính (heading), background button primary |

### 2.2 Accent — Black / Near-Black

Palette chỉ có **một màu nhấn**: `#1a1a1a` (near-black).  
Dùng cho button primary, active state sidebar, heading, border focus.

**Không dùng màu accent khác.** Toàn bộ UI chỉ có:
- Neutral (zinc)
- Đen (gần đen)
- Trắng
- Màu chức năng (đỏ lỗi, xanh thành công)

### 2.3 Functional Colors

| Token | Usage |
|---|---|
| `red-600` / `red-50` / `red-100` | Xoá, lỗi, danger |
| `rose-400` | Error message text (auth) |
| `emerald-50/400/500/700` | Success (confirmed) |

### 2.4 Auth Form Palette

Các trang auth (login, register, forgot-password) dùng palette riêng:

| Token | Value |
|---|---|
| `bg-[#faf9f7]` | Nền form |
| `border-[#c8c0b8]` | Border input dưới (default) |
| `text-[#9e9089]` | Text mờ (label, description) |
| `text-[#8c7f74]` | Label floating active |
| `text-[#1a1a1a]` | Input text + focus border |

### 2.5 Product Color Constants

File: `client/src/constants/colors.js` — 11 màu sản phẩm (đen, trắng, đỏ, xanh dương, v.v).

---

## 3. Typography

### 3.1 Font Stack

| Context | Font |
|---|---|
| Brand (Maison logo header/sidebar/footer) | `'Outfit', 'Segoe UI', system-ui, sans-serif` |
| Brand (MAISON uppercase auth logo) | `'Cormorant Garamond', serif` |
| Mặc định (body, admin) | Tailwind `font-sans` (system stack) |
| Mono (SKU, code) | `font-mono` (system stack) |

### 3.2 Font Loading

Font được load qua CDN trong `index.html` — **không dùng `next/font`** (React, không Next.js).

### 3.3 Text Size Map

| Context | Class | Size |
|---|---|---|
| Admin page heading | `text-xl sm:text-2xl font-medium tracking-tight` | 20/24px |
| Admin form label | `text-xs uppercase tracking-widest text-neutral-500` | 12px |
| Admin table header | `text-xs uppercase tracking-wider text-neutral-500` | 12px |
| Admin body | `text-sm` | 14px |
| Admin meta | `text-xs text-neutral-500` | 12px |
| Public product name (detail) | `text-xl sm:text-2xl lg:text-3xl font-medium tracking-tight` | 20/24/30px |
| Public product name (card) | `text-xs sm:text-sm font-light tracking-wide` | 12/14px |
| Public description | `text-sm text-neutral-600 leading-relaxed` | 14px |
| Auth title | `text-[32px] font-light` | 32px |
| Auth button | `text-[12px] tracking-[0.25em] uppercase font-sans font-light` | 12px |

### 3.4 Rules

- **Không dùng `Inter`** — dùng system stack hoặc Outfit cho brand.
- **Label = uppercase + tracking-widest + text-xs + text-neutral-500** (block form label).
- **Thẻ h1 trang admin:** `text-xl sm:text-2xl font-medium tracking-tight`.
- **Body text:** `text-sm text-neutral-600` (public) hoặc `text-sm` (admin).
- **Không dùng serif** cho body — chỉ dùng Cormorant Garamond cho "MAISON" logo auth.

---

## 4. Spacing & Layout

### 4.1 Page Container Width

| Page | Container |
|---|---|
| Public (header, carousel) | `max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8` |
| Product detail (public) | `max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8` |
| Admin (list pages) | `max-w-5xl mx-auto p-4 sm:p-6 lg:p-8` |
| Admin (form pages) | `max-w-3xl mx-auto p-4 sm:p-6 lg:p-8` |
| Auth form | `max-w-[400px] mx-auto` |
| Footer | `max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 lg:py-14` |

### 4.2 Section Spacing

- **Public sections:** `py-10 md:py-14 lg:py-16`
- **Nội dung admin:** cách heading `mb-6`
- **Khoảng cách form field:** `space-y-5` (CreateProduct step 1), `space-y-6` (step 2, 3)
- **Auth field spacing:** `space-y-8`

### 4.3 Card Pattern

```
bg-white border border-neutral-200 rounded-lg p-6 space-y-5
```

### 4.4 Table Container

```
bg-white border border-neutral-200 rounded-lg overflow-hidden
```

### 4.5 Empty State

```
text-center py-16 border border-dashed border-neutral-200 rounded-lg bg-white
```

### 4.6 Modal/Dialog

```
<Overlay>:  fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40
<Content>:  bg-white shadow-2xl rounded-lg border border-neutral-100 p-6 w-full max-w-sm
```

---

## 5. Component Tree

```
layouts/
├── PublicLayout.jsx       # Announcement bar + SiteHeader + Outlet + SiteFooter
└── AdminLayout.jsx        # AdminSidebar + Outlet container (with sidebar offset)

components/
├── SiteHeader.jsx         # Public header: logo, nav, search, icons
├── SiteFooter.jsx         # Public footer: links, copyright
├── Icons.jsx              # SVG icon set (Heroicons-style)
├── ProtectedRoute.jsx     # Route guard: kiểm tra role, redirect
└── admin/
    ├── AdminSidebar.jsx   # Sidebar cố định (fixed), nav links + logout
    ├── IconSpinner.jsx    # Loading spinner SVG
    ├── ColorSelect.jsx    # Dropdown chọn màu (single)
    └── ColorMultiSelect.jsx  # Grid toggle chọn màu (multiple)
```

### 5.1 Inline Components (tự định nghĩa trong page)

- `CategoryDashboard.jsx`: `ConfirmDialog`, `CategoryModal`
- `CreateProduct.jsx`: `StepProgressBar`, `TagInput`, `cartesianVariants`
- `ProductDetail.jsx`: `ConfirmDialog` (inline)

---

## 6. Form Elements

### 6.1 Input, Select, Textarea (Admin)

Class chuẩn — **dùng biến `inputClass`** trong component:

```js
const inputClass = "w-full border border-neutral-200 rounded-md px-4 py-2.5 text-sm outline-none focus:border-neutral-400 transition-colors";
```

| Thuộc tính | Giá trị |
|---|---|
| Border | `border border-neutral-200` |
| Radius | `rounded-md` (6px) |
| Padding | `px-4 py-2.5` |
| Font | `text-sm` |
| Focus | `focus:border-neutral-400` (chỉ đổi màu border) |
| Background | `bg-white` (select, input) |

Select thêm `bg-white`.

Textarea thêm `resize-y min-h-[100px]`.

### 6.2 Input (Auth — Floating Label)

Không dùng `inputClass`. Dùng pattern **floating label** riêng:

- Input: `peer w-full border-b bg-transparent pt-5 pb-1 px-0 text-[#1a1a1a] text-[15px] tracking-wide outline-none`
- Border default: `border-[#c8c0b8]`
- Border focus: `focus:border-[#1a1a1a]`
- Label: absolute positioning, peer-focus transform lên trên
- Underline effect: span absolute `w-0 peer-focus:w-full`

### 6.3 Button

| Loại | Class |
|---|---|
| Primary (admin) | `inline-flex items-center gap-2 px-5 py-2.5 text-sm bg-black text-white rounded-md hover:bg-neutral-800 disabled:opacity-60` |
| Outline (admin) | `px-5 py-2.5 text-sm border border-neutral-300 rounded-md hover:bg-neutral-50` |
| Danger (admin) | `text-sm text-red-600 border border-red-200 px-4 py-2 rounded-md hover:bg-red-50` |
| Ghost (text) | `px-5 py-2.5 text-sm text-neutral-600 hover:text-neutral-900` |
| Primary (auth) | `w-full h-[52px] bg-[#1a1a1a] text-white text-[12px] tracking-[0.25em] uppercase font-light` |
| Upload | `inline-flex items-center gap-2 px-5 py-2.5 text-sm border border-dashed border-neutral-300 rounded-md cursor-pointer hover:bg-neutral-50` |

### 6.4 Input States

- **Focus:** chỉ đổi border màu `neutral-400` — không dùng ring/shadow.
- **Disabled:** `opacity-60 cursor-not-allowed`.
- **Error:** border `red` / `rose`.
- **Placeholder:** mặc định Tailwind (neutral-400).

---

## 7. Navigation

### 7.1 Admin Sidebar

- **Width:** `w-60` (240px) → `lg:w-64` (256px)
- **Position:** `fixed left-0 top-0 h-screen z-40`
- **Content offset:** `md:ml-60 lg:ml-64`
- **Background:** `bg-white border-r border-neutral-200`
- **Nav link active:** `bg-neutral-900 text-white`
- **Nav link inactive:** `text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900`

### 7.2 Public Header

- **Height:** `py-3 sm:py-4` (khoảng 56-64px)
- **Container:** `max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8`
- **Background:** `bg-white border-b border-neutral-100`
- **Nav link:** `tracking-widest text-xs sm:text-sm font-medium hover:text-neutral-500 transition-colors uppercase`
- **Search input:** `rounded-full border px-4 py-2 pl-10 text-sm`

---

## 8. Responsive Breakpoints

Dùng mặc định Tailwind: `sm: 640, md: 768, lg: 1024, xl: 1280, 2xl: 1536`.

- **Mobile-first** — mặc định là mobile, class `sm:` / `md:` / `lg:` cho desktop.
- **Sidebar admin:** ẩn trên mobile (`hidden md:flex`).
- **Header nav public:** ẩn trên mobile (`hidden lg:flex`).
- **Padding responsive:** `p-4 sm:p-6 lg:p-8`.
- **Grid responsive:** mặc định 1-2 cột, lên 3-4 cột ở desktop.

---

## 9. Motion & Transitions

### 9.1 Transition Defaults

| Loại | Class |
|---|---|
| Mặc định (màu sắc) | `transition-colors` |
| Mặc định (all) | `transition-all duration-300` |
| Auth button | `transition-all duration-300` + `active:scale-[0.99]` |
| Carousel / wizard slide | `transition-transform duration-500 ease-out` (hoặc `ease-in-out`) |
| Category tree expand | `transition-[grid-template-rows] duration-300 ease-in-out` |

### 9.2 Hover Effects

- Button primary: `hover:bg-neutral-800`
- Button outline: `hover:bg-neutral-50`
- Nav link: `hover:text-neutral-500` (public), `hover:bg-neutral-100` (admin sidebar)
- Product card image: `hover:scale-105` (thêm `transition-transform duration-700`)

### 9.3 Rules

- **Chỉ animate `transform` và `opacity`** cho hiệu suất.
- **Không dùng `window.addEventListener('scroll')`** — dùng IntersectionObserver hoặc CSS transitions.
- **Tốc độ mặc định:** `duration-300` (ngắn, tinh tế). Chỉ dùng `duration-500`/`duration-700` cho slider/carousel.

---

## 10. Shared Components API

### IconSpinner
```jsx
<IconSpinner className="w-4 h-4" />  // default w-4 h-4
```
### ColorSelect
```jsx
<ColorSelect value={color} onChange={setColor} allowEmpty required />
```
### ColorMultiSelect
```jsx
<ColorMultiSelect label="Màu sắc" selected={colors} onChange={setColors} />
```

---

## 11. Icons

Dùng bộ icon dạng **Heroicons v2 outline** (SVG inline):

File: `client/src/components/Icons.jsx`
- `IconSearch`, `IconUser`, `IconBag`, `IconChevron`, `IconClose`, `IconMenu`

Pattern: SVG function, nhận `className` prop (default `"w-5 h-5"`), `stroke="currentColor"`, `strokeWidth={1.5}`.

**Không dùng thư viện icon ngoài.** Nếu cần icon mới, thêm vào file Icons.jsx theo pattern hiện tại.

---

## 12. Accessibility Rules

- **Label trên input** — không dùng placeholder làm label.
- **Form error** hiển thị dưới input (không dùng tooltip).
- **Modal:** `role="dialog"`, `aria-modal`, `aria-labelledby`, click overlay để đóng.
- **Confirm dialog:** `role="alertdialog"`.
- **Focus visible** trên tất cả interactive elements (dùng `outline-none` + custom focus style).
- **Icon buttons** cần `aria-label`.

---

## 13. Anti-Patterns (Cấm)

| Anti-pattern | Thay bằng |
|---|---|
| `h-screen` cho hero | `min-h-[100dvh]` |
| `calc()` phức tạp | CSS Grid |
| placeholder làm label | Label thật bên trên input |
| Cùng layout family 2+ section liên tiếp | Đổi layout xen kẽ |
| 3 card bằng nhau ngang hàng | Asymmetric grid, 2+1 split |
| spinner tròn generic | Skeleton loader matching layout |
| Màu `#000000` | `#1a1a1a` hoặc `neutral-900` |
| Inter làm font mặc định | System stack / Outfit |
