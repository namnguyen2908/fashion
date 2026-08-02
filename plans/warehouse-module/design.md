# Thiết kế Module Kho (Admin) — Procurement & Warehouse

> Giai đoạn hiện tại: **chỉ module admin**. Không nối với order khách, không trừ tồn khi bán, không công nợ/kế toán.
> Order, reservation, COGS khi bán, công nợ NCC → các phase sau.

---

## 1. Phạm vi

### Trong scope
- **Purchase Order (PO)** — đơn đặt hàng nhà cung cấp. **KHÔNG bắt buộc**: vẫn cho phép nhập kho trực tiếp (GR không gắn PO) cho trường hợp đặc biệt (hàng mẫu, nhập gấp, điều chỉnh ban đầu).
- **Goods Receipt (GR)** — phiếu nhập kho, vòng đời Draft → Completed → Cancelled. Chỉ Completed mới ghi sổ.
- **Stock Adjustment** — phiếu điều chỉnh tồn (tăng/giảm, kèm lý do).
- **Stock Count / Stock Take** — phiếu kiểm kê: snapshot → nhập số đếm → hoàn tất → tự sinh Stock Adjustment.
- **Transfer** — phiếu chuyển kho đầy đủ giữa nhiều kho (`transfer_orders` + `transfer_items`).
- **Giá vốn (current_cost)** — weighted average theo biến thể, lưu `inventory_costs`.
- **Inventory Ledger** — sổ cái `inventory_transactions` (append-only) + bảng số dư `inventory_balances` (on_hand / reserved).

### Ngoài scope (phase sau)
- Trừ tồn / reservation khi khách đặt hàng, COGS khi bán.
- Hóa đơn nhà cung cấp, thanh toán, công nợ.
- Giá vốn theo kho, báo cáo tài chính.

---

## 2. Tổng quan nghiệp vụ

```
Nhà cung cấp
   │  giá master: supplier_variants.cost_price
   ▼
Purchase Order (PO) ── DRAFT → CONFIRMED → RECEIVED / CANCELLED     (không bắt buộc)
   │  partial receiving: purchase_order_items.received_qty tăng theo mỗi GR completed
   ▼
Goods Receipt (GR) ── DRAFT → COMPLETED → CANCELLED
   │  po_id (nullable) — có PO thì lấy dòng từ PO, không thì nhập trực tiếp
   │  chỉ COMPLETED mới ghi sổ (tăng tồn + cập nhật giá vốn)
   ▼
Inventory Ledger (inventory_transactions) ──► inventory_balances (số dư) + inventory_costs (giá vốn)

Các nghiệp vụ khác cũng ghi sổ:
  Stock Adjustment ──► ADJUSTMENT   (không đổi giá vốn)
  Stock Count/Take  ──► sinh Stock Adjustment ──► ADJUSTMENT (không đổi giá vốn)
  Transfer          ──► TRANSFER (xuất − / nhập +, không đổi giá vốn)
```

**Nguyên tắc cốt lõi:** mọi thay đổi tồn kho đều đi qua `inventory_transactions` (sổ cái append-only). `inventory_balances` chỉ là bảng số dư, cập nhật trong cùng một giao dịch DB. Chứng từ là nguồn gốc, ghi sổ là hệ quả.

---

## 3. Mô hình dữ liệu

### 3.1 Bảng mới

#### `purchase_orders` — Đơn đặt hàng nhà cung cấp
| Cột | Loại | Ghi chú |
|---|---|---|
| id | BIGSERIAL | PK |
| po_code | VARCHAR(50) UNIQUE NOT NULL | `PO-2026-000001` (qua `document_sequences`) |
| supplier_id | INT FK → suppliers | |
| warehouse_id | INT FK → warehouses | kho nhận hàng |
| status | VARCHAR(20) DEFAULT 'DRAFT' | `DRAFT` / `CONFIRMED` / `RECEIVED` / `CANCELLED` |
| expected_date | DATE | |
| notes | TEXT | |
| created_by | INT FK → users | |
| created_at / updated_at | TIMESTAMPTZ | |

