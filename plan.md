# Kế hoạch: F08 — Seat Category Management

## Tóm tắt

Xây module nội bộ quản lý danh mục loại ghế trẻ em (`seat_categories`) tại
`/seat-categories`, `/seat-categories/new`, `/seat-categories/[id]`,
`/seat-categories/[id]/edit`. Module sao chép 1:1 mẫu của F06 (Partners) và
F07 (Airports): route group `(admin)`, `src/features/seat-categories`,
Server Actions + Zod + React Hook Form, `requirePermission` ở layout, từng
page và từng action.

## Phát hiện quan trọng: schema thực tế khác với mô tả ticket

Đã đọc `supabase/migrations/20260826083750_create_seat_categories_table.sql`
và `docs/database.md`. Bảng `seat_categories` chỉ có các cột:

| cột | kiểu | ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `name` | text not null | **không có unique constraint** |
| `description` | text | nullable |
| `min_child_age` | integer not null | đơn vị: tháng |
| `max_child_age` | integer not null | tháng; `check (max_child_age >= min_child_age)` |
| `safety_standard` | text not null | |
| `is_active` | boolean not null default true | |
| `created_at`, `updated_at` | timestamptz | trigger `set_updated_at` |

Hệ quả so với ticket:

- **Không có cột `code`** → không có "mã loại ghế" và không có ràng buộc
  unique. Không thể có test "duplicate code bị từ chối" nếu không đổi schema.
- **Không có cột giá / cấu hình giá.** Giá thuộc F22 (Revenue) và
  `partner_commercial_terms`. Danh sách/chi tiết sẽ hiển thị các trường thật:
  `name`, `description`, độ tuổi (tháng), `safety_standard`, `is_active`,
  `created_at`. Không có validation số tiền.
- **Có `is_active`** → hỗ trợ vô hiệu hóa mềm mà **không cần migration**
  (khác với F06 dùng `status`, F07 không có gì).
- Bảng tham chiếu: `seats.category_id` (FK ON DELETE RESTRICT) và
  `bookings.seat_category_id` (FK ON DELETE RESTRICT). Không hard-delete.
- RLS (F05) đã có sẵn: select cho mọi `authenticated`, insert/update chỉ
  `is_admin_or_ops_manager()`, không có policy DELETE. **Không cần migration
  RLS mới**; tái sử dụng nguyên trạng như F06/F07.

## Ngoài phạm vi (xác nhận)

Quản lý từng ghế, gán ghế, trạng thái ghế, booking, QR, technician,
cleaning, inspection, finance, flight, AI, auth mới, RBAC mới,
multi-tenancy mới, sửa/xóa policy RLS hiện có, dùng service-role key,
thêm dependency mới, thêm cột giá hoặc cột `code`.

## Quyết định cần bạn xác nhận (xem câu hỏi kèm theo)

1. **Trùng lặp**: schema không có `code`. Lựa chọn:
   - (A, khuyến nghị) Không migration. Không có unique; cảnh báo trùng
     `name` ở mức ứng dụng bằng kiểm tra không phân biệt hoa/thường kèm
     thông báo. Rủi ro: TOCTOU, nhưng dữ liệu tham chiếu ít, không phải
     ràng buộc an toàn.
   - (B) Thêm migration `unique index on lower(name)` để DB đảm bảo. Cần
     phê duyệt riêng (migration + rollback), không ảnh hưởng RLS.
   - (C) Cho phép trùng tên (không kiểm tra).
2. **Vô hiệu hóa**: dùng `is_active` có sẵn cho nút Deactivate/Activate
   (mềm, không xóa). Danh sách mặc định hiển thị cả hai, có bộ lọc trạng thái.
3. **Nav item**: thêm "Seat Categories" (icon `Armchair`) vào
   `src/config/nav.ts`, gắn permission mới `seat_categories:manage`.

## Danh sách task (có thứ tự, có phụ thuộc)

### T1. Permission mới (RBAC — nhạy cảm về bảo mật)
- `src/lib/auth/permissions.ts`: thêm `"seat_categories:manage"` vào union
  `Permission`, cấp cho `admin` và `operations_manager` (cùng cách
  `airports:manage`). `technician`/`partner_user` không có.
- Cập nhật `permissions.test.ts`.
- Không đổi kiến trúc RBAC.

### T2. Schema và kiểu (phụ thuộc: không)
- `src/features/seat-categories/types.ts`: kiểu `SeatCategory` (snake_case).
- `schemas/seat-category.schema.ts`: Zod — `name` bắt buộc (trim, 2–100),
  `description` tùy chọn (≤ 500, rỗng → null), `min_child_age` /
  `max_child_age` số nguyên ≥ 0 (có trần hợp lý, ví dụ 216 tháng),
  `max >= min` (refine, khớp CHECK của DB), `safety_standard` bắt buộc,
  `is_active` boolean.
- `schemas/seat-categories-query.schema.ts`: `q`, `sort`, `order`,
  `page`, `status`.
- Test: hợp lệ, thiếu trường, số âm, max < min, biên (0, bằng nhau), chuỗi rỗng.

### T3. Lớp đọc dữ liệu (phụ thuộc: T2)
- `lib/get-seat-categories.ts` + `lib/build-seat-categories-query-filters.ts`
  (tìm kiếm `name`/`safety_standard`, sắp xếp whitelist, phân trang).
  Phải escape ký tự đặc biệt của `ilike` như mẫu F06/F07.
