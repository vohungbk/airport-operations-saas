# F07 — Airport Management — Kế hoạch triển khai

## Summary

Xây dựng module quản lý sân bay nội bộ (`admin`/`operations_manager`) cho
phép xem danh sách, tạo mới, xem chi tiết và chỉnh sửa các sân bay mà nền
tảng sử dụng, tại `/airports`, `/airports/new`, `/airports/[id]`,
`/airports/[id]/edit`. Bảng `airports` đã tồn tại từ F02
(`supabase/migrations/20260826083747_create_airports_table.sql`) với đầy đủ
các cột `code` (unique), `name`, `city`, `country`, `timezone`, và F05 đã bật
RLS + policy `select`/`insert`/`update` đúng khớp với mô hình phân quyền
ticket yêu cầu (`admin`/`operations_manager` full write, mọi
`authenticated` user được `select`). Permission `airports:manage` cũng đã
tồn tại sẵn trong `src/lib/auth/permissions.ts` từ F04. Do đó **F07 không
cần migration mới, không cần thay đổi RLS, không cần thay đổi permission
model** — đây thuần là một module CRUD tầng ứng dụng, mirror gần như 1:1
cấu trúc `src/features/partners` (F06).

Ngoài phạm vi (explicitly out of scope theo ticket): seat inventory/
categories, booking management, flight management, QR/passport, technician
operations, finance, AI features, thay đổi auth/RBAC/multi-tenancy hiện có.

## Affected files/modules

**Feature module mới** — `src/features/airports/` (hiện chỉ có `.gitkeep`):
- `types.ts`
- `schemas/airport.schema.ts`, `schemas/airports-query.schema.ts`
- `lib/is-valid-timezone.ts`, `lib/build-airports-query-filters.ts`,
  `lib/get-airports.ts`, `lib/get-airport-by-id.ts`,
  `lib/get-airport-related-counts.ts` (có điều kiện — xem Open question 1),
  `lib/airport-errors.ts`
- `actions/create-airport.action.ts`, `actions/update-airport.action.ts`
- `hooks/use-create-airport-form.ts`, `hooks/use-update-airport-form.ts`
- `components/airport-form.tsx`, `components/create-airport-form.tsx`,
  `components/edit-airport-form.tsx`, `components/airports-table.tsx`,
  `components/airports-filters.tsx`, `components/airports-pagination.tsx`,
  `components/airport-detail.tsx`

**Route mới** — `src/app/(admin)/airports/` (chưa tồn tại):
- `layout.tsx`, `page.tsx`, `loading.tsx`, `new/page.tsx`,
  `[id]/page.tsx`, `[id]/edit/page.tsx` + các file `*.test.ts` tương ứng

**Cấu hình dùng chung, cần sửa nhỏ**:
- `src/config/nav.ts` — thêm nav item "Airports"

**Tài liệu cần cập nhật (doc-only, không có schema/RLS thay đổi)**:
- `docs/architecture.md` — thêm mục mô tả `src/features/airports` (F07),
  theo đúng khuôn mẫu mục "`src/features/partners` (F06)" hiện có
- `docs/roadmap.md` — cập nhật trạng thái F07 từ "next" sang "done" kèm mô
  tả ngắn, theo đúng khuôn mẫu các mục F01–F06 hiện có
- `docs/database.md` — **không cần sửa nội dung schema** (không có bảng/
  cột/constraint mới), nhưng nên thêm một dòng chú thích ngắn xác nhận
  "`airports` table is unchanged by F07 — see plan.md" để người đọc sau
  này không phải tự đi tra lại, theo đúng tinh thần F06 đã làm với
  `partners`
- `docs/security.md` — thêm một mục nhỏ "F07 — Airport Management" mô tả
  route-level gate (`requirePermission("airports:manage")`), theo đúng
  khuôn mẫu mục "F06 — Partner Management" hiện có, và nêu rõ **không có
  policy RLS mới**

**Test mở rộng (không phải file mới)**:
- `src/lib/auth/rls.integration.test.ts` — thêm `describe("airports
  table", ...)` để xác nhận (không thay đổi) hành vi RLS F05 hiện có

## Task list

1. **`src/features/airports/types.ts`** — alias `Airport` từ
   `Database["public"]["Tables"]["airports"]["Row"]` (generated types).
   Không có enum trạng thái (khác `partners` — bảng `airports` không có
   cột `status`), nên không có hằng số tương đương `PARTNER_STATUSES`.

