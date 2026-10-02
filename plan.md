# Kế hoạch: Booking Management (user gọi là "F10")

Trạng thái: **CHỜ DUYỆT**. Chưa có file source nào bị sửa.

Lưu ý số hiệu: `docs/roadmap.md` ghi F10 = Permanent QR Passport, F11 = Booking Management, F12 = Booking State Machine, F13 = Booking Timeline. Yêu cầu của user gom một phần F12 (ma trận trạng thái) và F13 (lịch sử event chỉ đọc). Plan này làm mức tối thiểu cho hai phần đó, theo tiền lệ F09.

## 1. Phạm vi

Làm:
- `/bookings`: danh sách phân trang server-side, tìm theo `booking_number`, lọc `status` / `airport_id` / khoảng ngày, sắp xếp.
- `/bookings/[id]`: chi tiết + lịch sử `booking_events` chỉ đọc.
- `/bookings/new`, `/bookings/[id]/edit`: React Hook Form + Zod, validate lại ở server.
- Kiểm tra ghế (availability) và đổi trạng thái có kiểm soát.
- Mọi ghi (create / update / status) đi qua RPC trong DB (atomic). Mọi event do DB ghi.

Không làm: QR passport, technician job, installation, cleaning, inspection, incident, flight integration (`flight_id`, cột arrival chỉ hiển thị), finance (`paid_days`, `gross_revenue`, `partner_share`, `platform_share`), AI, notifications, auth/RBAC/tenancy mới, nút xóa (không có policy DELETE).

## 2. Phát hiện từ codebase

Bảng `bookings` (`20260826083803_create_bookings_table.sql`):
- `booking_number` text NOT NULL UNIQUE; `partner_id`, `airport_id`, `seat_category_id` NOT NULL (FK RESTRICT).
- `pickup_at`, `return_at` timestamptz NOT NULL, CHECK `return_at >= pickup_at`.
- `assigned_seat_id` FK seats (SET NULL, nullable); `daily_rate` numeric NOT NULL, không default.
- `status` `booking_status` default `pending`.
- Không có sequence sinh `booking_number`, không có chống trùng ghế theo thời gian, không có CHECK ghế khớp category/airport, không có nguồn giá.

Enum:
- `booking_status`: `pending`, `confirmed`, `assigned`, `in_progress`, `completed`, `cancelled`, `no_show`.
- `user_role`: `admin`, `operations_manager`, `technician`, `partner_user`.

Bảng `booking_events`: `booking_id`, `seat_id`, `user_id`, `from_status` (nullable), `to_status` (NOT NULL), `notes`, `metadata` jsonb, `created_at`. Không có `event_type`, nên loại event (`created` / `updated` / `status_changed` / `seat_changed`) đặt trong `metadata.event_type`.

Không có ma trận chuyển trạng thái. Hành vi hiện tại: `bookings.status` là cột thường, admin/ops UPDATE tự do. Sẽ ghi vào docs.

RLS hiện có (`20260902085338_enable_rls_multi_tenancy.sql`):
- `bookings` SELECT: admin/ops tất cả; technician theo gán; partner_user theo `partner_id = current_user_partner_id()`. INSERT/UPDATE chỉ admin/ops. Không DELETE.
- `booking_events` SELECT theo booking; INSERT cho admin/ops và technician; không UPDATE/DELETE.
- `seats`: partner_user chỉ thấy ghế đang gán cho booking của partner mình.

RBAC (`src/lib/auth/permissions.ts`): chỉ có `bookings:manage` (ops; admin bypass) và `bookings:view_own_partner` (partner_user). `requirePermission` chỉ nhận một permission.

Lỗ hổng cần xử lý:
1. Partner không có quyền create/update booking trong RBAC lẫn RLS.
2. Admin/ops/technician INSERT `booking_events` tùy ý qua PostgREST, vi phạm yêu cầu "event chỉ do server tạo".
3. RLS không giới hạn cột: admin/ops PATCH thẳng `status`, `assigned_seat_id`, `partner_id`, `booking_number`, cột finance. Cần guard trigger (giống `guard_seat_update()` của F09).
4. `seats` không có `partner_id`, nên không có "restricted inventory" thật. Đáp ứng bằng RLS `seats` + gán ghế chỉ qua RPC + không lộ booking của partner khác trong thông báo lỗi.
5. Partner không đọc được `users`, nên tên staff trong event là `null`. UI hiển thị nhãn chung.
6. `change_seat_status()` (F09) không cho `available -> reserved` và guard khóa `seats.status`.

## 3. Quyết định cần user chốt (bắt buộc trước khi implement)

Khuyến nghị nằm ở đầu mỗi mục.