- `lib/get-seat-category-by-id.ts`: trả `null` khi không thấy → `notFound()`.
- `lib/get-seat-category-related-counts.ts`: **một** truy vấn đếm
  (`head: true, count: "exact"`) trên `seats` theo `category_id`. Không đếm
  booking (ngoài phạm vi, tránh lộ nghiệp vụ F11). Không có N+1.
- `lib/seat-category-errors.ts`: ánh xạ lỗi DB (CHECK `23514`, quyền
  RLS) sang lỗi chuẩn.

### T4. Server Actions (phụ thuộc: T1, T2)
- `actions/create-seat-category.action.ts`,
  `actions/update-seat-category.action.ts`,
  `actions/set-seat-category-active.action.ts` (nếu chấp nhận quyết định 2).
- Mỗi action: `requirePermission("seat_categories:manage")` → Zod
  `safeParse` → Supabase **server client** (không service-role) →
  trả về shape lỗi chuẩn như F06/F07. `id` không bao giờ nằm trong schema
  cập nhật.
- Không tìm thấy id khi update (0 hàng bị ảnh hưởng, kể cả do RLS) → lỗi `NOT_FOUND`.

### T5. UI (phụ thuộc: T3, T4)
- Hook: `hooks/use-create-seat-category-form.ts`,
  `hooks/use-update-seat-category-form.ts` (React Hook Form + Zod resolver).
- Component: `seat-category-form.tsx`, `create-…`, `edit-…`,
  `seat-categories-table.tsx`, `seat-categories-filters.tsx`,
  `seat-categories-pagination.tsx`, `seat-category-detail.tsx`,
  badge trạng thái (icon + chữ, không chỉ dựa vào màu).
- Dùng lại `cn()`, `cva`, `Badge` (variant `success`/`muted` đã có),
  `Table`, `Card`, `Input`, `Button` hiện có.
- Truy cập: label gắn với input, `aria-invalid` + `aria-describedby`
  cho thông báo lỗi, focus-visible, nút chỉ có icon phải có `aria-label`.
- Lưu ý bài học từ F-UI trước: **không truyền function/component qua ranh
  giới Server → Client**.

### T6. Route (phụ thuộc: T5)
- `src/app/(admin)/seat-categories/{layout,loading,page}.tsx`,
  `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`, kèm
  `error.tsx` (error state). Layout + từng page đều gọi
  `requirePermission`. Empty state trong bảng.

### T7. Navigation (phụ thuộc: T1)
- `src/config/nav.ts`: thêm mục Seat Categories, icon `Armchair`,
  permission `seat_categories:manage`. Cập nhật `nav.test.ts` (số lượng
  nav item).

### T8. Tài liệu
- `docs/roadmap.md`: thêm trạng thái F08.
- `docs/security.md`: ghi rõ F08 tái dùng policy `seat_categories_*`,
  không thay đổi.
- `docs/database.md`: chỉ sửa nếu phát hiện sai lệch (nếu chọn B thì ghi
  migration mới).

### T9. Kiểm thử (agent `qa`)
Ánh xạ 12 kịch bản của ticket:

| # | Kịch bản | Cách kiểm thử |
|---|---|---|
| 1, 2 | admin / ops manager xem danh sách | page/layout guard test |
| 3, 4 | admin / ops manager tạo | action test (happy path) |
| 5, 6 | technician / partner_user bị chặn | action + layout test (FORBIDDEN) và RLS integration (insert/update bị từ chối) |
| 7 | trùng | tùy quyết định 1 (A: test kiểm tra tên trùng; B: test lỗi `23505`; C: bỏ) |
| 8 | giá trị không hợp lệ | schema + action test (số âm, max < min, thiếu trường) |
| 9 | sửa thành công | action test |
| 10 | id không tồn tại → not-found | page test + action `NOT_FOUND` |
| 11 | quan hệ ghế còn nguyên | integration: cập nhật category không làm đổi `seats.category_id`; hard-delete bị chặn (không có policy DELETE / FK RESTRICT) |
| 12 | RLS không bị yếu đi | mở rộng `rls.integration.test.ts` với block `seat_categories`; xác nhận không có thay đổi trong `supabase/migrations` (trừ khi chọn B) |

Chạy: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`.
Ghi chú: không có jsdom/RTL → không có test render component (nhất quán
với F06/F07); không cài thêm framework test.

### T10. Review (agent `reviewer`) và vòng lặp
Review theo `code-review-checklist`; lặp Step 2 → Step 3 đến khi không còn
phát hiện.

## Rủi ro và điểm cần dừng hỏi lại

- Migration: **không có** trong kế hoạch mặc định. Nếu chọn B, phải dừng xin
  phê duyệt trước khi viết migration.
- Thay đổi RBAC (T1) chỉ thêm một permission, không đổi cơ chế. Đây là thay
  đổi nhạy cảm về bảo mật nên cần bạn duyệt trong kế hoạch này.
- Không có breaking change: không đổi route, prop, hay response hiện có.
- Hiện tại `/seat-categories` chưa tồn tại; không xung đột route.
- Việc kiểm tra tên trùng ở mức ứng dụng (A) có thể có race condition.

## Ghi chú phiên bản

Tên route dùng `kebab-case` (`/seat-categories`) theo ticket. Trường dữ
liệu/API dùng `snake_case`.

## Quyết định đã chốt

1. Trùng lặp: chọn A. Kiểm tra `name` không phân biệt hoa/thường ở Server Action, không migration.
2. Chọn dùng `is_active` cho Deactivate/Activate, thêm nav item `Armchair` và permission `seat_categories:manage`.
3. Trạng thái: chờ bạn duyệt rõ ràng toàn bộ kế hoạch trước khi sang Step 2.