2. **`src/features/airports/lib/is-valid-timezone.ts`** — hàm thuần
   `isValidIanaTimezone(value: string): boolean`, dựa trên
   `Intl.supportedValuesOf("timeZone")`. Không I/O, không phụ thuộc
   Supabase — test đơn vị theo `testing.md` (input hợp lệ như
   `"Asia/Dubai"`, input không hợp lệ như `"Not/AZone"`, chuỗi rỗng).

3. **`src/features/airports/schemas/airport.schema.ts`** —
   `createAirportSchema` (`code`: `trim()` + `toUpperCase()` transform +
   regex theo quyết định ở Open question 2, `name`/`city`/`country`:
   required non-empty, `timezone`: required + `.refine(isValidIanaTimezone,
   ...)`) và `updateAirportSchema` (giống hệt nhưng **không có field
   `code`** — `code` bất biến sau khi tạo, mirror chính xác
   `updatePartnerSchema`). Không pre-check uniqueness của `code` trong
   schema (tránh race TOCTOU) — để DB unique constraint + mapping lỗi
   `23505` xử lý, giống `partner.schema.ts`.

4. **`src/features/airports/schemas/airports-query.schema.ts`** —
   `partnersQuerySchema`-equivalent cho `/airports`: `q` (tìm theo
   code/name/city), `sort` (allowlist cột — xem Open question 4), `order`,
   `page`, `page_size`, dùng `.catch()` cho từng field như bản gốc.

5. **`src/features/airports/lib/build-airports-query-filters.ts`** — hàm
   thuần chuyển `AirportsQuery` thành filter Supabase-ready (bao gồm
   escape ký tự đặc biệt PostgREST `or=`, tái sử dụng đúng logic
   `escapePostgrestFilterValue` của `build-partners-query-filters.ts` —
   nhân bản cục bộ trong feature `airports`, không import chéo từ
   `features/partners`).

6. **`src/features/airports/lib/airport-errors.ts`** — mirror
   `partner-errors.ts`: `VALIDATION_ERROR`, `DUPLICATE_CODE` (map từ
   Postgres `23505` trên unique constraint của `airports.code`),
   `NOT_FOUND`, `INTERNAL_ERROR`. Không có `CONFLICT`/`ALREADY_INACTIVE`
   vì không có action deactivate (xem Open question 3).

7. **`src/features/airports/lib/get-airports.ts`** — server-only, đọc
   danh sách có search/sort/pagination; **không** tự thêm điều kiện lọc
   quyền truy cập nào khác — RLS (F05) là ranh giới truy cập, giống
   `get-partners.ts`.

8. **`src/features/airports/lib/get-airport-by-id.ts`** — server-only,
   `.maybeSingle()` để id không tồn tại (hoặc bị RLS ẩn) trả về `null`,
   caller chuyển thành `notFound()`.

9. **`src/features/airports/lib/get-airport-related-counts.ts`**
   (**có điều kiện** — chỉ làm nếu Open question 1 được xác nhận theo
   hướng "hiển thị số liệu thật") — 3 query `count: "exact", head: true`
   độc lập trên `seats`, `bookings`, `flights` lọc theo `airport_id`
   (mỗi bảng đã có index trên `airport_id`, không phải N+1 vì chỉ chạy 1
   lần cho trang chi tiết, không lặp theo danh sách).

10. **`src/features/airports/actions/create-airport.action.ts`** — Server
    Action, gọi `requirePermission("airports:manage")` đầu tiên, parse
    `createAirportSchema`, `insert` vào `airports`, map lỗi qua
    `airport-errors.ts`, `redirect("/airports/" + id)` khi thành công.

11. **`src/features/airports/actions/update-airport.action.ts`** — Server
    Action tương tự, `update` theo `id`, `.maybeSingle()` để phân biệt
    `NOT_FOUND` với lỗi Postgres thật, **không bao giờ ghi field `code`**
    (schema không có field này).

12. **`src/features/airports/hooks/use-create-airport-form.ts`** và
    **`use-update-airport-form.ts`** — mirror chính xác
    `use-create-partner-form.ts`/`use-update-partner-form.ts`
    (`useForm` + `zodResolver` tự viết + `useTransition` + gọi action).