1. **Partner tạo/sửa booking?** Khuyến nghị A: không, partner chỉ xem. `/bookings/new` và `/edit` chỉ admin/ops. Không đổi RBAC/RLS. B: cho phép, cần permission mới và policy/RPC mới (rủi ro cao, vi phạm `docs/security.md` nếu tự thêm).
2. **`booking_events`:** DROP hai policy INSERT (`booking_events_insert_admin_ops_manager`, `booking_events_insert_technician`); event chỉ do trigger `SECURITY DEFINER` ghi; thêm trigger chặn UPDATE/DELETE mọi vai trò. Rủi ro: F15 (technician workflow) sau này phải ghi event qua RPC/trigger.
3. **Ma trận chuyển trạng thái thủ công (tối thiểu):** `pending -> confirmed`, `pending -> cancelled`, `confirmed -> cancelled`, `confirmed -> no_show`. Terminal: `cancelled`, `no_show`, `completed`. `assigned`, `in_progress`, `completed` thuộc các workflow sau. Cần xác nhận có cho `pending -> no_show` không, và `reason` có bắt buộc khi `cancelled` / `no_show` không.
4. **Ghế:** khuyến nghị F11 không đổi `seats.status`. "Khả dụng" = ghế `status = 'available'`, cùng `airport_id` và `category_id` với booking, không có booking active khác chồng thời gian. Active = `pending`, `confirmed`, `assigned`, `in_progress`. Cần chốt đầu mút khoảng chồng (A kết thúc đúng lúc B bắt đầu có xung đột không).
5. **`booking_number`:** sequence + hàm trong DB, dạng `BK-` + số đệm, bắt đầu sau 20 (seed dùng `BK-00001..20`). Người dùng không nhập tay. Cần chốt định dạng.
6. **`daily_rate`:** admin/ops nhập tay khi tạo, chỉ đọc sau đó. Cần xác nhận.
7. **Timezone `pickup_at`/`return_at`:** diễn giải theo `airports.timezone`, lưu UTC, hiển thị theo tz sân bay, dùng `Intl` (không thêm dependency).
8. **Sửa booking:** cho sửa khi `pending`/`confirmed`; terminal chỉ xem. Dùng `expected_updated_at` chống ghi đè đồng thời. Có cho đổi `seat_category_id` không (nếu đổi thì bỏ gán ghế)? Khuyến nghị: chỉ đọc.
9. **Ghế tùy chọn khi tạo:** cho tạo booking không ghế, gán sau qua edit.
10. **Điều kiện tạo:** partner `status = 'active'`, category `is_active = true`.
11. **Route group:** `/bookings` đặt trong `(dashboard)` (đã có `AppShell` + `requireAuth()`), layout con chỉ guard.
12. **Helper any-of:** thêm `requireAnyPermission` vào `src/lib/auth/current-user.ts` và hỗ trợ any-of trong `src/config/nav.ts` (thay đổi nhỏ trên F04, không phải kiến trúc RBAC mới).
13. **Lọc ngày:** theo `pickup_at`. Không thêm lọc partner cho admin/ops (ngoài yêu cầu).

## 4. Danh sách task (theo thứ tự phụ thuộc)

### Task 1. Migration nền tảng DB [MIGRATION + RLS + BẢO MẬT]
`supabase/migrations/<ts>_booking_numbering_event_log_and_guards.sql` (có khối rollback trong comment).
- Sequence + hàm sinh `booking_number`.
- Trigger `SECURITY DEFINER` (`search_path = ''`) ghi `booking_events` khi AFTER INSERT và AFTER UPDATE các cột theo dõi. Ngữ cảnh lấy từ `set_config('app.booking_event_*', ..., true)`. `metadata.event_type` + giá trị trước/sau. `user_id` qua `public.users` như F09.
- BEFORE UPDATE guard trên `bookings`: chặn đổi `status`, `assigned_seat_id`, `partner_id`, `booking_number`, `airport_id`, `seat_category_id`, `pickup_at`, `return_at`, `daily_rate`, cột finance ngoài RPC (cờ `app.booking_change`). Không chặn `assigned_technician_id`, `flight_id`, `incident_status`. Mã lỗi `55000`.
- Trigger BEFORE UPDATE/DELETE trên `booking_events` luôn từ chối.
- DROP hai policy INSERT của `booking_events`, ghi lý do trong comment.
- Phụ thuộc: quyết định 2, 3, 5.

### Task 2. Migration RPC [MIGRATION + BẢO MẬT]
`supabase/migrations/<ts>_booking_rpcs.sql`.
- `create_booking`, `update_booking`, `change_booking_status`: `SECURITY INVOKER`, `search_path = ''`, revoke `public`/`anon`, grant `authenticated`.
- Một giao dịch: khóa `FOR UPDATE` booking và dòng ghế, kiểm tra, ghi, đặt cờ guard, event qua trigger.
- Kiểm tra: partner active, airport tồn tại, category active, `return_at >= pickup_at`, ghế (tồn tại, `available`, cùng airport/category, không chồng booking active khác, loại trừ chính booking khi update).
- Mã lỗi: ghế không khả dụng, xung đột lịch, sai category/airport, booking terminal; cộng `P0002`, `55000`, `22023`. Không lộ booking của partner khác.
- `change_booking_status`: kiểm ma trận, ghi event `status_changed`.
- `get_available_seats(...)` (SELECT, INVOKER) dùng cùng điều kiện để UI chọn ghế mà không nhân đôi logic.
- Phụ thuộc: Task 1.

