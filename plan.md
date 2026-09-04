# Kế hoạch: F06 — Partner Management

## Quyết định đã chốt

Người dùng đã phê duyệt kế hoạch (approve, start implement). Các câu hỏi
mở được chốt theo phương án mặc định đã nêu trong từng câu hỏi, vì
người dùng không yêu cầu thay đổi phương án nào:

1. **`contact_email`** — **bắt buộc** (required), khớp constraint
   `NOT NULL` hiện có của DB. Không migration nào được thực hiện để
   nới lỏng cột này.
2. **`code`** — **immutable** sau khi tạo. Form edit không có field
   `code` để chỉnh sửa (hiển thị read-only, không đăng ký vào form
   submission); `updatePartnerSchema` không nhận `code`.
3. **Toast/success feedback** — **không** thêm dependency `sonner`.
   Tái sử dụng component `Alert` sẵn có để hiển thị feedback thành
   công/lỗi inline, theo đúng rule "do not introduce unnecessary
   dependencies" của `CLAUDE.md`. Task 11 do đó **không** thêm toast
   primitive nào — chỉ thêm `table`, `select`, `dialog`, `badge`.
4. **`'suspended'` vs `'inactive'`** — flow "deactivate" (Task 10) chỉ
   nhắm `status = 'inactive'` như kế hoạch gốc. `'suspended'` vẫn
   reachable qua field `status` của form edit chung (Task 3/13),
   không có action riêng.
5. **Test runner** — xác nhận có sẵn (`vitest`), không cần quyết định
   thêm.
6. **Vị trí route** — giữ nguyên `src/app/(admin)/partners/**`, URL
   `/partners*` (không phải `/admin/partners`).

## Tóm tắt

F06 xây dựng module CRUD nội bộ để quản lý các partner cho thuê xe hơi
(rental-car partners): trang danh sách (`/partners`) có tìm kiếm/lọc/sắp
xếp/phân trang, trang tạo mới (`/partners/new`), trang chỉnh sửa
(`/partners/[id]/edit`), và trang chi tiết (`/partners/[id]`). Chỉ
`admin` và `operations_manager` được phép truy cập các trang này hoặc
kích hoạt bất kỳ mutation nào; `technician`, `partner_user`, và request
chưa xác thực phải bị chặn ở phía server, không chỉ ẩn trên UI. Việc
deactivate là cập nhật status mềm (`status = 'inactive'`) — không bao
giờ hard delete.

Phát hiện quan trọng từ bước khảo sát, định hình toàn bộ kế hoạch: bảng
`partners` **đã có đầy đủ RLS coverage từ F05**
(`supabase/migrations/20260902085338_enable_rls_multi_tenancy.sql`,
dòng 222–246) — `admin`/`operations_manager` có SELECT/INSERT/UPDATE
trên mọi row, `partner_user` chỉ SELECT trên row partner của chính họ
(`id = current_user_partner_id()`), `technician` không có policy nào
(mặc định deny → 0 row), và không bảng nào trong schema có DELETE
policy. **F06 không cần migration mới, không cần policy RLS mới/thay
đổi** — chỉ cần xây application layer trên nền RLS mà F05 đã thực thi,
cộng với cổng chặn `requirePermission("partners:manage")` ở server
(F04 đã có sẵn `partners:manage` trong danh sách permission của
`operations_manager`; `admin` bypass qua `hasPermission`).

Phạm vi loại trừ rõ ràng (theo ticket): airport management, seat
categories/inventory, booking management, QR passport, technician/
cleaning/inspection workflow, finance, flight API, dashboards/KPI/ROI/
AI, và partner-facing portal. Không đọc bảng `bookings`/`seats` nào
trong feature này.

## Các file/module bị ảnh hưởng

**Database / RLS** — không có thay đổi (xem xác nhận ở Task 1):
- `supabase/migrations/20260902085338_enable_rls_multi_tenancy.sql`
  (tham chiếu, dòng 222–246: `partners_select_admin_ops_manager`,
  `partners_select_partner_user`, `partners_insert_admin_ops_manager`,
  `partners_update_admin_ops_manager`)
