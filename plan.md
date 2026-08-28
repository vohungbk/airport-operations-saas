# F03 — Authentication: Kế hoạch triển khai

## Tóm tắt

F03 bổ sung xác thực người dùng dựa trên Supabase Auth: đăng ký/đăng nhập
bằng email-mật khẩu, đăng xuất, duy trì/làm mới session, đặt lại mật khẩu,
và bảo vệ route ở phía server — dùng đúng kiến trúc Supabase SSR đã được
dựng khung từ F01 (`src/lib/supabase/client.ts`, `server.ts`, `proxy.ts`,
`src/proxy.ts`). Kế hoạch cũng bao gồm bước "đồng bộ hồ sơ người dùng":
sau khi Supabase Auth tạo user thành công, tạo một dòng tương ứng trong
bảng ứng dụng `public.users` (schema F02) với vai trò (`role`) mặc định an
toàn nhất, được gán **hoàn toàn ở phía server** — không bao giờ lấy từ
client.

Ngoài phạm vi (theo đúng yêu cầu): RBAC UI, RLS policies (F05 — `public.users`
và mọi bảng F02 khác vẫn chưa có RLS, đúng như ngoại lệ đã ghi rõ trong
`docs/database.md`), quản lý partner/airport/seat/booking, chức năng QR,
luồng technician/cleaning/inspection, finance, flight API, dashboard, ROI,
AI. Không tạo migration mới, không thêm giá trị enum `user_role` mới,
không đổi seed data của F02 — F03 dùng đúng enum `user_role` hiện có:
`operator_admin | partner_admin | partner_staff | technician`.

## Rà soát hiện trạng (đã xác minh trực tiếp trong repo)

- `src/lib/supabase/client.ts`, `server.ts`, `proxy.ts` và `src/proxy.ts`
  đã tồn tại từ F01: browser client, server client (cookie try/catch cho
  Server Component), và middleware/`proxy` làm mới session qua
  `supabase.auth.getClaims()`. `src/proxy.ts` có sẵn cờ `isSupabaseConfigured`
  để bỏ qua khi `.env.local` chưa được điền — **phải giữ nguyên cờ này**.
- Route group `src/app/(auth)/` và `src/app/(dashboard)/` đã được dựng
  khung sẵn (hiện chỉ có `.gitkeep`) — xác nhận kiến trúc đã dự tính chỗ
  cho các trang auth và một khu vực dashboard, khớp với yêu cầu tạo
  `/login`, `/signup`, v.v. và một đích redirect sau đăng nhập.
- Thư mục `src/features/auth/` đã tồn tại (rỗng, chỉ `.gitkeep`) — đúng vị
  trí theo yêu cầu đề bài.
- Bảng `public.users` (migration
  `20260826083752_create_users_table.sql`): `id uuid primary key default
  gen_random_uuid()`, `email text unique`, `full_name text not null`,
  `role user_role not null`, `partner_id uuid references
  public.partners(id) on delete restrict` (nullable — dành cho
  `operator_admin` không gắn với partner nào), `is_active boolean default
  true`, `created_at`/`updated_at`. **Chưa có RLS** (đúng ngoại lệ F05).
- `package.json` đã có `@supabase/ssr`, `@supabase/supabase-js`, `zod`,
  `react-hook-form` — không cần thêm dependency mới.
- `src/components/ui/` hiện chỉ có `button.tsx` — chưa có `input`,
  `label`, `card`, `alert`, `form` của shadcn/ui.
- `.env.example` dùng key mới của Supabase:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  (client-safe), và `SUPABASE_SECRET_KEY` (server-only, chưa dùng, chỉ
  thêm khi có nhu cầu bypass RLS được ghi nhận). F03 **không** cần đến
  secret key này ở bất kỳ đâu.

## Các file/module bị ảnh hưởng

**Chỉ đọc để lấy ngữ cảnh (không sửa ngoài các mục nêu trong Task list):**
`CLAUDE.md`, `docs/architecture.md`, `docs/database.md`, `docs/security.md`,
`docs/roadmap.md`, `.claude/rules/frontend.md`, `.claude/rules/backend.md`,
`.claude/rules/testing.md`, `.claude/agents/{dev,reviewer,qa}.md`,
`src/lib/supabase/*`, `supabase/migrations/20260826083752_create_users_table.sql`,
`src/types/database.types.ts`, `components.json`, `.env.example`,
`package.json`, `src/app/layout.tsx`, `src/app/page.tsx`,
`src/components/ui/button.tsx`, `src/lib/utils.ts`.