### Task 3. Regenerate types
`npx supabase gen types typescript --local > src/types/database.types.ts`. Chặn mọi task app.

### Task 4. Nền module `src/features/bookings`
- `types.ts`, `lib/booking-status.ts` (nhãn, active, bảng chuyển; SQL là nguồn thật), `lib/booking-errors.ts` (`mapBookingError`, mã: `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_TRANSITION`, `SEAT_UNAVAILABLE`, `SEAT_CONFLICT`, `SEAT_CATEGORY_MISMATCH`, `INTERNAL_ERROR`).
- `schemas/booking.schema.ts`, `schemas/bookings-query.schema.ts` (snake_case; update không có `status`, `booking_number`, `partner_id`, finance/flight/technician).
- `lib/build-bookings-query-filters.ts` (tái dùng `escape-ilike` của `seat-categories`), `lib/build-bookings-href.ts`.
- Phụ thuộc: Task 2, 3.

### Task 5. Truy vấn (server-only, không N+1)
- `get-bookings.ts`: một nested select (partner, airport, seat, category), `count: "exact"`, tìm ilike, lọc status/airport/ngày, sort + tie-breaker `id`, xử lý `PGRST103`. RLS là ranh giới tenant.
- `get-booking-by-id.ts`, `get-booking-events.ts` (chỉ đọc), `get-booking-form-options.ts` (chỉ admin/ops).
- Phụ thuộc: Task 4.

### Task 6. Server Actions
- `create-booking.action.ts`, `update-booking.action.ts`, `change-booking-status.action.ts`: kiểm `bookings:manage`, Zod `safeParse`, gọi RPC, map lỗi, redirect. Không nhận `status` tùy ý ở create/update. Không service-role, không `.update({status})` trực tiếp.
- Phụ thuộc: Task 2, 4, 5.

### Task 7. RBAC helper + nav (có thể song song với Task 4-6)
- `requireAnyPermission` trong `current-user.ts` (+ test), nav any-of trong `nav.ts` (+ `nav.test.ts`). Mục "Bookings" không trùng với admin. Icon lucide.

### Task 8. UI
- Components: `bookings-table` (responsive), `bookings-filters`, `bookings-pagination`, `booking-status-badge` (icon + chữ, theo `SeatStatusBadge`), `booking-detail`, `booking-events-timeline` (chỉ đọc), `booking-form`, `create-booking-form`, `edit-booking-form`, `change-booking-status-dialog`.
- Hooks: `use-create-booking-form`, `use-update-booking-form`, `use-change-booking-status-form` (RHF + `src/lib/validation/zod-resolver.ts`). Logic nằm trong hook.
- Edit được: `pickup_at`, `return_at`, `assigned_seat_id`, `external_booking_number`, `child_age_band`, `child_height`, `vehicle`, `vehicle_bay`, `notes`. Chỉ đọc: số booking, partner, airport, category, status (nút riêng), `daily_rate`, finance, flight, technician, `incident_status`.
- Loading / empty / error; Tailwind + `cn()`; không inline style; lucide only.
- Phụ thuộc: Task 4, 5, 6.

### Task 9. Routes
- `src/app/(dashboard)/bookings/`: `layout.tsx` (guard any-of), `page.tsx`, `loading.tsx`, `error.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`. Mỗi page gọi lại guard; `new`/`edit` cần `bookings:manage`. Xử lý not found.
- Phụ thuộc: Task 6, 7, 8.

### Task 10. Docs
- `docs/security.md` (RPC, guard, policy bị DROP và lý do, ma trận, mã lỗi), `docs/database.md` (hàm, trigger, sequence, `metadata.event_type`), `docs/architecture.md`, `docs/roadmap.md`. Ghi hành vi cũ "không có ma trận".

### Task 11. Tests (vitest)
Unit: schemas, query schema, filter builder, href builder, ma trận trạng thái, badge, `mapBookingError`, `get-bookings` (mock: lọc, phân trang, `PGRST103`), `get-booking-by-id`, actions (happy path, validation fail, forbidden, lỗi RPC), guard layout/page, `nav.test.ts`, `requireAnyPermission`.