#### `purchase_order_items` — Chi tiết đơn đặt
| Cột | Loại | Ghi chú |
|---|---|---|
| id | BIGSERIAL | PK |
| po_id | INT FK → purchase_orders (CASCADE) | |
| variant_id | INT FK → product_variants | |
| quantity | INT CHECK (> 0) | |
| unit_price | DECIMAL(12,2) NOT NULL | prefill từ supplier_variants.cost_price |
| received_qty | INT DEFAULT 0 CHECK (>= 0) | cộng dồn từ GR completed |
| created_at | TIMESTAMPTZ | |
| — | UNIQUE(po_id, variant_id) | |
| — | CHECK (received_qty <= quantity) | chặn nhận vượt đơn |

#### `inventory_costs` — Giá vốn hiện hành của biến thể (weighted average, toàn hệ thống)
| Cột | Loại | Ghi chú |
|---|---|---|
| id | BIGSERIAL | PK |
| variant_id | INT UNIQUE FK → product_variants | 1 biến thể 1 dòng |
| current_cost | DECIMAL(12,2) DEFAULT 0 | bình quân gia quyền |
| updated_at | TIMESTAMPTZ | |

#### `stock_adjustments` — Phiếu điều chỉnh tồn
| Cột | Loại | Ghi chú |
|---|---|---|
| id | BIGSERIAL | PK |
| adjustment_code | VARCHAR(50) UNIQUE NOT NULL | `DCNH-2026-000001` |
| warehouse_id | INT FK → warehouses | |
| reason | VARCHAR(255) NOT NULL | lý do — bắt buộc |
| source | VARCHAR(20) DEFAULT 'MANUAL' | `MANUAL` / `STOCK_COUNT` (phiếu do kiểm kê sinh ra) |
| status | VARCHAR(20) DEFAULT 'DRAFT' | `DRAFT` / `COMPLETED` |
| created_by | INT FK → users | |
| created_at / completed_at | TIMESTAMPTZ | |

#### `stock_adjustment_items` — Dòng điều chỉnh
| Cột | Loại | Ghi chú |
|---|---|---|
| id | BIGSERIAL | PK |
| adjustment_id | INT FK → stock_adjustments (CASCADE) | |
| variant_id | INT FK → product_variants | |
| quantity | INT CHECK (<> 0) | dương = tăng, âm = giảm |
| note | TEXT | |

#### `stock_count_sessions` — Đợt kiểm kê
| Cột | Loại | Ghi chú |
|---|---|---|
| id | BIGSERIAL | PK |
| count_code | VARCHAR(50) UNIQUE NOT NULL | `KK-2026-000001` |
| warehouse_id | INT FK → warehouses | kiểm kê theo kho |
| status | VARCHAR(20) DEFAULT 'DRAFT' | `DRAFT` / `IN_PROGRESS` / `COMPLETED` / `CANCELLED` |
| adjustment_id | INT FK → stock_adjustments | phiếu điều chỉnh được sinh khi hoàn tất |
| notes | TEXT | |
| created_by | INT FK → users | |
| created_at / completed_at | TIMESTAMPTZ | |

#### `stock_count_items` — Dòng kiểm kê
| Cột | Loại | Ghi chú |
|---|---|---|
| id | BIGSERIAL | PK |
| session_id | INT FK → stock_count_sessions (CASCADE) | |
| variant_id | INT FK → product_variants | |
| system_qty | INT | tồn sổ sách **tại thời điểm tạo phiếu** — lưu để audit |
| counted_qty | INT | số đếm thực tế (nhập) |
| difference | INT | = counted_qty − on_hand hiện tại, tính lúc hoàn tất — lưu để audit |
| — | UNIQUE(session_id, variant_id) | |

#### `transfer_orders` — Phiếu chuyển kho
| Cột | Loại | Ghi chú |
|---|---|---|
| id | BIGSERIAL | PK |
| transfer_code | VARCHAR(50) UNIQUE NOT NULL | `CN-2026-000001` |
| from_warehouse_id | INT FK → warehouses | kho nguồn |
| to_warehouse_id | INT FK → warehouses | kho đích |
| status | VARCHAR(20) DEFAULT 'DRAFT' | `DRAFT` / `COMPLETED` |
| notes | TEXT | |
| created_by | INT FK → users | |
| created_at / completed_at | TIMESTAMPTZ | |
| — | CHECK (from_warehouse_id <> to_warehouse_id) | |