**Mới — shadcn/ui primitives**
- `src/components/ui/input.tsx`, `label.tsx`, `card.tsx`, `alert.tsx`, `form.tsx`

**Mới — dùng chung, không thuộc riêng feature nào (`src/lib`)**
- `src/lib/validation/password.schema.ts`
- `src/lib/auth/session.ts` (`getAuthUser()` / `requireUser()`)
- `src/lib/constants/routes.ts` (`PUBLIC_ROUTES`, đích redirect sau đăng nhập)

**Mới — feature module (`src/features/auth`)**
- `schemas/login.schema.ts`, `signup.schema.ts`, `forgot-password.schema.ts`, `reset-password.schema.ts`
- `actions/login.action.ts`, `signup.action.ts`, `logout.action.ts`, `forgot-password.action.ts`, `reset-password.action.ts`
- `hooks/use-login-form.ts`, `use-signup-form.ts`, `use-forgot-password-form.ts`, `use-reset-password-form.ts`
- `components/login-form.tsx`, `signup-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx`, `logout-button.tsx`

**Mới — route (`src/app`)**
- `src/app/(auth)/layout.tsx`, `login/page.tsx`, `signup/page.tsx`, `forgot-password/page.tsx`, `reset-password/page.tsx`
- `src/app/api/auth/confirm/route.ts` (trao đổi link xác nhận email / recovery)
- `src/app/(dashboard)/dashboard/page.tsx` — trang landing tối giản sau đăng
  nhập, dùng route group đã có sẵn (xem mục Quyết định bên dưới)

**Sửa**
- `src/lib/supabase/proxy.ts`, `src/proxy.ts` (thêm bảo vệ route trên nền
  logic làm mới session hiện có)
- `docs/security.md`, `docs/architecture.md`, `docs/roadmap.md`

## Danh sách công việc (theo thứ tự phụ thuộc)

1. **Thêm các shadcn/ui primitive còn thiếu.** Thêm `Input`, `Label`,
   `Card`, `Alert`, `Form` qua CLI shadcn của dự án (`components.json`).
   Không phụ thuộc task nào.