13. **`src/features/airports/components/airport-form.tsx`** — field dùng
    chung `code`/`name`/`city`/`country`/`timezone`, `mode: "create" |
    "edit"`; `code` là input có thể chỉnh sửa chỉ ở `"create"`, là input
    `disabled readOnly` hiển thị giá trị hiện có ở `"edit"` (mirror
    `partner-form.tsx`). `timezone` là input text đơn giản (có placeholder
    ví dụ `"Asia/Dubai"`) — không thêm combobox/dependency mới.

14. **`components/create-airport-form.tsx`** / **`edit-airport-form.tsx`**
    — mirror `create-partner-form.tsx`/`edit-partner-form.tsx`, hiển thị
    `Alert` lỗi khi action trả `success: false`.

15. **`components/airports-table.tsx`** — Server Component, cột tối
    thiểu theo ticket: `code`, `name`, `city`, `country`, `timezone` +
    cột "Actions" (link "View"). Header sort là `<Link>` (không JS
    client), mirror `partners-table.tsx`.

16. **`components/airports-filters.tsx`** — Client Component, chỉ có ô
    tìm kiếm (không có `Select` trạng thái — `airports` không có cột
    `status`), tìm theo code/name/city.

17. **`components/airports-pagination.tsx`** — mirror
    `partners-pagination.tsx` 1:1 (Server Component, `<Link>` prev/next).

18. **`components/airport-detail.tsx`** — hiển thị `code`, `name`,
    `city`, `country`, `timezone`; khối "related counts" theo quyết định
    ở Open question 1 (số liệu thật hoặc placeholder "Not available
    yet", **không** hiển thị số `0` giả nếu chọn hướng placeholder — theo
    đúng lý do đã ghi trong `partner-detail.tsx`); nút "Edit"; **không có
    nút delete/deactivate nào** (xem Open question 3).

19. **Route pages** dưới `src/app/(admin)/airports/`:
    - `layout.tsx` — `requirePermission("airports:manage")` +
      `AppShell`
    - `page.tsx` (list) — `requirePermission` lần 2 (defense-in-depth,
      mirror `partners/page.tsx`), parse `searchParams` qua
      `airportsQuerySchema`, gọi `getAirports`, render
      filters/table/pagination, empty-state khi `total === 0`
    - `loading.tsx` — skeleton mirror `partners/loading.tsx`
    - `new/page.tsx` — `requirePermission` + render `CreateAirportForm`
    - `[id]/page.tsx` — `requirePermission` + `getAirportById` +
      `notFound()` khi null + render `AirportDetail`
    - `[id]/edit/page.tsx` — `requirePermission` + `getAirportById` +
      `notFound()` + render `EditAirportForm`

20. **`src/config/nav.ts`** — thêm `{ label: "Airports", href:
    "/airports", permission: "airports:manage" }` vào `NAV_ITEMS`.

21. **Unit tests** (theo `testing.md`, business logic thuần — không mock
    Supabase): `airport.schema.test.ts` (parse hợp lệ, thiếu field bắt
    buộc, `code` không hợp lệ, `timezone` không hợp lệ, `code` được
    uppercase, `update` schema không có field `code` dù input có gửi
    kèm), `is-valid-timezone.test.ts`,
    `build-airports-query-filters.test.ts`, `airports-query.schema.test.ts`.

22. **Server Action tests** (mock `requirePermission` + Supabase client,
    mirror `create-partner.action.test.ts`): `create-airport.action.test.ts`
    và `update-airport.action.test.ts`, tối thiểu mỗi action gồm: happy
    path (insert/update + redirect đúng URL), validation-failure path
    (không gọi Supabase), map lỗi `23505` → `DUPLICATE_CODE`, map lỗi
    Postgres khác → `INTERNAL_ERROR`, `NOT_FOUND` khi update id không
    tồn tại, và guard lan truyền redirect `/forbidden` khi
    `requirePermission` reject (role không hợp lệ **không bao giờ** gọi
    tới Supabase) — bao phủ các mục test 3, 4, 5, 6, 7, 8, 9, 10 trong
    yêu cầu ticket.

23. **Route guard tests** — `layout.test.ts`, `page.test.ts` cho
    list/new/`[id]`/`[id]/edit`, mirror chính xác các file tương ứng của
    `partners` (guard gọi đúng permission, redirect lan truyền, `notFound()`
    khi id không tồn tại) — bao phủ mục test 1, 2, 11.