Integration (khối mới trong `src/lib/auth/rls.integration.test.ts`, cần `npx supabase start`):
- Admin/ops xem và tạo OK; partnerA thấy booking của A, không thấy của B (list và theo id); partnerA không INSERT/UPDATE; partnerNull 0 dòng; anon và inactive bị từ chối; technician chỉ booking được gán.
- Tạo: sinh `booking_number`, đúng 1 event `created`; input sai bị từ chối.
- Ghế: không `available`, sai category/airport, xung đột thời gian đều bị từ chối; hai `create_booking` đồng thời cùng ghế thì đúng một thành công.
- Trạng thái: hợp lệ ghi event (`from_status`, `to_status`, `user_id`, `notes`, `metadata.event_type`); không hợp lệ bị từ chối và không ghi event.
- PATCH trực tiếp `status` / `assigned_seat_id` / `partner_id` / `booking_number` bị guard chặn; đổi ghế ghi `seat_changed`.
- `booking_events`: INSERT trực tiếp bị từ chối; UPDATE/DELETE bị từ chối; partner không thấy event của partner khác.
- Regression migration: seed 20 booking vẫn đọc được, update `notes` vẫn chạy, `change_seat_status` F09 vẫn chạy, policy F05 khác không đổi.
- Lưu ý: suite integration bị skip nếu thiếu Supabase local/Docker. Sẽ báo rõ trong kết quả.

### Task 12. Verification
`npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npx supabase db reset` rồi chạy integration.

## 5. Thứ tự

Quyết định -> Task 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 8 -> 9 -> 11 -> 12. Task 7 song song với 4-6 nhưng phải xong trước Task 9. Task 10 sau Task 2.

## 6. File ảnh hưởng

Mới: 2 migration; `src/features/bookings/**`; `src/app/(dashboard)/bookings/**`.
Sửa: `src/types/database.types.ts`, `src/lib/auth/current-user.ts` (+test), `src/config/nav.ts` (+test), `src/lib/auth/rls.integration.test.ts`, `docs/{security,database,architecture,roadmap}.md`.
Không đổi: `permissions.ts` (trừ khi chọn 1B), migration cũ, F06-F09, policy RLS khác. `supabase/seed.sql` chỉ sửa nếu sequence không tránh được seed.

## 7. Cờ cảnh báo

- **Migration:** có (Task 1, 2). Cần duyệt trước khi chạy `db reset`.
- **RLS / bảo mật:** DROP 2 policy INSERT của `booking_events`; trigger bất biến; guard trigger; RPC `SECURITY INVOKER`; trigger `SECURITY DEFINER`; không service-role.
- **Breaking:** INSERT trực tiếp `booking_events` và PATCH trực tiếp các cột bị guard sẽ thất bại (hiện `src/` không có code nào làm vậy). Commit phải có `BREAKING CHANGE:` ở footer.
- **Dữ liệu cũ:** 20 booking seed là `confirmed`, mỗi booking một ghế riêng, không xung đột. Trigger AFTER INSERT sẽ tạo event `created` lúc seed (`user_id` null).

## 8. Rủi ro / edge case

- Race ghế: khóa `FOR UPDATE` trên dòng ghế tuần tự hóa theo ghế. Booking không ghế không cần khóa.
- Race sửa đồng thời: khóa booking + `expected_updated_at`.
- `booking_events.to_status` NOT NULL: event "updated" lặp status hiện tại. Timeline phân biệt bằng `metadata.event_type`.
- Tên staff `null` với partner; FK `SET NULL` nên UI chịu được `seat` null.
- `partner_user.partner_id` null: 0 dòng, hiển thị empty state.
- Technician bị chặn ở route; RLS vẫn cho đọc booking được gán.
- Sai timezone làm lệch hiển thị và khoảng chồng.
- `daily_rate` nhập tay có rủi ro nhập sai.

## 9. Câu hỏi mở (cần trả lời)

1. Xác nhận số hiệu feature (roadmap ghi F11) và mức gom F12/F13 tối thiểu như trên?
2. Partner chỉ xem (khuyến nghị) hay được tạo/sửa?
3. Ma trận ở quyết định 3 có đúng không? `pending -> no_show`? `reason` bắt buộc khi hủy/no-show?
4. Không đổi `seats.status` khi gán ghế; đầu mút khoảng chồng có tính xung đột không?
5. Định dạng `booking_number`?
6. `daily_rate` nhập tay lúc tạo, chỉ đọc sau đó?
7. Timezone theo `airports.timezone`?
8. Có cho đổi `seat_category_id` sau khi tạo?
9. Cho tạo booking không ghế?
10. Chấp nhận DROP policy INSERT `booking_events` và trigger chặn UPDATE/DELETE mọi vai trò?
11. Chấp nhận helper any-of trong `current-user.ts` và `nav.ts`?

Nếu bạn đồng ý với tất cả khuyến nghị, chỉ cần trả lời "approved" kèm các điểm cần đổi.