2. **Hằng số route dùng chung — `src/lib/constants/routes.ts`.** Xuất
   `PUBLIC_ROUTES` (login/signup/forgot-password/reset-password + route
   `/api/auth/confirm`), `LOGIN_ROUTE`, và đích redirect sau khi đăng
   nhập (`/dashboard`, theo Quyết định #1). Chặn task 8, 11, 12.

3. **Zod schema mật khẩu dùng chung — `src/lib/validation/password.schema.ts`.**
   Một `passwordSchema` để signup và reset-password dùng chung, tránh lặp
   luật kiểm tra (độ dài tối thiểu — xem Câu hỏi mở #2). Không phụ thuộc.

4. **Zod schema cho auth — `src/features/auth/schemas/*.schema.ts`.**
   `login.schema.ts` (email, password); `signup.schema.ts` (email,
   full_name, password, confirm_password, có `.refine` kiểm tra khớp mật
   khẩu — **cố ý không có field `role`/`partner_id`**); `forgot-password.schema.ts`
   (email); `reset-password.schema.ts` (password, confirm_password). Phụ
   thuộc task 3.

5. **Helper session phía server — `src/lib/auth/session.ts`.**
   `getAuthUser()` bọc `src/lib/supabase/server.ts` + `supabase.auth.getClaims()`,
   và `requireUser()` để redirect về `/login` khi không có session — dùng
   lại được cho các Server Component/layout được bảo vệ khác, không chỉ
   riêng auth. Phụ thuộc `src/lib/supabase/server.ts` (đã có sẵn, không đổi).

6. **Server Actions cho auth — `src/features/auth/actions/*.action.ts`.**
   - `login.action.ts`: parse bằng `login.schema.ts`,
     `supabase.auth.signInWithPassword`, gộp lỗi Supabase thành thông báo
     chung "sai thông tin đăng nhập", redirect khi thành công.
   - `signup.action.ts`: parse bằng `signup.schema.ts`,
     `supabase.auth.signUp`, sau đó insert dòng `public.users` gắn với id
     user Auth vừa trả về, **hardcode** `role: 'partner_staff'`,
     `partner_id: null` (xem Quyết định #2) — không bao giờ đọc
     role/partner_id từ input client. Insert cần idempotent (upsert theo
     `id`, hoặc check-then-insert) để signup bị gián đoạn giữa chừng có
     thể tự phục hồi thay vì để lại tài khoản lỗi. Xử lý tín hiệu email
     trùng của Supabase (`identities: []`) mà không biến nó thành thông
     báo lỗi khác biệt, để tránh dò email tồn tại (email enumeration).
   - `logout.action.ts`: `supabase.auth.signOut()`, redirect về `/login`.
   - `forgot-password.action.ts`: `supabase.auth.resetPasswordForEmail(email,
     { redirectTo: .../api/auth/confirm })`; luôn trả về cùng một thông
     báo thành công chung, bất kể email có tồn tại hay không.
   - `reset-password.action.ts`: `supabase.auth.updateUser({ password })`,
     chỉ hợp lệ trong một recovery session đang hoạt động (xem guard ở
     task 11).
   Phụ thuộc task 4, 5.

7. **Trao đổi link xác nhận email / recovery — `src/app/api/auth/confirm/route.ts`.**
   Route Handler `GET` đổi `token_hash`/`type` (hoặc `code`) trên query
   thành session qua server client, rồi redirect: loại xác nhận đăng ký →
   `/dashboard`; loại recovery → `/reset-password`. Đây là Route Handler
   (không phải Server Action) vì được gọi từ link email (GET, không phải
   form), đúng `.claude/rules/backend.md`. Phụ thuộc task 2, 5.

8. **Bảo vệ route trong `src/lib/supabase/proxy.ts` / `src/proxy.ts`.**
   Mở rộng `updateSession` hiện có: sau khi làm mới claims, một request
   chưa xác thực tới path không nằm trong `PUBLIC_ROUTES` sẽ redirect về
   `/login`; một request đã xác thực tới `/login` hoặc `/signup` sẽ
   redirect về `/dashboard`. Giữ nguyên cờ `isSupabaseConfigured` trong
   `src/proxy.ts`. **Bắt buộc** sao chép header `Set-Cookie` đã làm mới từ
   `supabaseResponse` sang bất kỳ `NextResponse.redirect(...)` nào được
   trả về — đây là lỗi phổ biến khi tích hợp Supabase SSR (bỏ sót sẽ làm
   mất session ngay sau redirect). Phụ thuộc task 2, 7 (route confirm
   phải nằm trong danh sách public trước).

9. **Hook chứa logic nghiệp vụ — `src/features/auth/hooks/use-*-form.ts`.**
   Mỗi hook bọc `react-hook-form` + resolver Zod tương ứng + trạng thái
   pending/error của Server Action (`useActionState`/`useTransition`), để
   các component `*-form.tsx` chỉ còn nhiệm vụ render, theo
   `.claude/rules/frontend.md`. Phụ thuộc task 6.

10. **Component form cho auth — `src/features/auth/components/*.tsx`.**
    Client Component (`"use client"`) dùng shadcn primitive ở task 1 và
    hook ở task 9: thông báo lỗi validate theo field, trạng thái
    disabled/loading khi submit, alert lỗi xác thực, trạng thái thành
    công (đặc biệt "kiểm tra email" cho signup/forgot-password). Phụ
    thuộc task 1, 9.

11. **Trang auth — `src/app/(auth)/*`.** `layout.tsx` (layout căn giữa
    dùng chung); `login/page.tsx`, `signup/page.tsx`,
    `forgot-password/page.tsx` render component form tương ứng;
    `reset-password/page.tsx` **thêm** guard phía server kiểm tra có
    recovery session hợp lệ hay không (dùng helper ở task 5) trước khi
    render form — nếu không có thì hiển thị trạng thái "link không hợp
    lệ hoặc đã hết hạn" thay vì form reset. Phụ thuộc task 5, 10.

12. **Trang landing sau đăng nhập — `src/app/(dashboard)/dashboard/page.tsx`.**
    Server Component tối giản dùng `requireUser()` từ task 5, chỉ đóng
    vai trò đích redirect thật cho login/signup — **không phải** dashboard
    vận hành (F19) sau này. Phụ thuộc task 5.

13. **Tài liệu.**
    - `docs/security.md`: bổ sung phần Authentication với thứ tự cụ thể
      khi signup (tạo auth user → tạo dòng `public.users`), nguyên tắc
      gán role chỉ ở server và giá trị mặc định đã chọn, danh sách
      route public/protected, ghi chú chỗ route QR passport công khai
      (sau này) sẽ khớp vào danh sách này mà chưa cần triển khai, và
      nhắc lại `public.users` vẫn chưa có RLS (ngoại lệ F05 không đổi).
    - `docs/architecture.md`: mô tả cấu trúc file `src/features/auth`,
      `src/lib/auth`, `src/lib/constants/routes.ts`, và route group
      `(auth)`/`(dashboard)` nay đã có nội dung.
    - `docs/roadmap.md`: cập nhật mục Status (F02 done, F03 done, F04
      next), theo đúng mẫu ghi chú status hiện có.
    Phụ thuộc mọi task trước đó đã hoàn thiện.

14. **(Ngoài code) Tài liệu hóa các Redirect URL cần thêm vào Supabase
    Dashboard.** Không tự giả định Dashboard đã được cấu hình. Task 13
    liệt kê chính xác trong `docs/security.md`: URL callback local dev
    (`http://localhost:3000/api/auth/confirm`) và URL production
    (`{NEXT_PUBLIC_SITE_URL hoặc domain thật}/api/auth/confirm`) cần
    được thêm vào mục Redirect URLs của Supabase Auth settings. Việc
    thêm thực tế vào Dashboard do người dùng/đội vận hành thực hiện,
    không phải việc dev agent làm được từ repo.

## Phụ thuộc

- Task 1 chặn 10 (component cần primitive).
- Task 2 chặn 8, 11, 12 (hằng số route nuôi logic guard trong proxy và
  redirect ở trang).
- Task 3 chặn 4.
- Task 4 chặn 6.
- Task 5 chặn 7, 11, 12 (helper session dùng ở route confirm, guard
  reset-password, và trang landing).
- Task 6 chặn 9.
- Task 7 chặn 8 (route confirm phải tồn tại trước khi thêm vào danh sách
  public).
- Task 9 chặn 10; task 10 chặn 11.
- Task 13 phụ thuộc mọi task khác đã ở dạng cuối cùng.
- Task 14 là điều kiện tiên quyết bên ngoài để task 6/7 chạy được đầu
  cuối với project Supabase thật, nhưng không chặn việc viết code.

## Rủi ro & trường hợp biên

- **`public.users` chưa có RLS.** Theo đúng ngoại lệ F05 đã ghi trong
  `docs/database.md`, bất kỳ key nào hiện cũng có thể đọc/ghi mọi dòng
  trong `users`. Insert của signup action sẽ "chạy được" bất kể danh
  tính người gọi — đây là điều đã biết trước và được tài liệu hóa, F03
  **không** nên tự vá bằng cách lọc `WHERE` ở tầng app (vừa vi phạm
  nguyên tắc "không dựa vào lọc app-code để cô lập tenant", vừa tạo cảm
  giác an toàn giả).
- **Signup thất bại giữa chừng / auth user mồ côi.** Nếu
  `supabase.auth.signUp()` thành công nhưng insert `public.users` thất
  bại, repo hiện không có service-role key để xóa dòng `auth.users` mồ
  côi. Giảm thiểu bằng insert idempotent/tự phục hồi (hoặc tự tạo lại
  dòng profile còn thiếu ở lần đăng nhập kế tiếp) thay vì để lại tài
  khoản hỏng vĩnh viễn.
- **Dò email (email enumeration).** `signUp()` khi bật "Confirm email"
  trả về user bị obfuscate (`identities` rỗng) cho email trùng thay vì
  lỗi rõ ràng — không được biến điều này thành lỗi UI phân biệt được.
  `forgot-password.action.ts` phải luôn trả cùng một thông báo thành
  công chung dù email có tồn tại hay không.
- **Mất cookie khi redirect trong proxy.** Redirect từ
  `src/lib/supabase/proxy.ts`/`src/proxy.ts` phải mang theo cookie
  session đã làm mới trong `getClaims()`, nếu không mỗi lần redirect ở
  route được bảo vệ sẽ âm thầm làm mất session.
- **Reset mật khẩu khi chưa có recovery session hợp lệ.** Mở
  `/reset-password` trực tiếp (chưa qua route confirm) phải bị từ chối/
  redirect thay vì gọi `updateUser` trên một session ẩn danh.
- **Client không được ảnh hưởng đến role/partner_id.** Zod schema của
  signup không được có các field này, và `signup.action.ts` phải
  hardcode — không đọc từ bất kỳ key nào do client gửi lên, kể cả field
  ẩn trong form.
- **Cờ `isSupabaseConfigured` hiện có trong `src/proxy.ts`** phải được
  giữ nguyên để dev local không có `.env.local` không bị crash; logic
  redirect mới cần dùng chung cờ này.
- **Tài khoản technician đã seed** trong `supabase/seed.sql` chỉ là dòng
  DB (UUID cố định), không có `auth.users` tương ứng — không đăng nhập
  được qua luồng F03 này. Đây là hạn chế đã biết của demo/dev local,
  không phải điều F03 cần âm thầm "sửa" bằng cách đụng vào seed script
  của F02.
- **Chưa có rate limiting ở tầng app** cho các lần thử login/signup; dựa
  vào cơ chế mặc định của Supabase Auth. Không xử lý thêm trong F03 trừ
  khi được yêu cầu rõ.

## Quyết định đề xuất (cần được duyệt tại cổng phê duyệt)

1. **Đích redirect sau đăng nhập/đăng ký:** `/dashboard`, dùng route
   group `src/app/(dashboard)/` đã được dựng khung sẵn từ F01. Trang này
   chỉ là landing tối giản (task 12), **không phải** Operations Dashboard
   (F19) sau này. `/` (trang F01 hiện tại) giữ nguyên trong
   `PUBLIC_ROUTES`, không đổi hành vi.
2. **Role mặc định khi tự đăng ký (public signup):** `role =
   'partner_staff'`, `partner_id = null`. Đây là role ít đặc quyền nhất
   trong 4 giá trị enum (`operator_admin`, `partner_admin`,
   `partner_staff`, `technician`) mà vẫn hợp lệ cho một user chưa gắn
   partner nào tại thời điểm đăng ký.

## Quyết định đã được người dùng duyệt (thay thế mục "Câu hỏi mở" trước đó)

1. **Confirm email — xử lý an toàn cho cả hai cấu hình, không giả định
   trạng thái bật/tắt.** `signup.action.ts` kiểm tra `data.session` sau
   `signUp()`: nếu có session → đăng nhập luôn, redirect `/dashboard`;
   nếu không có session → hiển thị thông báo yêu cầu kiểm tra email. Áp
   dụng đúng như đã đề xuất ở task 6, không cần đổi.
2. **Mật khẩu — tối thiểu 8 ký tự, không bắt buộc ký tự đặc biệt trừ khi
   cấu hình Supabase yêu cầu.** `src/lib/validation/password.schema.ts`
   (task 3) đặt `min(8)` làm hằng số duy nhất, dễ sửa khi chính sách mật
   khẩu trên Supabase thay đổi (một chỗ chỉnh, không rải rác nhiều file).
3. **Redirect URL — dùng `/api/auth/confirm` làm callback, không giả
   định Supabase Dashboard đã được cấu hình sẵn.** Task 7 triển khai
   route này trong ứng dụng như kế hoạch ban đầu. Task 13 (tài liệu) sẽ
   liệt kê **chính xác** các Redirect URL cần thêm vào Supabase Dashboard
   (local dev và production), thay vì chỉ nhắc chung chung "xác nhận cấu
   hình". Task 14 đổi từ "xác nhận cấu hình đã có" thành "tài liệu hóa
   các URL cần thêm — việc thêm vào Dashboard do người dùng/đội vận hành
   thực hiện, không phải việc dev agent làm được từ repo."
4. **Tài khoản technician đã seed — không tạo/liên kết với Supabase Auth
   user thật trong F03.** Giữ nguyên là dữ liệu DB thuần túy
   (`supabase/seed.sql` không đổi); việc liên kết với Auth user thật để
   lại cho một tính năng RBAC/technician sau này. Không có task nào
   trong F03 đụng đến việc này.
