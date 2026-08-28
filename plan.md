# Kế hoạch: F04 — RBAC (Role-Based Access Control)

## Tóm tắt

Triển khai nền tảng RBAC phía server cho 4 vai trò (`admin`,
`operations_manager`, `technician`, `partner_user`) với mô hình quyền
tập trung, các helper phân quyền tái sử dụng được, điều hướng (navigation)
theo vai trò, và ba khu vực route được bảo vệ dạng placeholder (internal/
admin operations, technician area, partner portal) cộng với trang
`/forbidden`. Việc phân quyền phải được thực thi ở phía server (Server
Components/layouts, và — như một pattern mà các feature sau này phải
tuân theo — Server Actions/Route Handlers), không bao giờ chỉ dựa vào
việc ẩn UI hay chỉ dựa vào middleware/proxy. Vai trò luôn phải lấy từ
`public.users`, khớp với `auth.uid()` đã được xác thực, không bao giờ lấy
từ input phía client; `partner_user` phải được thiết kế xoay quanh
`users.partner_id` theo cách tương thích với RLS trong tương lai (bản
thân RLS là F05, không triển khai ở đây).

Phạm vi loại trừ rõ ràng (theo yêu cầu và `CLAUDE.md` — "không triển khai
tính năng tương lai"): RLS policies, mọi CRUD thật cho partner/airport/
seat/booking, các workflow technician/cleaning/inspection, logic tài
chính, flight API, QR, KPI dashboards, ROI, AI. Ba trang khu vực route
chỉ là placeholder để chứng minh việc phân quyền.

Có một **điều kiện tiên quyết mang tính chặn (blocking)**: một **database
migration** để định nghĩa lại enum `user_role` — được đánh dấu bên dưới
là một thay đổi schema cần được người dùng phê duyệt riêng, theo quy tắc
thực thi của dự án, ngay cả khi nó đã là một phần của kế hoạch được
duyệt.

## Các file/module bị ảnh hưởng

**Database / migration (thay đổi schema — cổng phê duyệt riêng):**
- `supabase/migrations/<new_ts>_redefine_user_role_enum.sql` (mới)
- `src/types/database.types.ts` (regenerate)
- `supabase/seed.sql` — đã kiểm tra, **không cần thay đổi** (chỉ seed
  `role = 'technician'`, không đổi theo enum mới)

**RBAC core library (`src/lib/auth/`):**
- `src/lib/auth/roles.ts` (mới)
- `src/lib/auth/permissions.ts` (mới)
- `src/lib/auth/current-user.ts` (mới)
- `src/lib/auth/session.ts` — đã kiểm tra, **giữ nguyên** (vẫn là
  `getAuthUser`/`requireUser`, khối building-block chỉ dựa trên JWT)
- `src/lib/constants/routes.ts` (sửa — thêm `FORBIDDEN_ROUTE`)

**Cấu hình navigation:**
- `src/config/nav.ts` (mới — file đầu tiên trong `src/config`, chưa có
  convention trước đó)

**Layout/UI dùng chung:**
- `src/components/layout/app-shell.tsx` (mới)
- `src/components/layout/sidebar-nav.tsx` (mới, `"use client"`)

**Bảo vệ route (App Router):**
- `src/app/forbidden/page.tsx` (mới)
- `src/app/(dashboard)/layout.tsx` (mới)
- `src/app/(dashboard)/dashboard/page.tsx` (sửa — `requireUser()` →
  `requireAuth()`)
- `src/app/(admin)/admin/layout.tsx`, `src/app/(admin)/admin/page.tsx` (mới)
- `src/app/(technician)/technician/layout.tsx`,
  `src/app/(technician)/technician/page.tsx` (mới)
- `src/app/(partner)/partner/layout.tsx`,
  `src/app/(partner)/partner/page.tsx` (mới)
- `src/proxy.ts`, `src/lib/supabase/proxy.ts` — đã kiểm tra, **không cần
  thay đổi** (xem lý do ở Task 12)

**Feature auth (F03):**
- `src/features/auth/actions/signup.action.ts` (sửa — literal role
  hardcode)
- `src/features/auth/actions/signup.action.test.ts` (sửa — assertion
  tương ứng)

**Docs:**
- `docs/database.md`, `docs/security.md`, `docs/architecture.md`,
  `docs/roadmap.md` (sửa)

## Danh sách task

### Nhóm migration (thay đổi schema — cần phê duyệt riêng trước khi chạy)

**1. Viết migration cho enum `user_role`.**
`supabase/migrations/<new_ts>_redefine_user_role_enum.sql` (tạo bằng
`npx supabase migration new redefine_user_role_enum`). Cách làm: vì
Postgres không thể xóa giá trị enum tại chỗ, tạo type enum mới với 4 giá
trị theo yêu cầu, migrate `public.users.role` sang type mới qua một biểu
thức mapping, drop type cũ, đổi tên type mới thành `user_role`. Mapping đề
xuất (xem Open Question #1 để biết phương án thay thế và lý do):
`operator_admin → admin`, `partner_admin → partner_user`,
`partner_staff → partner_user`, `technician → technician` (không đổi).
`operations_manager` là giá trị hoàn toàn mới, không có tiền thân. Migration
này không chứa câu lệnh RLS nào — `users` vẫn thuộc diện ngoại lệ đã được
tài liệu hóa cho F05; thay đổi này chỉ đụng đến enum, không đụng đến bảo
mật bảng. Bao gồm khối comment rollback chuẩn (tạo lại enum 4 giá trị cũ +
mapping ngược) theo `.claude/skills/db-migration/SKILL.md`.
- **Đây là một database migration/thay đổi schema và phải được người dùng
  phê duyệt riêng trước khi thực thi, tách biệt với việc phê duyệt toàn bộ
  kế hoạch này.**

**2. Test migration cục bộ và regenerate types.**
Chạy `npx supabase db reset`, xác nhận đường rollback, sau đó
`npx supabase gen types typescript --local > src/types/database.types.ts`.
Commit file đã regenerate trong cùng thay đổi với migration, theo skill.
- Phụ thuộc: Task 1.

**3. Cập nhật role hardcode trong `signup.action.ts`.**
Đổi `role: 'partner_staff'` → `role: 'partner_user'` (giá trị ít đặc
quyền nhất mới, nhất quán với lý do hiện có của F03: "giá trị ít đặc
quyền nhất không yêu cầu gán partner"). Cập nhật 2 assertion trong
`signup.action.test.ts` (`"partner_staff"` → `"partner_user"`) cho khớp.
Không thay đổi hành vi nào khác — `partner_id` vẫn là `null` khi signup,
theo thiết kế hiện có của F03.
- Phụ thuộc: Task 2 (cần giá trị enum mới tồn tại/biên dịch được).

**4. Cập nhật bảng enum và ghi chú "provisional" trong `docs/database.md`.**
Thay giá trị của hàng `user_role` bằng 4 vai trò cuối cùng; xóa/thay câu
"`user_role` is provisional — expect a follow-up migration once F04 RBAC
defines the real role model" bằng một ghi chú ngắn rằng F04 đã chốt giá
trị này.
- Phụ thuộc: Task 2.

### RBAC core library

**5. Tạo `src/lib/auth/roles.ts`.**
Export `Role` là type alias của
`Database["public"]["Enums"]["user_role"]` (không bao giờ tự tay
duplicate, để không bao giờ lệch khỏi schema) và một mảng `ROLES: Role[]`
để duyệt (vd. lọc nav, admin UI sau này).
- Phụ thuộc: Task 2 (cần types đã regenerate).

**6. Tạo `src/lib/auth/permissions.ts`.**
Định nghĩa union kiểu string-literal `Permission` khớp chính xác với mô
hình đã nêu trong yêu cầu, không tự bịa thêm quyền:
- `operations_manager`: `airports:manage`, `partners:manage`,
  `seats:manage`, `bookings:manage`, `technicians:manage`,
  `cleaning:manage`, `inspections:manage`, `incidents:view`,
  `finance:view`, `dashboards:view`
- `technician`: `jobs:view_assigned`, `jobs:update_assigned`,
  `installation:perform`, `cleaning:create`, `inspections:create`,
  `incidents:report`
- `partner_user`: `bookings:view_own_partner`, `seats:view_own_partner`,
  `operations:view_own_partner`, `finance:view_own_partner`
- `admin`: không cần danh sách tường minh — `hasPermission()` short-circuit
  trả về `true` cho `role === 'admin'` trước khi tra map, khớp đúng nghĩa
  "full system access" và tránh việc phải duy trì một danh sách trùng lặp
  theo mọi quyền tương lai.

Export `ROLE_PERMISSIONS: Record<Exclude<Role, 'admin'>, Permission[]>`
và một hàm thuần `hasPermission(role: Role, permission: Permission): boolean`.
Hàm thuần, không I/O — đây là file mà QA nên viết unit test.
- Phụ thuộc: Task 5.

**7. Tạo `src/lib/auth/current-user.ts`.**
File mới (tách riêng khỏi `src/lib/auth/session.ts` hiện có đã được
test, để tránh rủi ro regression cho các helper chỉ-dựa-JWT của F03).
Export:
- Interface `AppUser`: `{ id, email, full_name, role: Role, partner_id: string | null, is_active: boolean }`.
- `getCurrentUser(): Promise<AppUser | null>` — gọi `getAuthUser()`
  trước; nếu không có JWT, trả về `null`. Ngược lại truy vấn
  `public.users` lọc bằng `.eq('id', authUser.id)` — một **truy vấn
  tự-tra-cứu khớp với `auth.uid()` đã được server xác thực của chính
  người gọi**, không bao giờ là truy vấn danh sách — và trả về `null`
  nếu thiếu row, query lỗi, hoặc `is_active` là `false` (fail closed với
  tài khoản bị vô hiệu hóa dù session vẫn còn sống).
- `requireAuth(): Promise<AppUser>` — không có session → `redirect(LOGIN_ROUTE)`;
  có session nhưng profile không hợp lệ/không active →
  `redirect(FORBIDDEN_ROUTE)` (xem Open Question #3); ngược lại trả về
  `AppUser`.
- `requireRole(allowed: Role[]): Promise<AppUser>` — gọi `requireAuth()`,
  sau đó `redirect(FORBIDDEN_ROUTE)` trừ khi `user.role === 'admin'` hoặc
  `allowed.includes(user.role)`.
- `requirePermission(permission: Permission): Promise<AppUser>` — gọi
  `requireAuth()`, sau đó `redirect(FORBIDDEN_ROUTE)` trừ khi
  `hasPermission(user.role, permission)`.

Cân nhắc bọc truy vấn `public.users` bằng `cache()` của React để các
layout lồng nhau (vd. `(admin)/layout.tsx` gọi `requirePermission` sau
guard kiểu `(dashboard)`) không phát sinh round-trip DB trùng lặp trên
mỗi request — đây là chi tiết hiệu năng, không phải yêu cầu về tính đúng
đắn.
- Phụ thuộc: Task 5, Task 6.

**8. Thêm `FORBIDDEN_ROUTE` vào `src/lib/constants/routes.ts`.**
`export const FORBIDDEN_ROUTE = "/forbidden";`, theo đúng pattern hiện có
của `LOGIN_ROUTE`/`DASHBOARD_ROUTE`. **Không** thêm vào `PUBLIC_ROUTES` —
một user đã đăng nhập nhưng không được phép truy cập trang này không bao
giờ rơi vào nhánh redirect-cho-unauthenticated của proxy, nên không cần
sửa proxy (xem Task 12).
- Độc lập; có thể làm bất cứ lúc nào trước Task 9.

### Trang `/forbidden`

**9. Tạo `src/app/forbidden/page.tsx`.**
Route cấp cao nhất, nằm ngoài mọi route group (phải render được cho user
không có role/profile hợp lệ, nên không được tự gọi `requireAuth()` —
điều đó sẽ có nguy cơ gây redirect loop). Chỉ dùng `getAuthUser()` để
quyết định hiển thị `LogoutButton` sẵn có
(`src/features/auth/components/logout-button.tsx`) hay link "đăng nhập".
Nội dung chung chung, không rò rỉ thông tin, an toàn để bao phủ cả hai
trường hợp "đã đăng nhập nhưng không được phép" và "profile thiếu/không
hợp lệ" mà không xác nhận trường hợp nào đang xảy ra (xem Open Question #3).
- Phụ thuộc: Task 8.

### Cấu hình navigation

**10. Tạo `src/config/nav.ts`.**
`NavItem = { label: string; href: string; permission: Permission }[]`.
Gate 3 link khu vực bằng các permission đã có sẵn thay vì bịa thêm
permission mới (xem Open Question #4):
- "Admin Operations" → `/admin`, `dashboards:view`
- "Technician Jobs" → `/technician`, `jobs:view_assigned`
- "Partner Portal" → `/partner`, `bookings:view_own_partner`

Export hàm thuần `getVisibleNavItems(role: Role): NavItem[]` xây trên
`hasPermission()` — nguồn sự thật duy nhất, dùng chung cho cả sidebar và
(gián tiếp) cho route guard (cùng permission gate cả hai).
- Phụ thuộc: Task 6.

### UI layout dùng chung

**11. Tạo `src/components/layout/app-shell.tsx`.**
Server Component. Props `{ user: AppUser; children: ReactNode }`. Tính
`getVisibleNavItems(user.role)` và truyền danh sách đã lọc sẵn cho
sidebar — việc lọc (logic nghiệp vụ) xảy ra ở server, không bao giờ lặp
lại trong client component, theo `.claude/rules/frontend.md`.
- Phụ thuộc: Task 10.

**12. Tạo `src/components/layout/sidebar-nav.tsx`.**
Client component nhỏ (`"use client"`) — chỉ có trách nhiệm style active
link dựa trên `usePathname()` qua `cn()`. Nhận `NavItem[]` đã lọc sẵn qua
props; không chứa logic phân quyền nào.
- Phụ thuộc: Task 10.

### Bảo vệ route — 3 khu vực + dashboard hiện có

**13. Thêm `src/app/(dashboard)/layout.tsx`.**
File mới. Gọi `requireAuth()`, render
`<AppShell user={user}>{children}</AppShell>`. Cập nhật
`src/app/(dashboard)/dashboard/page.tsx` để gọi `requireAuth()` thay vì
`requireUser()` (defense-in-depth, khớp với tiền lệ hiện có của F03
"layout guard, page cũng guard") — đây là superset chặt của check cũ
(thêm validate profile/active) và là hành vi đúng theo yêu cầu 8.
- Phụ thuộc: Task 7, Task 11.

**14. Thêm khu vực admin.**
`src/app/(admin)/admin/layout.tsx` và `page.tsx`. Cả hai gọi
`requirePermission('dashboards:view')`; layout render `AppShell`; page là
placeholder tối giản (heading + role hiện tại) chứng minh guard hoạt
động. Không có nội dung admin/ops thật.
- Phụ thuộc: Task 7, Task 11.

**15. Thêm khu vực technician.**
`src/app/(technician)/technician/layout.tsx` và `page.tsx`. Cả hai gọi
`requirePermission('jobs:view_assigned')`. Chỉ có nội dung placeholder.
- Phụ thuộc: Task 7, Task 11.

**16. Thêm khu vực partner portal.**
`src/app/(partner)/partner/layout.tsx` và `page.tsx`. Cả hai gọi
`requirePermission('bookings:view_own_partner')`. Trang placeholder nên
thể hiện rõ ý định thiết kế cách ly partner (vd. render `user.partner_id`,
với trạng thái rỗng/an toàn rõ ràng khi giá trị là `null`) — chứng minh
pattern mà mọi truy vấn thật trong tương lai ở khu vực này phải tuân
theo, mà không thực hiện bất kỳ truy vấn bảng Supabase thật nào (không
có CRUD partner/booking nào trong phạm vi ở đây).
- Phụ thuộc: Task 7, Task 11.

### Tài liệu

**17. Cập nhật `docs/security.md`.**
Thêm phần RBAC hoàn chỉnh: 4 vai trò, bảng quyền từ Task 6, mô tả tầng
phân quyền (`getCurrentUser` / `requireAuth` / `requireRole` /
`requirePermission`), 3 nhóm xử lý "unauthorized" (chưa đăng nhập →
`/login`; đã đăng nhập nhưng không được phép → `/forbidden`; profile
thiếu/không hợp lệ → `/forbidden` với nội dung chung chung), nguyên tắc
thiết kế cách ly partner (dựa trên `users.partner_id`, tương thích RLS
nhưng chưa phải RLS), và một ghi chú rõ ràng rằng truy vấn tự-tra-cứu của
`getCurrentUser()` trên `public.users` an toàn mà không cần RLS *chính
xác vì* nó khớp với `auth.uid()` đã được server xác thực của chính người
gọi — điều này **không** tạo tiền lệ cho việc truy vấn bất kỳ bảng
tenant-scoped nào khác mà không có RLS trước khi F05 triển khai.
- Phụ thuộc: các Task 5–16 đã hoàn thiện (tài liệu phản ánh hình dạng
  thực tế đã xây).

**18. Cập nhật `docs/architecture.md`.**
Ghi lại các module mới trong `src/lib/auth/`, `src/config/nav.ts`, shell
trong `src/components/layout/`, và 3 route group mới bên cạnh mô tả hiện
có của `(auth)`/`(dashboard)`.
- Phụ thuộc: Task 5–16.

**19. Cập nhật `docs/roadmap.md`.**
Đánh dấu F04 done, theo đúng phong cách của các mục trạng thái F01–F03 —
task cuối cùng, sau khi lint/build/tests đã pass.
- Phụ thuộc: tất cả task trước đó.

## Phụ thuộc (Dependencies)

- Task 1 (migration) chặn Task 2, 3, 4, 5 — không có gì tham chiếu tới
  literal role mới có thể biên dịch được cho tới khi enum được định
  nghĩa lại và types được regenerate.
- Task 2 chặn Task 3 và Task 5.
- Task 5 và 6 chặn Task 7; Task 6 chặn Task 10.
- Task 7 chặn Task 13–16 (tất cả route guard).
- Task 8 chặn Task 9.
- Task 10 chặn Task 11 và 12.
- Task 11 (và Task 7) chặn Task 13–16.
- Task 5–16 chặn các task tài liệu (17–19).
- Task 1 là một **cổng chặn cứng (hard gate)**: phải nhận được phê duyệt
  riêng, tách biệt với việc phê duyệt toàn bộ kế hoạch này, trước khi
  thực thi.

## Rủi ro & edge case

- **`partner_user` với `partner_id = null`.** Signup vẫn set
  `partner_id: null` (không đổi so với F03). Khu vực partner portal và
  bất kỳ truy vấn partner-scoped nào trong tương lai phải coi đây là
  "chưa gán partner → trạng thái rỗng an toàn", không bao giờ coi là
  "không giới hạn → thấy tất cả". Điều này phải được thiết kế đúng ngay
  trong trang placeholder (Task 16) để pattern đúng ngay từ đầu.
- **`public.users` vẫn chưa có RLS** (ngoại lệ F05, không đổi). Truy vấn
  duy nhất an toàn mà yêu cầu này đưa vào là truy vấn tự-tra-cứu một dòng
  của `getCurrentUser()`, khớp với `auth.uid()` đã xác thực. Không được
  copy pattern này để truy vấn các bảng tenant-scoped khác trước khi F05
  triển khai RLS thật.
- **User bị vô hiệu hóa.** `is_active = false` kết hợp với session
  Supabase Auth vẫn còn hợp lệ (chưa có tính năng thu hồi session) phải
  bị `getCurrentUser()` từ chối, không chỉ lọc ở component.
- **Bypass của admin phải tập trung.** Short-circuit `role === 'admin'`
  chỉ nên nằm trong `hasPermission()`/`requireRole()`. Một layout/page tự
  triển khai lại kiểu `if (role === 'admin' || ...)` sẽ làm phân tán logic
  role và vi phạm yêu cầu 1/2.
- **Tự đổi role.** Không có Server Action nào bị đụng chạm bởi yêu cầu
  này nhận field `role`/`partner_id` từ client (signup đã hardcode cả
  hai). Điều này chỉ đúng vì chưa có tính năng gán-role/quản-lý-user-admin
  nào được xây ở đây — đánh dấu là việc cần làm trong tương lai, chưa
  triển khai ở đây.
- **Đổi tên enum không thể đảo ngược.** Migration `user_role` là một thay
  đổi cấu trúc một chiều lên schema history đã được ship. Mapping được
  chọn (`partner_admin`/`partner_staff` → `partner_user`,
  `operator_admin` → `admin`) là một quyết định về ngữ nghĩa thật sự,
  không chỉ đổi tên, nên cần được xác nhận rõ ràng (xem Open Question #1).
- **Tên route gắn liền với roadmap.** `/admin`, `/technician`, `/partner`
  hoàn toàn có thể trở thành nơi ở lâu dài cho F06–F09 (quản lý ops),
  F14–F15 (workflow technician), và F21 ("Partner Portal" — cùng tên
  trong roadmap). Coi các route group này là cấu trúc dài hạn dự định để
  mở rộng, không phải đường demo tạm bợ để thay sau.
- **Không sửa `proxy.ts`.** Việc check role/permission cần round-trip tới
  `public.users` và được thực hiện trong layout của Server Component,
  không phải ở tầng edge/middleware — nhất quán với yêu cầu 3 "không chỉ
  dựa vào middleware/proxy". Nếu sau này có ai "tối ưu hóa" việc này vào
  `proxy.ts` sẽ cần custom claims JWT cho role, một thay đổi lớn hơn
  nhiều và ngoài phạm vi hiện tại.
- **Coverage test cần đánh dấu cho agent `qa`** (theo yêu cầu 10, không
  được xây bởi kế hoạch này): chưa đăng nhập → redirect `/login` cho cả 4
  khu vực được bảo vệ; `admin` vào được cả 3 khu vực; trạng thái forbidden
  cho `operations_manager` ở khu vực technician/partner, được vào khu vực
  có quyền `dashboards:view`; `technician` bị chặn khỏi khu vực
  admin/partner, được vào khu vực technician; `partner_user` bị chặn khỏi
  khu vực admin/technician; `partner_user` không thể thấy dữ liệu của
  partner khác (kiểm tra ở mức thiết kế trên trang placeholder của Task
  16, việc thực thi thật sẽ đến khi có query thật sau này); role không
  thể bị đổi qua input Server Action bị chỉnh sửa (mở rộng test kiểu
  "injected role/partner_id" đã có sẵn trong `signup.action.test.ts`);
  user có JWT hợp lệ nhưng không có/có row `public.users` không hợp lệ
  được xử lý an toàn (`/forbidden`, không rò rỉ stack trace/lỗi DB); unit
  test `hasPermission()` theo từng role (hàm thuần, không I/O, theo
  `.claude/rules/testing.md`).

## Quyết định đã chốt (đã được người dùng phê duyệt ngày 2026-08-28)

- Duyệt toàn bộ plan.md, bao gồm các đề xuất mặc định cho 7 câu hỏi mở
  bên dưới.
- **Open question #1 (mapping enum)**: chốt theo đề xuất —
  `operator_admin → admin`, `partner_admin → partner_user`,
  `partner_staff → partner_user`, `technician` giữ nguyên,
  `operations_manager` thêm mới. Migration Task 1 được phê duyệt riêng
  để thực thi.
- **Open question #7 (admin bypass)**: chốt — `admin` bypass tất cả 3
  khu vực (`/admin`, `/technician`, `/partner`), khớp với "full system
  access".
- **Open question #5 (tên route)**: chốt — dùng `/admin` (ngắn gọn).
- **Open question #2, #3, #4, #6**: chốt theo đề xuất mặc định của
  planner (route group anh em `(admin)`/`(technician)`/`(partner)`;
  dùng chung một trang `/forbidden`; nav dùng lại permission nghiệp vụ
  sẵn có thay vì permission `*:access` riêng; `partner_user` là role mặc
  định mới khi signup với `partner_id = null`).

## Câu hỏi mở (Open questions) — đã chốt, giữ lại để tham khảo lý do

1. **Mapping enum cho migration.** Đề xuất: `operator_admin → admin`,
   `partner_admin → partner_user`, `partner_staff → partner_user`,
   `technician` giữ nguyên; `operations_manager` thêm mới, không có tiền
   thân. Phương án thay thế (tránh migration): giữ 4 giá trị enum DB hiện
   tại và thêm một tầng chuyển đổi ở mức application, map tên role theo
   yêu cầu ↔ literal DB tại ranh giới của `getCurrentUser`/
   `signup.action.ts`. **Không khuyến nghị** — `operations_manager` không
   có giá trị DB nào để map tới dù chọn phương án nào, nên phương án này
   vẫn cần migration enum để thêm giá trị đó; nó chỉ tránh được việc đổi
   tên 3 giá trị còn lại trong khi tạo thêm gánh nặng bảo trì tầng
   chuyển đổi vĩnh viễn và rủi ro lệch dữ liệu. Khuyến nghị chọn migration
   đầy đủ.
2. **Cấu trúc route group.** Đề xuất: giữ nguyên `(dashboard)`, thêm 3
   route group anh em mới `(admin)`, `(technician)`, `(partner)`, mỗi cái
   có `layout.tsx` riêng gọi `AppShell` — chấp nhận một chút lặp lại
   guard-and-wrap giữa 4 file layout. Phương án thay thế: gộp cả 4 vào
   một route group cha `(app)` với một shell layout dùng chung, việc này
   sẽ di chuyển `src/app/(dashboard)/dashboard/page.tsx` (URL không đổi,
   vì route group không ảnh hưởng URL, nhưng đổi đường dẫn file hiện có
   của F03). Khuyến nghị phương án route group anh em, ít xâm lấn hơn.
3. **Dùng chung trang `/forbidden` cho cả "unauthorized" và "profile
   thiếu/không hợp lệ".** Đề xuất: có, một trang, nội dung chung chung.
   Phương án thay thế: một route riêng cho trường hợp lỗi profile.
   Khuyến nghị dùng chung để giữ bề mặt (surface area) nhỏ, theo đúng
   yêu cầu 8 "Tạo trang `/forbidden` **nếu phù hợp**".
4. **Permission gate cho từng khu vực dùng lại permission nghiệp vụ đã
   có** (`dashboards:view`, `jobs:view_assigned`,
   `bookings:view_own_partner`) thay vì bịa thêm permission `*:access`
   riêng cho từng khu vực. Khuyến nghị dùng lại, để tránh thêm permission
   không có trong mô hình của yêu cầu; đánh dấu nếu reviewer muốn có
   permission truy cập khu vực tường minh riêng.
5. **Tên route chính xác** — `/admin` hay một cái gì đó sát nghĩa hơn với
   "internal/admin operations" trong yêu cầu (vd. `/operations`). Khuyến
   nghị `/admin` vì ngắn gọn, nhưng cần xác nhận vì đã nêu ở trên về việc
   gắn liền với roadmap dài hạn.
6. **`partner_user` là giá trị mặc định mới khi signup**, với
   `partner_id` vẫn là `null`. Xác nhận đây là edge case chủ đích, được
   xử lý an toàn (portal ở trạng thái rỗng) chứ không phải một dấu hiệu
   thiết kế có vấn đề đòi hỏi signup phải thu thập partner ngay lúc tạo
   tài khoản (ngoài phạm vi ở đây dù chọn cách nào, nhưng đáng để xác
   nhận rõ ràng).
7. **`admin` có nên bypass mọi guard khu vực**, kể cả khu vực technician
   và partner, hay hai khu vực đó vẫn giữ độc quyền theo role kể cả với
   `admin`? Cách đọc "full system access" trong yêu cầu nghiêng về
   bypass-tất-cả; khuyến nghị theo cách đọc đó, nhưng đánh dấu vì cách
   hiểu chặt hơn cũng khả thi.
</content>