#### `transfer_items` — Dòng chuyển kho
| Cột | Loại | Ghi chú |
|---|---|---|
| id | BIGSERIAL | PK |
| transfer_order_id | INT FK → transfer_orders (CASCADE) | |
| variant_id | INT FK → product_variants | |
| quantity | INT CHECK (> 0) | |
| created_at | TIMESTAMPTZ | |
| — | UNIQUE(transfer_order_id, variant_id) | |

#### `document_sequences` — Sinh mã chứng từ tuần tự
| Cột | Loại | Ghi chú |
|---|---|---|
| id | BIGSERIAL | PK |
| prefix | VARCHAR(10) | `PO`, `PN`, `DCNH`, `KK`, `CN` |
| year | INT | |
| seq | INT | |
| — | UNIQUE(prefix, year) | |

### 3.2 Bảng hiện có — sửa đổi

#### `goods_receipts` (sửa)
| Thay đổi | Ghi chú |
|---|---|
| + `po_id INT NULL FK → purchase_orders` | **KHÔNG bắt buộc** — NULL = nhập trực tiếp |
| + `receipt_date DATE` | ngày nhận thực tế (mặc định hôm nay) |
| `status` đổi ngữ nghĩa | `DRAFT` / `COMPLETED` / `CANCELLED` |
| bỏ cột legacy `supplier VARCHAR` | đã có `supplier_id` |
| giữ nguyên | `receipt_code`, `supplier_id`, `warehouse_id`, `created_by`, `notes`, `created_at` |

#### `goods_receipt_items` (sửa)
| Thay đổi | Ghi chú |
|---|---|
| + `po_item_id INT NULL FK → purchase_order_items` | NULL khi nhập trực tiếp không qua PO |
| giữ nguyên | `goods_receipt_id`, `variant_id`, `quantity`, `unit_cost`, `created_at` |

#### `inventory_balances` (sửa — chuẩn bị cho reservation)
| Thay đổi | Ghi chú |
|---|---|
| rename `stock_qty` → `on_hand` | INT NOT NULL DEFAULT 0 |
| + `reserved INT NOT NULL DEFAULT 0` | **chưa dùng ở phase này** |
| + CHECK (`on_hand >= 0`), CHECK (`reserved >= 0`) | |
| giữ nguyên | `warehouse_id`, `variant_id`, UNIQUE(warehouse_id, variant_id), `updated_at` |
| (quy ước) | `available = on_hand − reserved` — chỉ tính trong query, không lưu |

#### `inventory_transactions` (sửa — giữ tối giản)
| Cột | Ghi chú |
|---|---|
| id | PK |
| warehouse_id | FK → warehouses |
| variant_id | FK → product_variants |
| qty_change | ± (nhập +, xuất −) |
| qty_before | **THÊM** — tồn trước giao dịch |
| qty_after | **đổi tên từ `balance_after`** — tồn sau giao dịch |
| unit_cost | giá của giao dịch (GR: giá nhập; còn lại null) |
| ref_type | `GOODS_RECEIPT` / `ADJUSTMENT` / `TRANSFER` |
| ref_id | id chứng từ gốc |
| created_by | FK → users |
| note | ghi chú / mã chứng từ |
| created_at | |

**Bất biến:** append-only (chỉ INSERT). **Không có** `cost_before`, `reversal_of_id`, `ref_line_id` ở phase này — idempotency dựa vào guarded status transition của chứng từ.

### 3.3 Permissions (bổ sung)
- `purchase:view`, `purchase:create` — đơn đặt hàng.
- `warehouse:view`, `warehouse:create` — phiếu nhập (đã có).
- `warehouse:adjust` — điều chỉnh + kiểm kê (đã có).
- `warehouse:transfer` — chuyển kho (đã có).

### 3.4 Quan hệ

