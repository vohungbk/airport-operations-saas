# Kế hoạch: F09 — Seat Inventory Management

## Tóm tắt

> Trạng thái: đã cập nhật theo khuyến nghị; **chờ duyệt rõ ràng** trước khi sang Bước 2.

Xây module nội bộ quản lý từng ghế trẻ em (`seats`) tại `/seats`,
`/seats/new`, `/seats/[id]`, `/seats/[id]/edit`. Sao chép 1:1 mẫu F06/F07/F08:
route group `(admin)`, `src/features/seats`, Server Actions + Zod + React Hook
Form, `requirePermission("seats:manage")` ở layout, page và từng action.

Ngoài phạm vi (không làm): booking, QR passport (F10), technician job,
installation/cleaning/inspection/incident, finance, flight, AI, auth/RBAC/
tenancy mới, nút xóa ghế.

## Phát hiện quan trọng từ schema/RLS thực tế

- `seats` có nhiều cột NOT NULL ngoài ticket: `manufacturer`, `model`,
  `manufacture_date`, `purchase_date`, `max_rental_cycles` (> 0). Form tạo
  ghế phải có các trường này.
- `public_token`: `text not null unique default gen_random_uuid()::text`.
  Định dạng thật do F10 quyết định. => F09 **không cho nhập tay**; để DB tự
  sinh khi tạo, chỉ hiển thị (và tìm kiếm) token. Không có rủi ro trùng token
  do người dùng nhập; test "duplicate public token" sẽ là test RLS/DB
  integration (unique constraint) + test mapping lỗi `23505`.
- `serial_number` có `unique` ở DB => khác F08, có thể dựa vào constraint
  (race-safe): pre-check ở app để báo lỗi sớm + map `23505` → `DUPLICATE_SERIAL`.
- `seat_status` enum: `available, reserved, in_use, cleaning, inspection,
  quarantine, retired`. Không tạo enum mới.
- Chưa có tài liệu nào định nghĩa bảng chuyển trạng thái (state machine thuộc
  F11/F12/F16–F18). `seat_status_history`: `seat_id, from_status (null ở dòng
  đầu), to_status, changed_by, reason, created_at`; RLS chỉ có SELECT/INSERT
  cho admin/ops, **không có UPDATE/DELETE** (append-only đã đúng).
- `seats` **không có policy DELETE** => không thể hard-delete qua API; mọi FK
  tới `seats` là RESTRICT hoặc SET NULL. => Không có nút xóa, không cần
  migration cho việc này; thêm test chứng minh.
- Phạm vi tenant: seats không có `partner_id`; partner/technician chỉ thấy ghế
  qua `bookings.assigned_seat_id` (policy F05 đã có, đã đúng, không đổi).
  `/seats` là trang quản trị: layout yêu cầu `seats:manage` (admin + ops
  manager), technician/partner_user bị chuyển sang `/forbidden`. UI cho
  technician/partner xem ghế thuộc F15/F21, không làm ở F09.
- Quyền `seats:manage` và `seats:view_own_partner` **đã tồn tại** trong
  `permissions.ts` => không đổi RBAC.
- `airports`/`seat_categories` đọc được bởi mọi `authenticated` (reference
  data, không nhạy cảm) => join lấy tên không tạo đường bypass tenant.

## Quyết định đã chốt (theo các khuyến nghị)

1. **Ghi `seat_status_history` thế nào cho nguyên tử?** PostgREST không có
   transaction nhiều câu lệnh.
   - **ĐÃ CHỌN A**: migration thêm trigger `AFTER INSERT / AFTER UPDATE OF
     status` trên `seats` (SECURITY DEFINER, `search_path=''`) tự ghi history
     (`from_status`, `to_status`, `changed_by = auth.uid()`, `reason` lấy từ
     `set_config('app.seat_status_reason', ..., true)` do hàm đổi trạng thái
     đặt), cộng hàm `change_seat_status(p_seat_id, p_to_status, p_reason)`
     SECURITY INVOKER (RLS vẫn áp dụng). Đảm bảo mọi chuyển trạng thái,
     kể cả của F16–F18 sau này, đều có history.
   - B (đã loại): không migration; update rồi insert history không atomic.
