BEGIN;

-- Cho phép từng dòng phiếu nhập đánh dấu "cập nhật giá master NCC"
-- khi giá nhập thực tế khác giá thỏa thuận trên PO.
ALTER TABLE goods_receipt_items ADD COLUMN IF NOT EXISTS sync_master_cost BOOLEAN NOT NULL DEFAULT false;

COMMIT;