```
suppliers ──┬─< purchase_orders ──< purchase_order_items ──(po_item_id)──< goods_receipt_items
            │        (warehouse_id)                                          │(goods_receipt_id)
            │                                                                ▼
            ├─< supplier_variants >────── product_variants               goods_receipts (po_id NULL được)
            │
            └─ (phase sau) supplier_invoices < payments

goods_receipts ──< goods_receipt_items ──(ghi sổ)──► inventory_transactions (GOODS_RECEIPT, ref_id = gr.id)
stock_adjustments ──< stock_adjustment_items ───────► inventory_transactions (ADJUSTMENT, ref_id = adj.id)
stock_count_sessions ──► sinh stock_adjustments ────► inventory_transactions (ADJUSTMENT)
transfer_orders ──< transfer_items ────────(2 chiều)► inventory_transactions (TRANSFER, ref_id = tr.id)
                                                               │
                                                               ▼
                                     inventory_balances (số dư) + inventory_costs (giá vốn)
```

---

## 4. Quy tắc ghi sổ & giá vốn

### 4.1 Chỉ "COMPLETED" mới ghi sổ
- PO: chỉ `CONFIRMED` mới được tạo GR.
- GR / Adjustment / Transfer: chỉ `COMPLETED` mới ghi sổ + cập nhật số dư.
- Chuyển trạng thái bằng **guarded update**:
  `UPDATE ... SET status='COMPLETED' WHERE id=$1 AND status='DRAFT'` → 0 row = đã xử lý → bỏ qua (chống trùng/race; đây là cơ chế idempotency chính ở phase này).

### 4.2 Giá vốn weighted average (toàn hệ thống)
- **Chỉ GR `COMPLETED` làm đổi `current_cost`.** Với từng dòng (tuần tự trong 1 transaction):
  ```
  on_hand_old = tổng on_hand của variant trên toàn hệ thống (trước nhập)
  new_cost = (on_hand_old × current_cost + quantity × unit_cost) / (on_hand_old + quantity)
  ```
  - Lô đầu tiên (chưa có tồn/giá): `new_cost = unit_cost`.
- **Adjustment / Stock Count / Transfer KHÔNG đổi giá vốn.**

### 4.3 Hủy GR (COMPLETED → CANCELLED) — đơn giản hóa
- **Điều kiện:** với mọi variant trong phiếu, **không được có giao dịch kho nào sau giao dịch GR của chính nó**. Nếu có → từ chối hủy, hướng dẫn dùng Stock Adjustment.
- Khi hủy được (1 transaction):
  - Ghi sổ đối ứng: `qty_change = −quantity`, `ref_type = ADJUSTMENT`, note = mã GR hủy.
  - Giảm `inventory_balances.on_hand`.
  - Trả lại `purchase_order_items.received_qty −= quantity` (nếu có po_item_id).
  - **KHÔNG khôi phục giá vốn** (`current_cost` giữ nguyên).
- Ghi chú: đây là đơn giản hóa có chủ đích — giá vốn có thể lệch nhẹ sau khi hủy, chấp nhận ở phase này. Phase sau (khi cần báo cáo tài chính) sẽ bổ sung `cost_before`/`reversal_of_id` nếu cần.

### 4.4 Stock Adjustment
- `DRAFT`: tạo phiếu (warehouse + **reason bắt buộc** + dòng ±), sửa/xóa tự do — chưa đụng tồn.
- `COMPLETED`: ghi sổ từng dòng `ADJUSTMENT`, cập nhật `on_hand`. Không đổi giá vốn. **Không hủy sau khi ghi sổ** — muốn đảo ngược thì tạo phiếu mới ngược dấu.
- `source` phân biệt điều chỉnh tay (`MANUAL`) vs do kiểm kê sinh (`STOCK_COUNT`).

### 4.5 Stock Count / Take
1. **Tạo phiếu** (`DRAFT`): chọn kho → **snapshot** `on_hand` từng variant vào `stock_count_items.system_qty` (lưu để audit).
2. **Nhập số đếm** (`IN_PROGRESS`): cập nhật `counted_qty`.
3. **Hoàn tất** (`COMPLETED`):
   - Với mỗi dòng: `difference = counted_qty − on_hand hiện tại` (tính theo tồn hiện tại → luôn đưa tồn về đúng số đếm thực tế; lưu `difference` để audit).
   - **Tự sinh một Stock Adjustment** (`source = STOCK_COUNT`, reason = "Kết quả kiểm kê <count_code>") gồm các dòng `difference ≠ 0`, đặt `status = COMPLETED` ngay, ghi sổ `ADJUSTMENT` và cập nhật `on_hand`.
   - Gắn `stock_count_sessions.adjustment_id` vào phiếu điều chỉnh đã sinh.
   - Không đổi giá vốn.