24. **Mở rộng `src/lib/auth/rls.integration.test.ts`** — thêm
    `describe("airports table", ...)` chạy trên Postgres local thật, xác
    nhận (không tạo mới) hành vi F05 vẫn đúng sau khi F07 lên: admin và
    operations_manager `SELECT`/`INSERT`/`UPDATE` được; technician và
    partner_user `SELECT` được (do policy `using (true)`) nhưng bị từ
    chối `INSERT`/`UPDATE`; không có `DELETE` policy nào cho vai trò nào.
    Bao phủ mục test 12 ("Existing RLS/tenant security is not weakened").

25. **Cập nhật tài liệu** — `docs/architecture.md`,
    `docs/security.md`, `docs/roadmap.md`, `docs/database.md` (chú thích
    ngắn) như liệt kê ở "Affected files/modules". Làm sau cùng, sau khi
    code đã ổn định, để mô tả đúng những gì thực sự được xây.

## Dependencies

- Task 1 (types) chặn tất cả các task còn lại (mọi schema/lib/component
  đều import `Airport` type).
- Task 2 (timezone validator) chặn Task 3 (schema dùng nó trong
  `.refine()`).
- Task 3 (schema) chặn Task 10–14 (action, hook, form đều import schema
  này).
- Task 4–5 (query schema + filter builder) chặn Task 7 (`get-airports.ts`
  dùng cả hai) và Task 15–17 (table/filters/pagination cần shape
  `AirportsQuery`).
- Task 6 (error mapping) chặn Task 10–11 (action).
- Task 7–9 (lib đọc dữ liệu) chặn Task 19 (route pages gọi trực tiếp các
  hàm này).
- Task 10–11 (action) chặn Task 12 (hook gọi action) chặn Task 13–14
  (component dùng hook).
- Task 13 (`airport-form.tsx` dùng chung) chặn Task 14 (create/edit form
  cụ thể).
- Task 15–18 (component hiển thị) chặn Task 19 (page lắp ráp component).
- Task 19 (route pages) chặn Task 20 (nav item trỏ tới route đã tồn tại)
  và Task 23 (test route cần page tồn tại để import).
- Task 21–24 (test) nên viết song song ngay sau task tương ứng đã xong,
  không dồn hết về cuối, nhưng về mặt phụ thuộc kỹ thuật chúng chặn sau
  các task mã nguồn tương ứng (2→21 timezone test; 3→21 schema test;
  5→21 filter test; 10/11→22; 19→23; F05 migration đã có sẵn→24, không
  phụ thuộc code mới).
- Task 25 (docs) nên là task cuối cùng, sau khi toàn bộ hành vi đã chốt
  (đặc biệt phụ thuộc kết quả Open question 1 và 3 để mô tả đúng).
- **Không có task nào phụ thuộc vào migration hoặc thay đổi RLS/RBAC** —
  đây là điểm khác biệt quan trọng so với một feature có schema change:
  không có "pause-for-approval" nào theo diện schema/RLS bị kích hoạt bởi
  kế hoạch này, với điều kiện các phát hiện ở trên (bảng/RLS/permission
  đã đủ) được xác nhận đúng trước khi code.

## Risks & edge cases

- **Không có migration, không có thay đổi RLS/RBAC** — đã xác minh trực
  tiếp bằng cách đọc `supabase/migrations/20260826083747_create_airports_table.sql`
  (đủ cột `code`/`name`/`city`/`country`/`timezone`, `code` đã `unique
  not null`) và `supabase/migrations/20260902085338_enable_rls_multi_tenancy.sql`
  (policy `airports_select_authenticated`/`airports_insert_admin_ops_manager`/
  `airports_update_admin_ops_manager` đã khớp chính xác mô hình quyền
  ticket yêu cầu), cùng `src/lib/auth/permissions.ts` (permission
  `airports:manage` đã tồn tại, đã gán cho `operations_manager`, `admin`
  bypass qua `hasPermission`). **Vì không có thay đổi nào thuộc 3 diện
  này, plan này không có mục nào cần dừng lại chờ approval theo cơ chế
  "schema change / RLS change" của workflow** — chỉ cần dev agent xác
  nhận lại các phát hiện trên còn đúng tại thời điểm code (schema có thể
  đã trôi nếu có migration khác chen vào).
- **`Intl.supportedValuesOf("timeZone")`** phụ thuộc bản build Node có
  ICU đầy đủ. Node mặc định (kể cả trong Next.js build/deploy chuẩn) có
  full-ICU, nhưng nếu môi trường triển khai dùng bản Node rút gọn ICU,
  toàn bộ timezone sẽ bị coi là không hợp lệ một cách âm thầm — cần xác
  nhận môi trường CI/production trước khi dựa vào hàm này làm nguồn xác
  thực duy nhất.