- `supabase/migrations/20260826083744_create_partners_table.sql`
  (tham chiếu: `name`, `code` unique, `contact_email` not null,
  `status partner_status default 'pending'`)

**RBAC / permissions** (tham chiếu, không cần đổi — `partners:manage`
đã tồn tại):
- `src/lib/auth/permissions.ts`
- `src/lib/auth/current-user.ts` (`requirePermission`)
- `src/lib/auth/roles.ts`

**Module feature mới**:
- `src/features/partners/schemas/partner.schema.ts`,
  `partners-query.schema.ts` (+ `.test.ts`)
- `src/features/partners/lib/partner-errors.ts`, `get-partners.ts`,
  `get-partner-by-id.ts`, `build-partners-query-filters.ts`
  (+ `.test.ts` cho filter-builder — hàm thuần)
- `src/features/partners/actions/create-partner.action.ts`,
  `update-partner.action.ts`, `deactivate-partner.action.ts`
  (+ `.test.ts` mỗi action)
- `src/features/partners/hooks/use-create-partner-form.ts`,
  `use-update-partner-form.ts`
- `src/features/partners/components/partner-form.tsx`,
  `create-partner-form.tsx`, `edit-partner-form.tsx`,
  `partners-table.tsx`, `partners-filters.tsx`,
  `partners-pagination.tsx`, `partner-status-badge.tsx`,
  `deactivate-partner-button.tsx`, `partner-detail.tsx`
- `src/features/partners/types.ts`

**Route mới** (trong route group `(admin)` sẵn có, theo
`docs/architecture.md`):
- `src/app/(admin)/partners/layout.tsx` (+ `.test.ts`)
- `src/app/(admin)/partners/page.tsx` (+ `.test.ts`), `loading.tsx`
- `src/app/(admin)/partners/new/page.tsx` (+ `.test.ts`)
- `src/app/(admin)/partners/[id]/page.tsx` (+ `.test.ts`)
- `src/app/(admin)/partners/[id]/edit/page.tsx` (+ `.test.ts`)

**UI dùng chung (bổ sung shadcn)**:
- `src/components/ui/table.tsx`, `select.tsx`, `dialog.tsx`,
  `badge.tsx` (và toast primitive — xem Câu hỏi mở)

**Nav / shell**:
- `src/config/nav.ts` (thêm `NavItem` mới)

**Bộ test RLS hiện có** (mở rộng, không thay thế):
- `src/lib/auth/rls.integration.test.ts`, `src/lib/auth/rls-test-support.ts`

**Tài liệu**:
- `docs/architecture.md`, `docs/roadmap.md`, `docs/security.md` (xem
  Task 21). `docs/database.md` **không đổi** — không có schema change.

## Task list

1. **Xác nhận không cần migration** (task tài liệu, không code). Ghi
   nhận trong commit/PR rằng RLS của `partners` từ F05 (dòng 222–246
   của `20260902085338_enable_rls_multi_tenancy.sql`) đã thoả đúng mô
   hình access của F06: `admin`/`operations_manager` full read/write,
   `partner_user` chỉ đọc row của chính mình, `technician` 0 row,
   không có DELETE ở đâu cả. Không chạy workflow `db-migration` cho
   feature này. **Đây là quyết định không được tự ý đảo ngược** — nếu
   trong lúc implement phát hiện gap thật sự, phải dừng lại và báo
   theo rule "pause and ask" của workflow đối với thay đổi schema/RLS,
   không tự thêm policy.

2. **`src/features/partners/types.ts`** — type `Partner` alias từ
   `Database["public"]["Tables"]["partners"]["Row"]`, `PartnerStatus`
   alias từ `Database["public"]["Enums"]["partner_status"]`,
   `PARTNER_STATUSES` lấy từ `Constants.public.Enums.partner_status`
   (theo đúng pattern `Role`/`ROLES` trong `src/lib/auth/roles.ts`).
   Không phụ thuộc task nào.