4. **Không chặn hoàn tất khi có biến động tồn trong lúc kiểm kê** — chênh lệch luôn tính trên tồn hiện tại nên kết quả vẫn nhất quán; snapshot `system_qty` giữ lại làm tài liệu đối chiếu.

### 4.6 Transfer (chuyển kho)
- `DRAFT`: tạo phiếu (from/to khác nhau, items), sửa/xóa tự do.
- `COMPLETED`: với mỗi dòng, trong 1 transaction:
  - Ghi sổ kho nguồn: `TRANSFER`, `qty_change = −quantity` (chặn tồn âm).
  - Ghi sổ kho đích: `TRANSFER`, `qty_change = +quantity`.
  - Cập nhật `on_hand` cả 2 kho. Không đổi giá vốn.
- Không hủy sau khi ghi sổ — đảo ngược bằng phiếu chuyển ngược chiều hoặc điều chỉnh.

### 4.7 Locking & concurrency
- Toàn bộ ghi sổ trong 1 DB transaction trên 1 connection.
- `SELECT ... FOR UPDATE` trên các dòng `inventory_balances` / `inventory_costs` liên quan → 2 phiếu cùng variant xử lý tuần tự, giá vốn không sai.
- Retry nếu deadlock (2–3 lần).

---

## 5. API (đầy đủ)

**Purchase Orders** — `routes/purchaseOrder.js`
- `POST /api/purchase-orders` — tạo DRAFT (supplier_id, warehouse_id, items[{variant_id, quantity, unit_price}])
- `GET /api/purchase-orders` — danh sách (search, status, phân trang)
- `GET /api/purchase-orders/:id` — chi tiết + items + received_qty
- `PUT /api/purchase-orders/:id` — sửa (chỉ DRAFT)
- `POST /api/purchase-orders/:id/confirm` — DRAFT → CONFIRMED
- `POST /api/purchase-orders/:id/cancel` — hủy (chỉ khi chưa có GR)

**Goods Receipts** — `routes/goodsReceipt.js`
- `POST /api/goods-receipts` — tạo DRAFT (`po_id` optional; có PO → lấy dòng từ PO còn thiếu, prefill giá = unit_price, SL ≤ còn thiếu; không PO → nhập tự do)
- `GET /api/goods-receipts` / `GET /api/goods-receipts/:id`
- `PUT /api/goods-receipts/:id` — sửa (chỉ DRAFT)
- `POST /api/goods-receipts/:id/complete` — ghi sổ + received_qty + giá vốn
- `POST /api/goods-receipts/:id/cancel` — hủy (theo quy tắc 4.3)

**Adjustment** — `routes/warehouse.js` (thay thế endpoint cũ ghi sổ trực tiếp)
- `POST /api/warehouse/adjustments` — tạo DRAFT (warehouse_id, reason, items[{variant_id, quantity}])
- `GET /api/warehouse/adjustments` / `GET /api/warehouse/adjustments/:id`
- `PUT /api/warehouse/adjustments/:id` — sửa (chỉ DRAFT)
- `POST /api/warehouse/adjustments/:id/complete` — ghi sổ

**Stock Count** — `routes/warehouse.js`
- `POST /api/warehouse/counts` — tạo DRAFT (warehouse_id) + snapshot items
- `GET /api/warehouse/counts` / `GET /api/warehouse/counts/:id`
- `PUT /api/warehouse/counts/:id/items/:itemId` — nhập counted_qty
- `POST /api/warehouse/counts/:id/complete` — tính diff → sinh Adjustment → ghi sổ
- `POST /api/warehouse/counts/:id/cancel` — hủy (chỉ DRAFT/IN_PROGRESS)

**Transfer** — `routes/warehouse.js` (thay thế endpoint ghi sổ trực tiếp)
- `POST /api/warehouse/transfers` — tạo DRAFT (from_warehouse_id, to_warehouse_id, items[{variant_id, quantity}])
- `GET /api/warehouse/transfers` / `GET /api/warehouse/transfers/:id`
- `PUT /api/warehouse/transfers/:id` — sửa (chỉ DRAFT)
- `POST /api/warehouse/transfers/:id/complete` — ghi sổ 2 chiều