2. **ĐÃ CHỐT — chuyển trạng thái thủ công (minimal, không phát minh luật mới):** chỉ cho
   admin/ops thực hiện các chuyển kiểu "quản lý kho":
   `available → quarantine` (bắt buộc `reason`, ghi `quarantine_reason`),
   `quarantine → available`, và `available|quarantine → retired` (ghi
   `retired_at`, trạng thái cuối, không đổi lại). Các trạng thái vận hành
   (`reserved`, `in_use`, `cleaning`, `inspection`) do workflow tương lai sở
   hữu: UI không cho chọn. Trạng thái không thể sửa qua form edit thông
   thường.
3. **ĐÃ CHỐT — trường sửa được ở `/seats/[id]/edit`:** `manufacturer`, `model`,
   `manufacture_date`, `purchase_date`, `max_rental_cycles` (≥ `rental_cycles`
   hiện tại), `category_id`, `airport_id`. **Không sửa:** `serial_number`,
   `public_token`, `status`, `rental_cycles`, `last_*`, `quarantine_reason`,
   `retired_at`. Ghế `retired` thì chỉ xem (không sửa).
4. **ĐÃ CHỐT — icon sidebar:** `Armchair` đã dùng cho Seat Categories; đề xuất `Boxes`
   (Lucide, đã có sẵn trong `lucide-react`) cho "Seats" để phân biệt.

## Danh sách task (theo thứ tự phụ thuộc)

### Task 1 — Migration (quyết định 1 = A) — NHẠY CẢM
- `supabase/migrations/<ts>_seat_status_history_trigger.sql`: trigger ghi
  history khi INSERT seat và khi `status` đổi; hàm `change_seat_status`
  (SECURITY INVOKER) kiểm tra chuyển trạng thái hợp lệ (bảng ở quyết định 2),
  khóa dòng `FOR UPDATE`, đặt `retired_at`/`quarantine_reason`; có rollback
  comment; `revoke execute ... from public, anon`, grant cho `authenticated`.
- Không đổi policy hiện có, không thêm policy UPDATE/DELETE cho history, không
  service-role. Cập nhật `docs/security.md` (lý do + bảng policy) và
  `docs/database.md`. Regenerate `src/types/database.types.ts`.