3. **`src/features/partners/schemas/partner.schema.ts`** —
   `createPartnerSchema` (`name`: bắt buộc, trimmed string; `code`:
   bắt buộc, trimmed string, uniqueness kiểm tra qua bắt lỗi Postgres
   `23505` trong action, không pre-check ở schema; `contact_email`:
   bắt buộc, email hợp lệ — xem Câu hỏi mở về cách diễn đạt "valid when
   provided" trong ticket; `status`: `z.enum(PARTNER_STATUSES)`, mặc
   định `'pending'`) và `updatePartnerSchema` (giống vậy nhưng bỏ
   `code`, vì `code` được coi là immutable sau khi tạo — xem Câu hỏi
   mở). Phụ thuộc Task 2. Thêm `partner.schema.test.ts` (input hợp lệ,
   thiếu name, thiếu code, email sai, status sai).

4. **`src/features/partners/schemas/partners-query.schema.ts`** —
   validate `searchParams` của trang danh sách (`q` free text, `status`
   enum tuỳ chọn, `sort` giới hạn trong allowlist cột rõ ràng — `name`,
   `code`, `status`, `created_at` — `order` `'asc'|'desc'`,
   `page`/`page_size` là số nguyên có giới hạn/mặc định hợp lý). Đây
   là phần tương đương với rule "validate all external input with Zod"
   của `backend.md` áp dụng cho query string — không bao giờ nội suy
   giá trị `searchParams` thô vào lệnh `.order()`/`.ilike()` của
   Supabase. Phụ thuộc Task 2. Thêm `.test.ts` (params hợp lệ, page
   ngoài phạm vi, cột sort không hợp lệ bị reject/fallback, status
   không hợp lệ).

5. **`src/features/partners/lib/build-partners-query-filters.ts`** —
   hàm thuần chuyển query params đã validate thành
   `{ search, status, sort, order, range }`, bao gồm escape an toàn
   input tìm kiếm trước khi dùng trong filter PostgREST
   `.or("name.ilike....,code.ilike....")` (dấu phẩy/ngoặc trong input
   thô phải được escape/loại bỏ — cú pháp `or=` của PostgREST coi dấu
   phẩy là filter separator). Hàm thuần, test được, không import
   Supabase. Phụ thuộc Task 4. Thêm `.test.ts`.

6. **`src/features/partners/lib/get-partners.ts`** và
   **`get-partner-by-id.ts`** — hàm server-only dùng `createClient()`
   từ `src/lib/supabase/server.ts`, dùng filter từ Task 5, trả về
   `{ partners, total }` / `Partner | null`. Select cột tường minh
   (snake_case), không cần `select("*")` vì row nhỏ.
   `get-partner-by-id` dùng `.maybeSingle()` để id không tồn tại là
   `null` bình thường, không throw. Không join `bookings`/`seats` —
   theo quyết định placeholder (D5). Phụ thuộc Task 2, 5.

7. **`src/features/partners/lib/partner-errors.ts`** — map lỗi
   Supabase/Postgres thành cặp `{ code, message }` ổn định, dùng chung
   cho cả 3 Server Action: `23505` (unique violation trên
   `partners_code_key`) → `DUPLICATE_CODE`; row không tồn tại khi
   update nhắm vào id cũ → `NOT_FOUND`; còn lại → `INTERNAL_ERROR` với
   message chung chung (không bao giờ để raw Postgres error tới
   client, theo `code-review-checklist`). Phụ thuộc Task 2.

8. **`src/features/partners/actions/create-partner.action.ts`** —
   `"use server"`. Gọi `requirePermission("partners:manage")` trước
   tiên (re-check role ở server, không tin client dù trang đã được
   gate), rồi `createPartnerSchema.safeParse`, rồi insert qua server
   Supabase client, map lỗi qua Task 7. Phụ thuộc Task 3, 6 (pattern
   client), 7. Thêm `.test.ts` theo pattern mock của
   `login.action.test.ts`: happy path (redirect tới `/partners/[id]`),
   validation failure (thiếu name / email sai / status sai — không
   gọi Supabase), duplicate-code failure (`23505` map thành
   `DUPLICATE_CODE`), và unauthorized (mock `requirePermission` reject/
   redirect, assert insert không bao giờ được gọi).