**Inventory**
- `GET /api/warehouse/stocks` — tồn theo kho (on_hand, reserved, available)
- `GET /api/warehouse/stocks/:variantId` — tồn 1 variant theo từng kho
- `GET /api/warehouse/transactions` — sổ cái (filter variant/warehouse/ref_type, phân trang)
- `GET /api/warehouse/costs` — giá vốn theo variant
- `GET /api/warehouse/suppliers...` — giữ nguyên

---

## 6. Migration plan — Phase 1 (`migrations/018_create_procurement_module.sql`)

### 6.1 Bảng mới (tạo)
`purchase_orders`, `purchase_order_items`, `inventory_costs`, `stock_adjustments`, `stock_adjustment_items`, `stock_count_sessions`, `stock_count_items`, `transfer_orders`, `transfer_items`, `document_sequences` — theo cấu trúc mục 3.1.

### 6.2 Sửa bảng hiện có
- `goods_receipts`: `ADD COLUMN po_id INT NULL REFERENCES purchase_orders(id)`; `ADD COLUMN receipt_date DATE`; bỏ cột legacy `supplier` (nếu tồn tại); update `status` dữ liệu cũ `'completed'` → `'COMPLETED'`.
- `goods_receipt_items`: `ADD COLUMN po_item_id INT NULL REFERENCES purchase_order_items(id)`.
- `inventory_balances`: `RENAME COLUMN stock_qty TO on_hand`; `ADD COLUMN reserved INT NOT NULL DEFAULT 0`; `ADD CONSTRAINT ... CHECK (on_hand >= 0)`, `CHECK (reserved >= 0)`.
- `inventory_transactions`: `RENAME COLUMN balance_after TO qty_after`; `ADD COLUMN qty_before INT NOT NULL DEFAULT 0`; backfill `qty_before` từ `qty_after − qty_change` (cho dữ liệu cũ).

### 6.3 Permissions
- Thêm `purchase:view`, `purchase:create` (group `purchase`), gán cho admin.
- (Không cần thêm permission mới cho count/transfer — tái sử dụng `warehouse:adjust`, `warehouse:transfer`.)

### 6.4 Backfill dữ liệu
- `inventory_costs`: với variant có GR cũ đang `COMPLETED` → `current_cost = Σ(qty × unit_cost) / Σ(qty)` từ `goods_receipt_items`; nếu không có → `supplier_variants.cost_price` (nếu có); ngược lại 0.
- `goods_receipts.po_id` / `goods_receipt_items.po_item_id`: để `NULL` (nhập trực tiếp) — PO không bắt buộc nên không cần tạo PO giả.
- `document_sequences`: seed mỗi `(prefix, year)` với `seq = 0`.

### 6.5 Lưu ý
- Migration chạy qua `node migrations/run.js` sau khi thêm vào danh sách. Idempotent (`IF NOT EXISTS`, guard).
- Dữ liệu hiện có (kho, tồn, sổ cái) được giữ nguyên.

---

## 7. Kế hoạch triển khai

| Phase | Nội dung |
|---|---|
| **1** | Migration 018 + backend: PO, GR (vòng đời + partial + ghi sổ + giá vốn + hủy theo quy tắc), Adjustment, Stock Count, Transfer, Inventory Ledger/Costs, cập nhật `utils/stock.js` |
| **2** | Frontend admin: PO list/create/detail; GR rework (chọn PO hoặc nhập thẳng, draft→complete→cancel); Adjustment (có lý do); Stock Count (snapshot→đếm→hoàn tất); Transfer; hiển thị giá vốn & sổ cái |
| **3+** | Hóa đơn + thanh toán NCC, COGS/reservation khi bán, giá vốn theo kho, tồn public |

---

## 8. Ghi chú phase sau
- `reserved` chưa dùng — khi tích hợp order sẽ khóa hàng bằng `available = on_hand − reserved`.
- Hủy GR không khôi phục giá vốn — khi làm kế toán, cân nhắc bổ sung `cost_before`/`reversal_of_id`.
- Adjustment/Count không đổi giá vốn — hao hụt/hư hỏng cần cột COGS riêng khi làm tài chính.