- **Không có DB CHECK constraint nào cho format của `code`** — ticket
  viết "code uppercase + must match existing DB constraint" nhưng qua
  kiểm tra, bảng `airports` **không có constraint đó**, chỉ có
  `unique not null`. Validation format code do đó hoàn toàn nằm ở tầng
  Zod, không có backstop DB. Nếu chọn regex sai (quá chặt hoặc quá lỏng),
  sẽ không có DB nào chặn lại — xem Open question 2.
- **Không có action delete/deactivate** trong phạm vi task list này (xem
  Open question 3). RLS đã không có `DELETE` policy nào cho bất kỳ role
  nào trên `airports` (nhất quán với toàn bộ 18 bảng), nên kể cả khi có
  lỗi lập trình cố tình gọi `.delete()`, DB sẽ tự chặn — nhưng đây là lớp
  phòng thủ cuối, không thay thế việc không cung cấp UI/action delete.
- **`airports` là shared reference data với policy `select ... using
  (true)`** — mọi role `authenticated` (kể cả `technician`,
  `partner_user`) đã có thể `SELECT` toàn bộ bảng `airports` trực tiếp ở
  tầng DB. Việc chặn toàn bộ route `/airports*` chỉ cho
  `admin`/`operations_manager` (mirror F06) là một lựa chọn **hẹp hơn**
  RLS cho phép — đúng theo nguyên tắc "RLS is the last line of defense,
  not a substitute for route guard", nhưng cần xác nhận đây đúng là
  hành vi mong muốn (một `technician` sẽ luôn bị redirect `/forbidden`
  khi vào `/airports`, dù DB kỹ thuật cho phép đọc).
- **Race điều kiện khi tạo trùng `code`** — dựa hoàn toàn vào unique
  constraint DB + map lỗi `23505`, không pre-check bằng `SELECT` trước
  `INSERT` (tránh TOCTOU), giống hệt cách `partners` xử lý — cần giữ
  nguyên pattern này, không "tối ưu" bằng cách thêm bước kiểm tra tồn
  tại trước.
- **`code` bất biến sau khi tạo** — `updateAirportSchema` không có field
  `code`; edit form chỉ hiển thị `code` dạng `disabled readOnly`. Không
  được để lọt bất kỳ đường nào (kể cả form bị can thiệp phía client) làm
  thay đổi `code` qua action update.
- **Related counts (nếu triển khai)** đọc trực tiếp vào bảng `seats`,
  `bookings`, `flights` — các bảng này thuộc các domain feature **chưa
  triển khai** (Seat Inventory F09, Booking Management F11, Flight
  Integration F20). F06 (`partner-detail.tsx`) đã cố tình **không** làm
  điều tương tự với `bookings`/`seats` dù các bảng đó cũng đã tồn tại từ
  F02, với lý do "feature quản lý domain đó chưa ra mắt" — dù bảng có
  tồn tại. F07 ticket lại yêu cầu ngược lại ("nếu lấy được sạch sẽ từ
  schema thì hiển thị"). Đây là mâu thuẫn thực sự với tiền lệ gần nhất
  mà tôi được yêu cầu mirror — xem Open question 1, cần xác nhận rõ
  trước khi code Task 9/18.
- Không có test runner mới cần cài — `vitest` đã có sẵn
  (`package.json`), dùng đúng cấu hình hiện tại.

## Quyết định đã chốt (approved 2026-09-07)

1. **Related counts**: dùng số liệu thật — Task 9
   (`get-airport-related-counts.ts`) triển khai 3 query
   `count: "exact", head: true` trên `seats`/`bookings`/`flights` lọc
   theo `airport_id`; Task 18 hiển thị số liệu này trên
   `airport-detail.tsx`.
2. **Format của `code`**: chữ hoa/số, 2–10 ký tự
   (`/^[A-Z0-9]{2,10}$/`) trong `createAirportSchema`.
3. **Delete/Deactivate**: xác nhận không nằm trong phạm vi F07. Không
   thêm cột trạng thái, không có UI/action xóa/deactivate. Vì không có
   hành động không thể hoàn tác nào trong phạm vi này, không cần dialog
   xác nhận (giải quyết luôn mục đã nêu ở dưới về confirmation dialog).
4. **Cột sort mặc định**: `[code, name, city, country, created_at]`,
   mặc định `code asc` (giữ nguyên đề xuất của planner, không có phản
   hồi khác).