9. **`src/features/partners/actions/update-partner.action.ts`** —
   giống Task 8 nhưng cho `updatePartnerSchema`, nhắm vào `id` có sẵn;
   trả `NOT_FOUND` nếu row không tồn tại. Phụ thuộc Task 3, 7. Thêm
   `.test.ts` (happy path, validation failure, partner không tồn tại,
   unauthorized).

10. **`src/features/partners/actions/deactivate-partner.action.ts`** —
    action riêng (không phải generic status-update) chỉ nhận
    `partner_id`. Re-check permission, đọc status hiện tại, trả
    `CONFLICT` nếu đã `'inactive'` thay vì âm thầm no-op, ngược lại
    set `status = 'inactive'`. Phụ thuộc Task 2, 7. Thêm `.test.ts`
    (thành công, đã inactive bị reject với `CONFLICT`, partner không
    tồn tại, unauthorized).

11. **Bổ sung shadcn UI primitives** — thêm `table`, `select`,
    `dialog`, `badge` qua `npx shadcn add <component>` (style
    `components.json` hiện có là `base-nova`, nên các component này
    sinh ra theo Base UI, nhất quán với `button.tsx`/`field.tsx`).
    **Toast primitive là câu hỏi mở — xem bên dưới; không thêm
    `sonner` khi chưa xác nhận.** Không phụ thuộc task khác; có thể
    làm song song với Task 2–10.

12. **`src/features/partners/components/partner-status-badge.tsx`**
    và **`partner-form.tsx`** — phần presentational.
    `partner-form.tsx` render các field name/code/contact_email/status
    dùng chung qua `react-hook-form`'s `register`, có prop
    `mode: "create" | "edit"` để render `code` là field disabled/
    read-only ở edit mode (theo quyết định immutability) thay vì ẩn
    hoàn toàn — để giá trị vẫn hiển thị tham khảo. Phụ thuộc Task 3,
    11.

13. **`use-create-partner-form.ts`**, **`use-update-partner-form.ts`**,
    **`create-partner-form.tsx`**, **`edit-partner-form.tsx`** — theo
    đúng pattern `useForm` + `useTransition` + Server Action của
    `use-signup-form.ts`/`signup-form.tsx`. Phụ thuộc Task 3, 8, 9, 12.