### Task 2 — Nền tảng feature `src/features/seats`
- `types.ts`, `schemas/seat.schema.ts` (create/update/status-change, Zod),
  `schemas/seats-query.schema.ts` (q, airport_id, category_id, status, sort,
  order, page, page_size), `lib/build-seats-query-filters.ts`,
  `lib/seat-errors.ts` (`VALIDATION_ERROR`, `DUPLICATE_SERIAL`,
  `INVALID_TRANSITION`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL_ERROR`),
  `lib/seat-status.ts` (nhãn, mapping variant, bảng transition — thuần, test
  được).
- Tái dùng `escape-ilike` của seat-categories (import, không sao chép).

### Task 3 — Truy vấn (Server-only, không N+1)
- `lib/get-seats.ts`: một query nested select
  `category:seat_categories(id,name), airport:airports(id,code,name)`,
  `count: "exact"`, filter airport/category/status kết hợp AND, tìm kiếm
  `serial_number`/`public_token` ilike, order + tie-breaker `id`, xử lý
  `PGRST103` (page vượt phạm vi) như F08.
- `lib/get-seat-by-id.ts`, `lib/get-seat-status-history.ts` (đọc-only,
  `order created_at desc`, nested `changed_by_user:users(full_name)`),
  `lib/get-seat-form-options.ts` (airports + categories đang `is_active` cho
  dropdown).

### Task 4 — Server Actions (đều `requirePermission("seats:manage")`)
- `create-seat.action.ts` (không gửi `public_token`/`status`/`rental_cycles`
  từ client; pre-check serial + map `23505`), `update-seat.action.ts` (schema
  không có trường bị cấm; từ chối khi ghế `retired`; `.maybeSingle()` →
  `NOT_FOUND`), `change-seat-status.action.ts` (gọi RPC; map lỗi transition).

### Task 5 — UI (Server Components mặc định, client boundary nhỏ)
- `components/`: `seats-table` (responsive, cột: Serial, Category, Airport,
  Status, Public token, Created), `seats-filters` (q, airport, category,
  status, sort), `seats-pagination`, `seat-status-badge` (nhãn chữ luôn hiển
  thị + icon, không chỉ dựa vào màu: available→success, reserved/in_use→info,
  cleaning/inspection→warning, quarantine→destructive, retired→muted),
  `seat-form`, `create-seat-form`, `edit-seat-form`, `seat-detail`,
  `seat-status-history` (read-only), `change-seat-status-dialog`.
- `hooks/use-create-seat-form.ts`, `use-update-seat-form.ts`,
  `use-change-seat-status-form.ts` (React Hook Form + Zod resolver sẵn có).

### Task 6 — Routes `src/app/(admin)/seats/`
- `layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`, `new/page.tsx`,
  `[id]/page.tsx`, `[id]/edit/page.tsx`; mỗi page gọi lại `requirePermission`.
  Empty state, error state, loading state.

### Task 7 — Nav + docs
- `src/config/nav.ts`: thêm "Seats" `/seats`, `seats:manage`, icon theo quyết
  định 4; cập nhật `nav.test.ts` nếu cần. Cập nhật `docs/architecture.md`,
  `docs/security.md`, `docs/roadmap.md` (F09 done), không sửa phần khác.

### Task 8 — Tests (theo `testing.md` + 16 mục của ticket)
- Unit (vitest, không mock DB): schemas (invalid data, biên), query schema,
  filter builder, bảng transition, status badge mapping, error mapping,
  `get-seats` (mock supabase như F08), actions (mock supabase: happy path +
  validation + forbidden cho technician/partner, duplicate serial).
- Integration (khối `seats` trong `rls.integration.test.ts`, chạy thật trên
  Supabase local, cần `npx supabase start`): admin/ops xem/tạo/sửa; duplicate
  `serial_number` và `public_token` bị từ chối (23505); dữ liệu sai bị CHECK
  từ chối; technician/partner không INSERT/UPDATE; partner A không thấy ghế
  của partner B; lọc kết hợp; đổi trạng thái tạo history (from/to/changed_by/
  reason); history không UPDATE/DELETE được; DELETE seat bị từ chối/không
  hiệu lực và FK RESTRICT chặn khi có tham chiếu; cross-tenant bị chặn.

### Task 9 — Verification
- `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`. Kiểm tra
  thủ công ranh giới Server→Client (không truyền hàm/icon qua props — bài học
  từ log 2026-09-07).

## File ảnh hưởng

- Mới: `src/features/seats/**`, `src/app/(admin)/seats/**`, migration .
- Sửa: `src/config/nav.ts` (+test), `src/types/database.types.ts` ,
  `src/lib/auth/rls.integration.test.ts` (+`rls-test-support.ts` nếu cần dữ
  liệu seed), `docs/{architecture,security,database,roadmap}.md`.
- Không đổi: `permissions.ts`, RLS policy hiện có, auth, F06–F08.

## Rủi ro / giới hạn đã biết

- Migration + trigger là thay đổi bảo mật/DB: sẽ dừng xin duyệt lần nữa nếu
  phát sinh khác với plan.
- Không có jsdom/RTL: component không có test render.
- Bảng chuyển trạng thái thủ công là tối thiểu; F12/F16–F18 sẽ mở rộng.
- `public_token` placeholder UUID cho đến F10.
- Test integration cần Docker + Supabase local; suite thường skip khi thiếu.