14. **`partners-table.tsx`**, **`partners-filters.tsx`**,
    **`partners-pagination.tsx`** — Server Component nếu có thể
    (`partners-table`, `partners-pagination` dùng `<Link>` prev/next
    thuần, không cần client JS cho pagination); `partners-filters.tsx`
    là Client Component duy nhất cần thiết (`"use client"`) cho ô tìm
    kiếm + `Select` status, cập nhật URL qua `useRouter`/`usePathname`
    + `URLSearchParams` (không client-side data fetching — Server
    Component re-render từ `searchParams` mới, đúng theo
    `frontend.md`: "no React Query for a page a Server Component can
    render directly"). Cột "số booking active" render placeholder
    tĩnh (ví dụ "—" kèm ghi chú "available once Booking Management
    ships"), không bao giờ là live query (D5). Phụ thuộc Task 6, 11,
    12.

15. **`deactivate-partner-button.tsx`** — `"use client"`, mở `Dialog`
    shadcn để confirm, gọi `deactivatePartnerAction` qua
    `useTransition`, hiển thị feedback thành công/lỗi (toast — xem Câu
    hỏi mở), gọi `router.refresh()` khi thành công. Phụ thuộc Task 10,
    11.

16. **`partner-detail.tsx`** — render thông tin partner/status/liên
    hệ + block placeholder ghi rõ ràng cho "active bookings" và
    "seat/inventory summary" (D5), cộng action `Edit`/`Deactivate`.
    Phụ thuộc Task 2, 12, 15.

17. **`src/config/nav.ts`** — thêm
    `{ label: "Partners", href: "/partners", permission: "partners:manage" }`
    vào `NAV_ITEMS`, đúng shape các entry hiện có. Không phụ thuộc,
    nên làm trước hoặc cùng Task 18.

18. **Routes**:
    - `src/app/(admin)/partners/layout.tsx` —
      `requirePermission("partners:manage")` + `AppShell`, copy cấu
      trúc `src/app/(admin)/admin/layout.tsx`.
    - `src/app/(admin)/partners/page.tsx` — gọi `requirePermission`
      độc lập lần 2 (theo tiền lệ double-guard của F04), parse
      `searchParams` qua schema Task 4, gọi `get-partners` Task 6,
      render table/filters/pagination Task 14, empty state khi
      `total === 0`, link "Add Partner" tới `/partners/new`.
    - `src/app/(admin)/partners/loading.tsx` — skeleton/loading state
      cho trang danh sách (Next.js `loading.tsx` Suspense convention).
    - `src/app/(admin)/partners/new/page.tsx` — guard + render
      `CreatePartnerForm` Task 13.
    - `src/app/(admin)/partners/[id]/page.tsx` — guard +
      `get-partner-by-id`; `notFound()` khi row không tồn tại; render
      `PartnerDetail` Task 16.
    - `src/app/(admin)/partners/[id]/edit/page.tsx` — guard +
      `get-partner-by-id` + `notFound()`; render `EditPartnerForm`
      Task 13.
    - Phụ thuộc Task 6, 13, 14, 16, 17.
    - Thêm `layout.test.ts` + một `page.test.ts` cho mỗi route, đúng
      pattern `src/app/(admin)/admin/layout.test.ts`/`page.test.ts`:
      mock `requirePermission`, assert được gọi với
      `"partners:manage"`, assert guard reject/redirect được propagate
      chứ không bị nuốt. Đây là cách cover "technician/partner_user/
      unauthenticated bị chặn" cho các route — logic role đã được unit
      test ở `current-user.test.ts`, không cần test lại, chỉ cần test
      layout/page mới wire đúng permission string.

19. **Mở rộng `src/lib/auth/rls.integration.test.ts`** với describe
    block `partners table`, tái dùng fixture/identity có sẵn từ
    `rls-test-support.ts` (không cần provisioning mới): admin/
    ops_manager `SELECT` được cả hai partner đã seed; client
    `partnerA` chỉ thấy `PARTNER_A_ID` (0 row cho `PARTNER_B_ID`,
    không phải lỗi); `technician` nhận 0 row trên `partners`; client
    `partnerA` bị reject khi `INSERT`/`UPDATE` trên `partners`; client
    `opsManager` `INSERT`/`UPDATE` thành công; anonymous đã được cover
    ở loop `ALL_18_TABLES` hiện có (xác nhận vẫn pass, không cần case
    anon mới). Không phụ thuộc code mới, nhưng về logic là validate
    giả định của Task 1, nên nên làm sớm (có thể song song với Task
    2–17, trước khi app code hoàn thiện).

20. **`npm run lint`, `npx tsc --noEmit`, `npm test`** sau khi các
    task trên hoàn tất, theo rule "run lint and build after significant
    changes" của `CLAUDE.md`.

21. **Cập nhật tài liệu**:
    - `docs/architecture.md` — bổ sung bullet `(admin)` group để nói
      F06 thêm `partners/`, `partners/new/`, `partners/[id]/`,
      `partners/[id]/edit/` trong `(admin)` route group (có
      `layout.tsx` guard riêng, URL là `/partners*` vì segment group
      không đóng góp vào path); thêm bullet shape
      `src/features/partners` dưới "Feature-Based Organization" theo
      đúng mẫu bullet `src/features/auth` hiện có.
    - `docs/roadmap.md` — đánh dấu **F06 — Partner Management: done**
      với tóm tắt ngắn (list/create/edit/detail pages, gate
      `requirePermission("partners:manage")`, chỉ soft-deactivation,
      tái dùng RLS F05 không thêm policy mới), chuyển con trỏ "next"
      sang F07.
    - `docs/security.md` — thêm ghi chú ngắn "F06 — Partner
      Management" dưới phần RBAC: không có RLS policy mới (tái dùng
      nguyên văn policy `partners_*` của F05), route-level gate
      (`requirePermission("partners:manage")` ở cả `layout.tsx` và mỗi
      `page.tsx`), và deactivation chỉ là DB-`status`-only (nhất quán
      với quy ước "no `ON DELETE CASCADE`... deactivated via `status`"
      đã ghi trong `docs/database.md`).
    - `docs/database.md` — **không đổi** (không có migration).

## Dependencies

- Task 1 là điều kiện tiên quyết cho mọi thứ còn lại — nếu RLS thực sự
  không đủ, dừng lại trước Task 2 và lập kế hoạch lại (sẽ trở thành
  "pause and ask" schema/RLS change theo rule của workflow).
- Task 2 → 3, 4 → 5, 6 → {7} → {8, 9, 10} tạo thành chuỗi backend;
  không phần nào trong chuỗi này phụ thuộc UI.
- Task 11 (shadcn primitives) không phụ thuộc code nào khác nhưng chặn
  Task 12, 14, 15 về mặt cấu trúc/hiển thị.
- Task 12 phụ thuộc 3 + 11; Task 13 phụ thuộc 3, 8, 9, 12; Task 14 phụ
  thuộc 6, 11, 12; Task 15 phụ thuộc 10, 11; Task 16 phụ thuộc 2, 12,
  15.
- Task 17 (nav) độc lập nhưng nên làm trước hoặc cùng Task 18 để khu
  vực mới reachable từ sidebar.
- Task 18 (routes) là điểm tích hợp — phụ thuộc 6, 13, 14, 16, 17, và
  là nơi thêm guard test.
- Task 19 (RLS integration test) không phụ thuộc code 2–18, có thể làm
  song song/sớm, nhưng nên chạy lại sau khi Task 18 xong để xác nhận
  regression.
- Task 20 chạy sau khi mọi task implementation hoàn tất.
- Task 21 (docs) chạy cuối cùng, sau khi implementation ổn định, vì nó
  tài liệu hoá hình dạng cuối cùng.

## Rủi ro & edge case

- **PostgREST `.or()` search injection/misparse**: dấu phẩy hoặc ngoặc
  không escape trong param `q` sẽ phá vỡ hoặc âm thầm đổi filter
  `name.ilike....,code.ilike....`. Phải xử lý ở Task 5, không để tới
  Task 6.
- **Race condition uniqueness của `code`**: hai request tạo cùng lúc
  cùng `code` — không pre-check bằng `SELECT` rồi `INSERT` (có gap
  TOCTOU); dựa vào `unique` constraint của DB và bắt lỗi `23505` ở
  Task 8/error mapper Task 7.
- **Bẫy "double coverage" của RLS**: vì `admin`/`operations_manager`
  đã có full DB-level access tới `partners`, dễ có xu hướng bỏ qua
  check `requirePermission("partners:manage")` ở app-level "vì RLS đã
  lo rồi". Cả hai lớp đều phải giữ — RLS policy là tuyến phòng thủ
  cuối theo `docs/security.md`, không thay thế route guard (và RLS
  một mình không thể tạo redirect `/forbidden` thân thiện hay chặn
  render trang trước khi query chạy).
- **Dữ liệu placeholder booking/seat không được trông giống dữ liệu
  thật.** Nếu cột "active bookings" để trống hoặc hiện `0`, operator
  có thể hiểu nhầm là "partner này thực sự có 0 booking active" thay
  vì "feature này chưa được xây". Placeholder phải rõ ràng cả về hình
  ảnh lẫn text (ví dụ copy "not available yet" tường minh, không phải
  `0` hay `—` trơn).
- **`deactivate` vs `suspended`**: `partner_status` có cả `'suspended'`
  và `'inactive'`. Flow deactivation của ticket nhắm vào `'inactive'`
  cụ thể; `'suspended'` chỉ reachable qua field status của form edit
  chung. Cần xác nhận việc phân tách này là chủ ý (xem Câu hỏi mở).
- **Stale read sau khi deactivate**: trang list/detail là Server
  Component re-render khi navigate/`router.refresh()` — không có
  client cache cần invalidate, nên không có rủi ro stale-data ngoài
  vòng đời request Next.js bình thường, nhưng nút deactivate phải
  trigger `router.refresh()` (hoặc redirect) để UI không hiện badge
  `'active'` cũ sau khi deactivate thành công.
- **Tránh N+1 theo thiết kế**: vì số "active bookings" là placeholder
  (không phải query thật theo từng row), không có rủi ro N+1 từ trang
  list — nêu rõ điều này để dev agent không "tiện tay" thêm query đếm
  `bookings` thật theo từng row sau này mà không xem lại quyết định
  này.
- **UX field `code` ở edit mode**: render `disabled` vẫn submit giá
  trị nếu field không bị loại khỏi form registration; Task 13 phải
  đảm bảo schema/action của edit thực sự không bao giờ nhận thay đổi
  `code`, không chỉ ngăn cản về mặt hiển thị.

## Câu hỏi mở

1. **`contact_email` bắt buộc hay tuỳ chọn.** Ticket nói "email valid
   when provided", ngụ ý tuỳ chọn, nhưng `partners.contact_email` là
   `not null` trong database
   (`supabase/migrations/20260826083744_create_partners_table.sql`).
   Kế hoạch này mặc định **bắt buộc** ở cả create và edit để khớp
   constraint DB. Vui lòng xác nhận trước khi implement Task 3 — nếu
   thực sự cần tuỳ chọn, cột database cần migration cho phép `null`,
   là schema change cần qua "pause and ask" gate.
2. **`code` có immutable không.** Kế hoạch này mặc định **immutable
   sau khi tạo** (loại khỏi form edit, hiển thị read-only). Vui lòng
   xác nhận — nếu `code` cần editable, Task 3/9 cần re-check
   uniqueness (vẫn qua bắt lỗi `23505`, không pre-check) và phần
   render read-only ở Task 12 bị bỏ.
3. **Toast/success-feedback phụ thuộc gì.** Codebase hiện chưa có
   toast primitive nào (`sonner` không có trong `package.json`; chỉ có
   `Alert`). Ticket yêu cầu rõ toast-style success feedback. Thêm
   `sonner` (giải pháp toast chuẩn của shadcn) là dependency mới, cần
   xác nhận trước khi làm Task 11/15, theo rule "do not introduce
   unnecessary dependencies" của `CLAUDE.md` — phương án thay thế là
   dùng lại component `Alert` hiện có inline thay vì toast, tránh
   dependency mới nhưng UX kém hơn yêu cầu.
4. **Ngữ nghĩa `'suspended'` vs `'inactive'`.** `partner_status` có 4
   giá trị (`pending`, `active`, `suspended`, `inactive`). Flow
   "deactivation" (tương đương soft-delete) của ticket được lên kế
   hoạch nhắm vào `'inactive'` cụ thể, `'suspended'` chỉ reachable qua
   form edit chung. Xác nhận mapping này đúng ý — nếu `'suspended'`
   mới là target thật sự của "deactivate" (thay vì/thêm vào
   `'inactive'`), action riêng ở Task 10 cần đổi.
5. **Test runner**: xác nhận **không bị block** — `package.json` đã có
   `"test": "vitest run"` và convention mock sẵn có
   (`vi.mock("@/lib/supabase/server", ...)`,
   `vi.mock("next/navigation", ...)`) cộng bộ test tích hợp RLS thật
   dùng local Supabase (`describe.skipIf(!config)`). Không cần quyết
   định tooling mới ở đây, khác với lo ngại ban đầu của ticket.
6. **Xác nhận vị trí route**: kế hoạch này đặt route mới tại
   `src/app/(admin)/partners/**`, tạo URL `/partners`, `/partners/new`,
   `/partners/[id]`, `/partners/[id]/edit` — thoả cả ý định nêu trong
   `docs/architecture.md` (F06 nằm trong `(admin)` group) lẫn path yêu
   cầu tường minh của ticket. Vui lòng xác nhận đây đúng là cấu trúc
   mong muốn, không phải literal URL `/admin/partners`.
