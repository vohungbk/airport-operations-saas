# Kế hoạch: F05 — Multi-tenancy + RLS

## Tóm tắt

Triển khai cách ly tenant ở mức database cho toàn bộ 18 bảng của F02 bằng
cách bật PostgreSQL Row Level Security (RLS) và viết policy theo từng
bảng, theo từng vai trò, cộng với một bộ nhỏ các helper function
`SECURITY DEFINER` tập trung hoá logic "ai đang gọi và họ được thấy gì".
Tenant là `partners`; thành viên tenant được xác định qua `users.partner_id`
(nullable với các role nội bộ). RLS trở thành ranh giới thực thi thật sự
cho chuỗi mô tả trong `docs/security.md`: "Supabase Auth → Application
User → Role → Partner Membership → PostgreSQL RLS" — `hasPermission()`/
`requireRole()` của F04 vẫn là cổng chặn ở UI/route, nhưng database phải
độc lập từ chối bất kỳ điều gì các hàm đó có thể bỏ sót.

Phạm vi loại trừ rõ ràng (theo yêu cầu của ticket và theo `CLAUDE.md` —
"không triển khai tính năng tương lai nếu không được yêu cầu rõ ràng"):
mọi UI/Server Action/Route Handler mới cho CRUD partner/airport/seat/
booking; bản thân tính năng QR passport (F10); UI workflow technician/
cleaning/inspection; tính toán tài chính; tích hợp flight API; service-role
client. Đây thuần tuý là một migration cộng hai bản cập nhật tài liệu
cộng test tích hợp RLS — không thay đổi hành vi runtime nào khác ngoài
hai call site đã tồn tại của `public.users`.

## Quyết định đã chốt

Người dùng đã phê duyệt kế hoạch với các quyết định sau cho các câu hỏi
mở đã nêu:

1. **Signup vs. RLS (Open Question 1, blocking)** — chọn phương án (a):
   chuyển việc ghi `public.users` sang sau-khi-confirm. Cụ thể:
   - `signup.action.ts` **giữ nguyên** nhánh ghi `public.users` hiện có
     cho trường hợp `supabase.auth.signUp()` trả về `session` ngay
     (email confirmation tắt) — lúc đó `auth.uid()` đã tồn tại thật, nên
     policy INSERT `id = auth.uid()` hoạt động bình thường, không cần
     sửa nhánh này.
   - `src/app/api/auth/confirm/route.ts` **thêm** đúng logic upsert
     `public.users` đó (dùng chung schema/logic với
     `signup.action.ts`, không viết lại từ đầu) chạy **sau khi**
     `exchangeCodeForSession`/`verifyOtp` thành công — tại điểm đó
     `auth.uid()` đã có giá trị thật của user vừa xác nhận, nên policy
     INSERT vẫn hoạt động. Đây là trường hợp email confirmation bật:
     lúc gọi `signUp()` chưa có session nên `signup.action.ts` không ghi
     `public.users` được (và không nên cố ghi ở bước đó nữa).
   - Task 5 (policy `users`) được viết dựa trên tiền đề: chỉ có
     `auth.uid()` thật (từ `signup.action.ts` khi có session ngay, hoặc
     từ `confirm/route.ts` sau khi xác nhận) mới bao giờ chạy INSERT —
     không cần policy INSERT `to anon` nào.
2. **8 câu hỏi mở không-chặn còn lại (Open Question 2–9)** — áp dụng
   nguyên văn phương án khuyến nghị trong mục "Câu hỏi mở" bên dưới:
   `users` chỉ cho thấy dòng của chính mình (không có view đồng
   nghiệp cùng partner); giữ nguyên mapping quyền ghi
   `operations_manager` sát theo bảng permission hiện có của F04 (không
   tự nới rộng `incidents` resolve hay `finance` write); giữ phạm vi
   visibility hẹp cho `technician` trên `seats` (chỉ seat gắn booking
   được gán) và `ai_queries` (chỉ query của chính mình); không thêm
   trigger chặn `technician_jobs.booking_id` bị đổi (để lại cho F14/
   F15); test tích hợp RLS đặt dưới `src/` theo đúng pattern include của
   `vitest.config.mts` hiện tại; danh tính test đa-role dùng một script
   setup test-only riêng, **không** đưa vào `supabase/seed.sql` mặc
   định.

## Các file/module bị ảnh hưởng

- `supabase/migrations/<new_timestamp>_enable_rls_multi_tenancy.sql` —
  file schema mới duy nhất (helper function, trigger, `enable row level
  security` + policy cho cả 18 bảng, index hỗ trợ mới).
- `src/types/database.types.ts` — regenerate sau migration (function/
  policy không đổi shape của bảng, nhưng vẫn phải regenerate theo quy ước
  của `db-migration` skill sau mọi migration).
- `docs/security.md` — thêm mục "F05" mới dưới "PostgreSQL Row Level
  Security" (tenant model, helper function, access rule theo từng bảng,
  mô hình giới hạn technician, mặc định deny với anonymous, ghi chú
  service-role, khuyến nghị thiết kế cho F10/Storage). Xoá/thay dòng đã
  lỗi thời "public.users vẫn chưa có RLS".
- `docs/database.md` — thay cảnh báo "RLS IS NOT YET ENABLED" ở đầu file
  bằng một mục tham chiếu RLS-enabled (bảng/đường ownership/index mới);
  cập nhật danh sách migration.
- `src/features/auth/actions/signup.action.ts` — **có thể** bị sửa, tuỳ
  vào cách giải quyết Open Question 1 bên dưới (bước upsert profile
  trước-khi-confirm hiện chạy không xác thực trong trường hợp "yêu cầu
  xác nhận email"). Nếu hướng chọn là "chuyển việc ghi profile sang route
  handler sau-khi-confirm", cả file này lẫn
  `src/app/api/auth/confirm/route.ts` đều bị ảnh hưởng — đây là một
  quyết định cần chốt, chưa được quyết sẵn ở đây.
- File test tích hợp RLS mới, vị trí cụ thể tuỳ vào quy ước dev/QA chọn
  (ví dụ `src/lib/auth/rls.integration.test.ts` hoặc một thư mục riêng
  `supabase/tests/` — xem Open Question 9), cộng một script setup/seed
  test-only cho nhiều role (không thể `INSERT` thẳng vào `auth.users`,
  cần dùng Supabase Admin API nhắm vào instance local).
- Không thay đổi gì trong `src/app`, `src/components`,
  `src/features/{partners,airports,seats,bookings,technicians,cleaning,
  inspections,finance,flights,ai}` — không tồn tại call site query thật
  nào trong các thư mục đó (đã xác minh: chỉ có 2 lệnh gọi `.from(...)`
  trong `src/` hiện nay, cả hai đều trên `public.users`: `src/lib/auth/
  current-user.ts:37` và `src/features/auth/actions/signup.action.ts:73`).

## Danh sách task

### 1. Sửa luồng signup để tương thích RLS (đã chốt phương án — xem "Quyết định đã chốt")

`signup.action.ts` gọi `supabase.auth.signUp()` rồi upsert vào
`public.users` bằng cùng server client. Khi Supabase Auth **tắt** email
confirmation, `signUp()` trả về session ngay, nên upsert chạy dưới danh
nghĩa user mới (`auth.uid()` = id của row mới) — nhánh này **giữ
nguyên**. Khi email confirmation **bật**, `signUp()` không trả session,
nên nhánh ghi `public.users` hiện tại trong `signup.action.ts` phải
được **xoá/không chạy** ở bước signup (nó sẽ chạy dưới role `anon` với
`auth.uid()` null và bị RLS từ chối) — thay vào đó, thêm đúng logic
upsert đó vào `src/app/api/auth/confirm/route.ts`, chạy ngay sau khi
route xác nhận email thành công (khi đó `auth.uid()` đã là id thật của
user vừa xác nhận). Không thêm bất kỳ policy INSERT `to anon` nào trên
`public.users` — không cần thiết với hướng sửa này.

### 2. Khởi tạo file migration

Chạy `npx supabase migration new enable_rls_multi_tenancy` để tạo
`supabase/migrations/<timestamp>_enable_rls_multi_tenancy.sql`. Một
migration duy nhất cho toàn bộ feature (khớp yêu cầu ticket "tạo MỘT
migration mới riêng cho F05", số ít) thay vì theo pattern
one-migration-per-table thường lệ của skill — migration này không tạo
bảng mới, nó bổ sung cho các bảng đã tồn tại, nên chia nhỏ hơn không
mang lại lợi ích bisectability độc lập như cách F02 tạo bảng.

### 3. Viết phần helper function

Tất cả đều `language sql`, `stable`, `security definer`,
`set search_path = ''` (schema-qualify đầy đủ mọi reference bên trong),
thuộc sở hữu role chạy migration để tự nhiên bypass RLS trên
`public.users` khi được gọi từ *bên trong* chính policy của
`public.users` (đây là cơ chế ngăn RLS bị evaluate đệ quy — xem phần
Rủi ro). Explicit `revoke execute ... from public` rồi
`grant execute ... to authenticated` trên từng function (Postgres mặc
định cấp `EXECUTE` cho `PUBLIC` khi tạo function, nếu không revoke sẽ vô
tình cho `anon` quyền gọi một function liên quan đến policy mà không có
policy nào chống lưng — một rủi ro rò rỉ thông tin trên thực tế).

- `public.current_user_role() returns public.user_role` —
  `select role from public.users where id = auth.uid() and is_active =
  true limit 1`. Trả về `null` cho caller không có session/inactive/thiếu
  profile, khớp chính xác semantics của `getCurrentUser()` trong
  `src/lib/auth/current-user.ts`, nên một session inactive hoặc thiếu
  profile tự động fail mọi role check. Được hầu hết policy trong
  migration này tái sử dụng.
- `public.current_user_partner_id() returns uuid` — cùng shape, select
  `partner_id`. Trả về `null` cho role nội bộ và cho `partner_user` bị
  inactive/thiếu profile. Vì `null = null` và `null = <bất kỳ>` đều
  evaluate ra `null` (không bao giờ `true`) trong SQL, một clause `using`
  scope theo `partner_id` tự nhiên trả về 0 dòng cho caller có
  partner null — đây chính là cơ chế biến "chưa gán partner → safe empty
  state" (một nguyên tắc thiết kế F04 đã nêu) thành sự thật ở mức
  database, không chỉ dừng ở convention.
- `public.is_internal_user() returns boolean` —
  `select public.current_user_role() in ('admin','operations_manager',
  'technician')`. Khớp đúng ví dụ ticket đã nêu tường minh ("kiểm tra
  xem user hiện tại có phải internal privileged user không").
- `public.is_admin_or_ops_manager() returns boolean` —
  `select public.current_user_role() in ('admin','operations_manager')`.
  Không được ticket đặt tên tường minh, nhưng được đề xuất vì đây là
  gate lặp lại nhiều nhất trong migration này (quyền ghi trên `partners`,
  `airports`, `seat_categories`, `seats`, `flights`, `bookings`,
  `technician_jobs`, và phần lớn trường hợp SELECT-all) — tập trung hoá
  nó đúng theo yêu cầu 3 của ticket ("tránh lặp logic phức tạp trên
  nhiều policy").

Mỗi function có một đoạn comment SQL (`comment on function ...`) ghi lại
*lý do* nó tồn tại, theo đúng yêu cầu "document why each helper function
exists" của ticket.

### 4. Viết trigger chống privilege-escalation cho `users`

Clause `using`/`with check` của RLS có thể giới hạn *dòng nào* policy áp
dụng, nhưng không thể diff sạch giá trị cột cũ-mới trong một UPDATE theo
cách trigger làm được. Thêm
`public.prevent_users_privilege_escalation()` (`before update on
public.users for each row`, `language plpgsql`): nếu
`current_user_role() <> 'admin'` và (`new.role is distinct from old.role`
hoặc `new.partner_id is distinct from old.partner_id` hoặc
`new.is_active is distinct from old.is_active`), `raise exception`. Đây
là cơ chế cụ thể thoả mãn yêu cầu 10 ("user không được đổi role của
chính mình... partner_id... tự gán mình sang partner khác") — RLS chỉ
kiểm soát *khả năng nhìn thấy dòng*, trigger này kiểm soát bảo vệ ở mức
cột trên 3 trường nhạy cảm, bất kể policy UPDATE nào ở mức dòng đã cho
statement đi qua.

### 5. Bảng `users` — bật RLS + policy (phụ thuộc Task 1, 3, 4)

- SELECT: `admin` → mọi dòng. `operations_manager` → mọi dòng (chỉ đọc;
  cần để xem technician/liên hệ partner cho các tính năng gán việc tương
  lai — không kèm quyền ghi). `technician` → chỉ dòng của chính mình
  (`id = auth.uid()`). `partner_user` → chỉ dòng của chính mình (xem
  Open Question 2 về việc có nên cho thấy đồng nghiệp cùng partner hay
  không).
- INSERT: đúng theo shape được chốt ở Task 1.
- UPDATE: `admin` → mọi dòng, mọi cột (trigger ở Task 4 vẫn áp dụng
  nhưng là no-op với admin). Không có policy self-UPDATE cho role
  non-admin trừ khi Task 1 yêu cầu (ví dụ nếu luồng upsert cũng có thể
  chạm UPDATE khi retry) — nếu có, scope theo `id = auth.uid()` và để
  trigger ở Task 4 làm guard thật sự chống đổi role/partner_id/is_active.
- DELETE: không có policy cho role nào (xem quyết định DELETE toàn dự án
  bên dưới).

### 6. Bảng `partners` — bật RLS + policy

- SELECT: `is_admin_or_ops_manager()` → tất cả. `technician` → không có
  quyền (không workflow technician hiện tại hay sắp tới nào cần; các
  view job/booking của technician join qua `bookings`/`technician_jobs`,
  không join trực tiếp `partners`). `partner_user` →
  `id = current_user_partner_id()`.
- INSERT/UPDATE: chỉ `is_admin_or_ops_manager()` (khớp permission
  `partners:manage` của F04, thuộc về `admin`/`operations_manager`).
- DELETE: không có.

### 7. Bảng `airports` — bật RLS + policy (dữ liệu tham chiếu dùng chung)

- SELECT: `to authenticated using (true)`. Đây là ngoại lệ có chủ đích,
  được ghi rõ, với nguyên tắc "không permissive `USING (true)`" ở yêu
  cầu 9: dòng `airports` không chứa dữ liệu định danh partner, tài
  chính, hay cá nhân, và mọi domain nghiệp vụ (bookings, seats, flights)
  đều cần resolve tên/timezone sân bay bất kể role hay partner.
- INSERT/UPDATE: `is_admin_or_ops_manager()` (khớp `airports:manage`).
- DELETE: không có (bảng `airports` chưa có cột status/soft-delete nào
  cả — F07 sẽ cần quyết định shape đó trước khi delete có ý nghĩa).

### 8. Bảng `seat_categories` — bật RLS + policy

Cùng shape với `airports`: SELECT `to authenticated using (true)` (dữ
liệu tham chiếu không nhạy cảm, `is_active` đã mô hình hoá việc "nghỉ
hưu"); INSERT/UPDATE `is_admin_or_ops_manager()` (khớp `seats:manage`);
không có DELETE.

### 9. Bảng `seats` — bật RLS + policy

- SELECT: `is_admin_or_ops_manager()` → tất cả. `technician` → seat gắn
  với booking họ được gán
  (`exists (select 1 from bookings b join technician_jobs tj on
  tj.booking_id = b.id where b.assigned_seat_id = seats.id and
  tj.technician_id = auth.uid())` — xem Open Question 5 về việc phạm vi
  này có quá hẹp cho nhu cầu gần của F09/F14 không). `partner_user` →
  seat gắn với booking của partner họ
  (`exists (select 1 from bookings b where b.assigned_seat_id = seats.id
  and b.partner_id = current_user_partner_id())`).
- INSERT/UPDATE: chỉ `is_admin_or_ops_manager()` trong phạm vi F05. Việc
  technician cập nhật status/rental_cycles (chuyển trạng thái cleaning/
  inspection/quarantine) được để lại rõ ràng cho F16–F18, các feature
  đó phải tự thêm policy phù hợp theo `.claude/rules/backend.md` — không
  tự bịa ra ở đây.
- DELETE: không có.

### 10. Bảng `seat_status_history` — bật RLS + policy (log bất biến)

- SELECT: chỉ `is_admin_or_ops_manager()`. Chưa có feature nào hiện nay
  cho technician hay partner_user lý do để đọc bảng này; mặc định hẹp
  hơn, sẽ xem lại khi F09/F16–18 định nghĩa nhu cầu đọc thật sự.
- INSERT: `is_admin_or_ops_manager()` (chưa có code path nào ghi vào
  bảng này — đây là scaffolding phòng ngừa, được ghi chú rõ như vậy).
- UPDATE/DELETE: không có (log chỉ-ghi-thêm).

### 11. Bảng `flights` — bật RLS + policy (dữ liệu tham chiếu dùng chung)

Cùng shape với `airports`: SELECT `to authenticated using (true)`;
INSERT/UPDATE `is_admin_or_ops_manager()` cho nhập tay (đường ghi thật
qua tích hợp đồng bộ F20 là một quyết định tương lai riêng — đánh dấu
cần xem lại, không chốt ở đây); không có DELETE.

### 12. Bảng `bookings` — bật RLS + policy

- SELECT: `is_admin_or_ops_manager()` → tất cả. `technician` →
  `assigned_technician_id = auth.uid() or exists (select 1 from
  technician_jobs tj where tj.booking_id = bookings.id and
  tj.technician_id = auth.uid())` (xem Rủi ro: `bookings.
  assigned_technician_id` và `technician_jobs.technician_id` là hai
  nguồn sự thật độc lập cho cùng một fact — policy kiểm tra cả hai để
  vẫn đúng nếu chúng lệch nhau). `partner_user` →
  `partner_id = current_user_partner_id()`.
- INSERT/UPDATE: chỉ `is_admin_or_ops_manager()` — khớp chính xác F04:
  `bookings:manage` thuộc `operations_manager`/`admin`; quyền booking
  duy nhất của `partner_user` là `bookings:view_own_partner` (chỉ xem);
  `technician` không có permission `bookings:*` nào. Không có policy
  ghi cho `partner_user` hay `technician` trên bảng này.
- DELETE: không có (huỷ booking là một UPDATE `status='cancelled'`, đã
  được policy UPDATE bao phủ).

### 13. Bảng `booking_events` — bật RLS + policy (log bất biến, không có `partner_id` trực tiếp)

Đường ownership: `booking_events.booking_id → bookings.partner_id`.

- SELECT: `is_admin_or_ops_manager()` → tất cả. `technician` → event
  trên booking họ được gán (cùng join với Task 12). `partner_user` →
  event trên booking của partner họ.
- INSERT: `is_admin_or_ops_manager()`, cộng `technician` giới hạn ở
  event trên booking họ được gán (để hành động của technician trong
  workflow vẫn có thể được log lại).
- UPDATE/DELETE: không có (chỉ-ghi-thêm).

### 14. Bảng `technician_jobs` — bật RLS + policy

- SELECT: `is_admin_or_ops_manager()` → tất cả. `technician` →
  `technician_id = auth.uid()`. `partner_user` → job trên booking của
  partner họ
  (`exists (select 1 from bookings b where b.id =
  technician_jobs.booking_id and b.partner_id =
  current_user_partner_id())`).
- INSERT: chỉ `is_admin_or_ops_manager()` (gán việc; khớp
  `technicians:manage`).
- UPDATE: `is_admin_or_ops_manager()` (gán lại/huỷ), cộng `technician`
  giới hạn ở dòng của chính mình
  (`using (technician_id = auth.uid()) with check (technician_id =
  auth.uid())`, khớp `jobs:update_assigned`). Lưu ý: điều này chặn
  technician gán lại job cho người khác (`technician_id` ở dòng mới vẫn
  phải bằng `auth.uid()` của chính họ), nhưng **không** tự chặn được
  technician đổi `booking_id` sang một booking khác — xem Open Question
  7 về việc có nên thêm trigger tương tự Task 4 ngay bây giờ hay để lại
  cho F14/F15.
- DELETE: không có.

### 15. Bảng `installations` — bật RLS + policy (log bất biến)

Đường ownership: `installations.technician_job_id →
technician_jobs.technician_id` (actor trực tiếp) và
`→ technician_jobs.booking_id → bookings.partner_id` (khả năng thấy của
partner).

- SELECT: `is_admin_or_ops_manager()` → tất cả. `technician` → dòng có
  `technician_job_id` thuộc job được gán cho họ. `partner_user` → dòng
  trên booking của partner họ (join 2 chặng).
- INSERT: `technician`, giới hạn theo `technician_job_id` của chính
  mình, khớp `installation:perform`; cộng `is_admin_or_ops_manager()`
  cho việc chỉnh sửa/backfill.
- UPDATE/DELETE: không có (bản ghi đã hoàn tất, bất biến theo
  `docs/database.md`).

### 16. Bảng `cleaning_records` — bật RLS + policy (log bất biến)

`employee_id` là FK actor trực tiếp; `booking_id` nullable (cleaning có
thể xảy ra ngoài context booking).

- SELECT: `is_admin_or_ops_manager()` → tất cả. `technician` →
  `employee_id = auth.uid()`. `partner_user` → dòng có `booking_id is
  not null` và booking liên kết có `partner_id` khớp (dòng cleaning có
  `booking_id` null không thuộc partner nào nên đúng đắn là vô hình với
  mọi `partner_user`).
- INSERT: `technician`, `with check (employee_id = auth.uid())`, khớp
  `cleaning:create`; cộng `is_admin_or_ops_manager()` khớp
  `cleaning:manage`.
- UPDATE/DELETE: không có.

### 17. Bảng `inspection_records` — bật RLS + policy (log bất biến)

Cùng shape Task 16, thay `inspector_id` cho `employee_id`, khớp
`inspections:create` / `inspections:manage`.

### 18. Bảng `incidents` — bật RLS + policy

- SELECT: `is_admin_or_ops_manager()` → tất cả (`incidents:view`).
  `technician` → `reported_by = auth.uid()` (khớp `incidents:report`,
  vốn chỉ là quyền report — không có quyền thấy rộng hơn ở tầng
  permission, nên cũng không cấp rộng hơn ở đây). `partner_user` →
  `partner_id = current_user_partner_id()`.
- INSERT: `technician`, `with check (reported_by = auth.uid())`. Cộng
  `with check` rằng nếu `booking_id` được cung cấp, `partner_id` phải
  khớp `partner_id` thật của booking đó
  (`partner_id = (select b.partner_id from bookings b where b.id =
  incidents.booking_id)`) — `incidents.partner_id` là cột client có thể
  tự cung cấp lúc insert; thiếu check này, một caller có thể gán một
  incident cho partner không liên quan đến booking được tham chiếu.
  Cộng `is_admin_or_ops_manager()` cho incident chỉ-nội-bộ (không
  `booking_id`).
- UPDATE (resolve/status/severity): theo đúng mapping nghiêm ngặt với
  bảng permission của F04, chỉ `admin` có bất kỳ permission ghi nào trên
  incident — `operations_manager` chỉ có `incidents:view`, không có
  permission manage/resolve. Xem Open Question 3: nhiều khả năng đây là
  một khoảng trống trong permission model của F04 hơn là một giới hạn
  có chủ đích, nhưng không phải quyết định của feature này để tự nới
  rộng.
- DELETE: không có.

### 19. Bảng `partner_commercial_terms` — bật RLS + policy

- SELECT: `is_admin_or_ops_manager()` → tất cả (`finance:view`).
  `partner_user` → `partner_id = current_user_partner_id()`
  (`finance:view_own_partner`).
- INSERT/UPDATE: chỉ `admin` — F04 không có permission `finance:manage`
  nào cho role non-admin, nên đây không phải giới hạn mới do RLS đưa
  vào, chỉ là nơi đầu tiên nó trở nên có tác động thật. Xem Open
  Question 4.
- DELETE: không có.

### 20. Bảng `settlements` — bật RLS + policy

Cùng shape Task 19: SELECT `is_admin_or_ops_manager()` (tất cả) /
`partner_user` (`partner_id` của chính mình); INSERT/UPDATE chỉ `admin`;
không có DELETE.

### 21. Bảng `invoices` — bật RLS + policy

Cùng shape một lần nữa. FK `settlement_id` không đổi access model (không
cần check liên kết settlement riêng vì `invoices.partner_id` đã trực
tiếp và authoritative).

### 22. Bảng `ai_queries` — bật RLS + policy

Không có permission `ai:*` nào trong F04, và F28 chưa bắt đầu — đây là
bảng được xử lý bảo thủ nhất trong tập này.

- SELECT: `user_id = auth.uid() or current_user_role() = 'admin'` (user
  thấy query của chính mình; admin thấy tất cả để giám sát). Không có
  visibility toàn-partner cho `partner_user` (xem Open Question 6 —
  không có gì trong F04 cấp quyền này, tự bịa ra ở đây là scope creep).
- INSERT: `with check (user_id = auth.uid())`, cộng `admin`. Chỉ mang
  tính phòng ngừa — chưa có code path nào ghi vào bảng này (F28 chưa tồn
  tại); được ghi chú là scaffolding, sẽ xem lại khi F28 định nghĩa
  đường ghi/permission thật.
- UPDATE/DELETE: không có (log).

### 23. Quyết định DELETE cho toàn dự án

Không bảng nào trong migration này có policy DELETE cho bất kỳ role
xác thực nào. Đây không phải thiếu sót theo từng bảng — đó là một quyết
định áp dụng thống nhất, nhất quán với convention sẵn có của
`docs/database.md`: "không dùng `ON DELETE CASCADE`... partners/seats/
bookings được thiết kế để deactivate qua `status`, không bao giờ hard
delete". Việc không có policy nào khớp đồng nghĩa DELETE bị RLS từ chối
mặc định; điều này nên được nêu rõ trong comment của migration và trong
`docs/security.md` thay vì để ngầm hiểu, để reviewer tương lai không đọc
sự im lặng đó thành một khoảng trống.

### 24. Index hỗ trợ mới (cùng migration, sau policy của bảng liên quan)

Thêm ở những nơi policy `exists (...)` dạng indirect-ownership nếu không
sẽ ép sequential scan ở phía con của join:

- `installations_technician_job_id_idx` trên
  `installations(technician_job_id)` (chưa có index nào ngoài PK).
- `cleaning_records_employee_id_idx` trên `cleaning_records(employee_id)`
  và `cleaning_records_booking_id_idx` trên
  `cleaning_records(booking_id)`.
- `inspection_records_inspector_id_idx` trên
  `inspection_records(inspector_id)` và
  `inspection_records_booking_id_idx` trên
  `inspection_records(booking_id)`.
- `incidents_reported_by_idx` trên `incidents(reported_by)` (dùng bởi
  policy SELECT incident-của-chính-mình của technician).
- `ai_queries_user_id_idx` trên `ai_queries(user_id)`.

Mọi thứ khác cần thiết đã tồn tại sẵn từ F02 (`users.partner_id`,
`users.role`, `bookings.partner_id`, `bookings.assigned_seat_id`,
`bookings.assigned_technician_id`, `technician_jobs.technician_id`,
`technician_jobs.booking_id`, `booking_events.booking_id`,
`incidents.partner_id`, `settlements.partner_id`, `invoices.partner_id`).

### 25. Viết khối comment rollback

Theo thứ tự ngược lại theo quy ước của skill: drop từng policy trước,
rồi trigger, rồi index thêm ở Task 24, rồi helper function, rồi
`disable row level security` (hoặc để RLS bật nhưng không còn policy
nào, tương đương deny toàn bộ — ghi chú theo đúng convention CLI đã dùng
ở các migration trước: liệt kê tường minh từng câu lệnh
`drop policy if exists`).

### 26. Xác minh cục bộ (phụ thuộc mọi task trên)

`npx supabase db reset`, sửa mọi lỗi thứ tự/cú pháp; sau đó chạy tay SQL
rollback trên instance local và xác nhận schema quay lại trạng thái
không-RLS; sau đó `npx supabase db reset` lại lần nữa để xác nhận toàn bộ
lịch sử migration (bao gồm migration này) vẫn replay sạch, theo đúng
bước 4 của skill `db-migration`.

### 27. Regenerate types

`npx supabase gen types typescript --local > src/types/database.types.ts`,
commit cùng migration. Function/policy không đổi shape của
`Database["public"]["Tables"]`, nhưng skill yêu cầu regenerate sau mọi
migration và diff nên được review để phát hiện drift ngoài ý muốn.

### 28. Cập nhật `docs/database.md`

Thay callout "RLS IS NOT YET ENABLED" ở đầu file bằng tóm tắt những gì
đã được bật, thêm bảng "quan hệ ownership dùng cho RLS" (mỗi dòng một
bảng indirect, khớp Task 9–22 ở trên), và liệt kê index mới từ Task 24.
Thêm tên file migration vào danh sách chiến lược migration.

### 29. Cập nhật `docs/security.md`

Mục mới dưới "PostgreSQL Row Level Security": tenant model (`partners` +
`users.partner_id`, null = nội bộ), 4 helper function kèm mục đích, bảng
access theo từng bảng (khớp Task 5–22), pattern giới hạn theo
technician-được-gán, quyết định "không có policy DELETE nào", phát biểu
mặc định deny với anonymous (không bảng nào có policy nhắm `anon` —
khẳng định tường minh, không chỉ ngụ ý), ghi chú service-role (không
đổi: không tồn tại, không được tạo ra ở đây), và hai ghi chú thiết kế
**chỉ-tài-liệu** theo yêu cầu 8 và 12 của ticket nhưng chưa triển khai:

- **QR passport công khai F10**: RLS hoạt động ở mức dòng, không phải
  mức cột — nó không thể chọn lọc show `seats.public_token` cho `anon`
  trong khi ẩn các cột nội bộ trên cùng bảng/policy. Hướng khuyến nghị:
  giữ RLS của `seats` chỉ `to authenticated` (không bao giờ có policy
  cho anon), và expose một RPC `SECURITY DEFINER` riêng hoặc một view
  công khai hẹp chỉ trả về các trường an toàn đã whitelist theo
  `public_token`, xây khi F10 thực sự triển khai.
- **Storage**: chưa có bucket nào. Convention bucket/path khuyến nghị
  nên phản chiếu cùng mô hình ownership `partner_id`/role qua policy
  `storage.objects`, dùng lại đúng các helper function này, triển khai
  khi có feature upload thật (ảnh F16–F18, PDF hoá đơn F25).

### 30. Chuẩn bị danh tính test đa vai trò để xác minh RLS

Seed SQL local (`supabase/seed.sql`) có thể tạo dòng `public.users`
nhưng không thể tạo identity Supabase Auth thật có JWT dùng được —
`auth.users` không an toàn để insert tay — và 3 technician đã seed sẵn
từ F02 cố ý không có tài khoản Auth (`docs/security.md`, ghi chú F03)
chính vì chúng chưa từng được thiết kế để đăng nhập. Test tích hợp RLS
cần session thật cho ít nhất: 1 `admin`, 1 `operations_manager`, 1
`technician` (được liên kết Auth, khác với 3 technician seed của F02),
2 `partner_user` ở hai partner khác nhau, và 1 user inactive. Xây một
script setup test-only dùng Supabase Admin API (service-role key,
chỉ-local, không bao giờ commit kèm credential thật) để tạo các Auth
user này cùng dòng `public.users` tương ứng trước khi chạy test suite
RLS. Đây là hạ tầng test mới, không phải application code — đánh dấu
vị trí/cơ chế chính xác ở Open Question 9.

### 31. Viết test tích hợp RLS

Theo mức tối thiểu của `.claude/rules/testing.md` ("mỗi policy RLS mới/
thay đổi cần ít nhất một test tích hợp chứng minh truy cập chéo-tenant
bị từ chối, không chỉ chứng minh truy cập cùng-tenant được phép"), bao
phủ tối thiểu:

- Cách ly partner: session của partner A đọc được `bookings`/
  `settlements`/`invoices`/`partner_commercial_terms`/`incidents` của
  chính mình, và nhận 0 dòng (không phải lỗi) với dữ liệu của partner B.
- Tự bảo vệ trên `users`: session `partner_user` cố UPDATE `role`/
  `partner_id`/`is_active` của chính mình bị từ chối (trigger Task 4);
  cố UPDATE dòng của user khác bị từ chối (policy Task 5).
- Ranh giới role: session `technician` chỉ SELECT được job/
  installation/cleaning/inspection gắn với chính mình, nhận 0 dòng với
  dữ liệu của technician khác; `operations_manager` đọc được rộng nhưng
  không ghi được `settlements`/`invoices`/`partner_commercial_terms`
  (quyết định admin-only ở Task 19–21) — assert điều này để nó là một
  ranh giới có chủ đích, đã được test, không phải tình cờ.
- Từ chối anonymous: client chưa xác thực nhận 0 dòng (hoặc lỗi
  permission sạch) trên cả 18 bảng, bao gồm cả các bảng "dữ liệu tham
  chiếu dùng chung" (`airports`, `seat_categories`, `flights`) — test
  này xác minh cụ thể rằng clause `to authenticated` trên các policy
  `USING (true)` đó thật sự có tác dụng.
- Hành vi `partner_id` NULL: `partner_user` có `partner_id is null`
  (trạng thái ngay-sau-signup, theo F03) nhận 0 dòng ở mọi nơi scope
  theo partner, không phải lỗi và không phải toàn bộ dòng.
- Bảng ownership gián tiếp: ít nhất một test cho mỗi bảng
  `booking_events`, `technician_jobs`, `installations`,
  `cleaning_records`, `inspection_records` chứng minh đường ownership
  qua join thực sự lọc được (không chỉ vì một dòng cùng-partner/cùng-
  technician tình cờ hiển thị — dựng một ví dụ phản chứng chéo-partner/
  chéo-technician cho từng bảng).
- Hồi quy luồng signup: bất kể Task 1 chốt phương án nào, thêm test
  chứng minh `signupAction` vẫn tạo thành công dòng `public.users` ở cả
  hai cấu hình "tắt confirmation" và "bật confirmation" (hoặc ghi chú lý
  do chỉ một trong hai test được cục bộ).

### 32. Kiểm tra toàn diện

`npm run lint`, `npx tsc --noEmit`, `npm run test` (vitest — đã là
dependency và script sẵn có của dự án, trái với ghi chú đã lỗi thời
"chưa cài test runner" của `.claude/rules/testing.md`; đã xác nhận qua
`package.json`), `npm run build`. Xác nhận 2 call site hiện có của
`public.users` (`current-user.ts`, `signup.action.ts`) vẫn hoạt động
đúng khi bảng đã bật RLS.

## Phụ thuộc

- Task 1 chặn Task 5 (không thể viết policy INSERT của `users` mà chưa
  biết shape nào cần dùng) và chặn test hồi quy signup của Task 31.
- Task 3 và 4 chặn Task 5 và mọi task bảng khác gọi helper function (tức
  Task 6–22 đều phụ thuộc Task 3).
- Task 2 chặn mọi thứ còn lại (đây là file mà toàn bộ SQL sau đó được
  viết vào).
- Task 5–24 (cùng một file migration) chặn Task 25 (khối rollback phải
  phản ánh trạng thái cuối) và Task 26 (không có gì để test cho tới khi
  SQL hoàn chỉnh).
- Task 26 chặn Task 27 (types được generate từ schema sau-migration) và
  Task 31 (test chạy trên schema đã áp dụng).
- Task 30 chặn Task 31 (test cần các identity đa-role đã được seed từ
  trước).
- Task 28–29 (docs) có thể viết song song với Task 5–24 một khi các
  quyết định theo từng bảng đã chốt, nhưng nên đi cùng một lần review
  với migration, không phải một follow-up riêng.
- Task 32 là bước cuối — phụ thuộc mọi thứ ở trên đã sẵn sàng.

## Rủi ro & edge case

- **Signup bị hỏng dưới cấu hình bật email-confirmation** (Task 1) —
  rủi ro lớn nhất trong feature này; đây là một hồi quy thật trên một
  luồng đã ship, không phải edge case của tính năng mới, cần một quyết
  định tường minh trước khi viết policy cho bảng `users`.
- **RLS đệ quy trên `public.users`** — các helper function query
  `public.users` từ bên trong policy được định nghĩa *trên chính*
  `public.users`. Điều này chỉ không gây đệ quy vì các function là
  `SECURITY DEFINER` và thuộc sở hữu một role không bị RLS trên bảng đó
  chi phối. **Không** chạy `alter table public.users force row level
  security` ở bất kỳ đâu (không có lý do gì cần cho feature này, nhưng
  đây là lỗi copy-paste dễ mắc từ tài liệu Postgres, sẽ phá vỡ mọi
  helper function).
- **Grant `EXECUTE` mặc định** — Postgres tự động cấp `EXECUTE` trên
  function mới cho `PUBLIC`; quên `revoke ... from public` tường minh
  trên 4 helper function sẽ để `anon` gọi trực tiếp chúng (không rò rỉ
  dữ liệu ngay lập tức vì chúng chỉ trả về role/null của chính caller,
  nhưng là một bề mặt không cần thiết và vi phạm tinh thần "explicit
  allow" mà ticket yêu cầu).
- **Trùng lặp `bookings.assigned_technician_id` vs.
  `technician_jobs.technician_id`** — hai cột độc lập cùng biểu diễn
  "technician nào", không có ràng buộc nhất quán giữa chúng. Policy
  visibility-theo-technician trên `bookings`/`booking_events` kiểm tra
  cả hai, nhưng nếu một feature tương lai update một cột mà không update
  cột kia, một technician có thể tạm thời mất hoặc có visibility không
  nhất quán với bảng job. Không phải việc của feature này để sửa sự
  trùng lặp, nhưng đáng lưu ý vì RLS giờ phụ thuộc vào nó.
- **`incidents.partner_id` là cột ghi được thẳng, không phải derive** —
  nếu thiếu `with check` ràng buộc nó với `partner_id` thật của booking
  được tham chiếu (Task 18), bất kỳ người insert xác thực nào cũng có
  thể gán sai incident cho một partner tuỳ ý mà họ không thuộc về.
- **Lỗi thao tác với `USING (true)`** — ba bảng (`airports`,
  `seat_categories`, `flights`) cố ý có policy SELECT rộng `to
  authenticated`. Một migration tương lai thêm cột nhạy cảm vào một
  trong các bảng này (ví dụ cột chi phí trên `flights`) sẽ âm thầm kế
  thừa policy rộng đó. Đáng có một dòng cảnh báo trong `docs/database.md`
  cạnh các bảng này.
- **Giảm hiệu năng từ policy `exists(...)` ownership gián tiếp** — mỗi
  SELECT trên `booking_events`, `installations`, `cleaning_records`,
  `inspection_records` giờ chạy một join ngầm cho mỗi lần kiểm tra
  visibility; index ở Task 24 giảm nhẹ điều này nhưng nên được xác minh
  bằng `explain analyze` trên số dòng thực tế, không chỉ trên bộ seed 20
  dòng, trước khi coi là "xong".
- **Technician đã seed không có tài khoản Auth** (hành vi F03 đã có sẵn,
  đã ghi chú) — test RLS cho role "technician" không thể tái dùng
  nguyên seed data của F02; identity test mới ở Task 30 là bắt buộc, và
  bản thân script setup đó không bao giờ được để lộ service-role key
  vào một file đã commit.
- **Khoảng trống quyền ghi của `operations_manager`** (resolve incident,
  ghi tài chính) được kế thừa trực tiếp từ bảng permission của F04,
  không phải do feature này bịa ra — nhưng RLS là nơi đầu tiên khiến
  chúng có tác động thật. Nếu model của F04 vốn định rộng hơn, feature
  này sẽ âm thầm khoá chặt cách đọc hẹp hơn nếu không được đánh dấu
  (xem Open Question 3–4).

## Câu hỏi mở

1. **Upsert signup vs. INSERT anon dưới RLS** (chặn Task 1/5) — ba
   phương án ứng viên, cần một quyết định:
   (a) Chuyển việc ghi profile `public.users` từ `signup.action.ts`
   (trước-khi-confirm) sang `api/auth/confirm/route.ts` (sau-khi-confirm,
   nơi có session/`auth.uid()` thật) — sạch nhất, nhưng đổi một code path
   F03 đã ship.
   (b) Thêm trigger `handle_new_user()` trên `auth.users`
   (`SECURITY DEFINER`, chạy khi Auth user được tạo bất kể trạng thái
   confirm) tự động tạo dòng `public.users`, thay thế hoàn toàn upsert ở
   tầng app — pattern chuẩn của Supabase, nhưng là thay đổi kiến trúc
   lớn hơn "chỉ thêm RLS".
   (c) Thêm một policy INSERT `to anon` phạm vi hẹp trên `public.users`,
   gate bằng một helper function xác nhận id tương ứng một dòng
   `auth.users` thật (dù chưa confirm) — phương án yếu nhất, thêm một bề
   mặt ghi cho anon vào một bảng vốn không có.
   Khuyến nghị (a) hoặc (b); không chọn phương án nào là không khả thi —
   migration không thể viết đúng nếu thiếu quyết định này.
2. `partner_user` có nên thấy các user khác thuộc *cùng partner* trên
   bảng `users` (view "đồng nghiệp"), hay chỉ thấy dòng của chính mình?
   Ngôn ngữ "dữ liệu của partner mình" trong ticket rất rõ ràng với
   `bookings`/`settlements`/`invoices`/`incidents`/
   `partner_commercial_terms` (đều khoá trực tiếp theo `partner_id`),
   nhưng `users` chứa dữ liệu định danh, không phải dữ liệu vận hành, và
   chưa có feature nào cần visibility đồng nghiệp.
3. Bảng permission của F04 chỉ cho `operations_manager` quyền
   `incidents:view`, không có permission manage/resolve — nghĩa là theo
   mapping nghiêm ngặt, chỉ `admin` mới resolve được incident. Xác nhận
   đây có phải chủ đích hay RLS nên cấp thêm UPDATE cho
   `operations_manager` (việc này đồng nghĩa cần đánh dấu là một khoảng
   trống trong permission model của F04, vì `hasPermission()`/route guard
   cũng cần được nới rộng tương ứng để nhất quán với DB).
4. Câu hỏi tương tự cho tài chính: không có permission `finance:manage`
   nào trong F04, nên `partner_commercial_terms`/`settlements`/
   `invoices` mặc định INSERT/UPDATE chỉ-admin theo mapping nghiêm ngặt.
   Xác nhận trước khi F22–F25 xây dựng dựa trên giả định này.
5. Visibility của technician trên `seats` (chỉ-booking-được-gán) có quá
   hẹp cho các workflow gần của F09/F14/F15 không, vốn nhiều khả năng
   cần technician duyệt seat khả dụng tại sân bay của họ (ví dụ để chọn
   seat thay thế)? Khuyến nghị giữ mặc định hẹp bây giờ và để F09/F14
   thêm policy rộng hơn khi nhu cầu cụ thể xuất hiện, thay vì đoán trước
   ở đây.
6. `partner_user` có nên có visibility theo-partner vào `ai_queries`
   (lịch sử AI query của partner mình), hay chỉ-theo-user (đề xuất hiện
   tại) là đúng khi F04 hoàn toàn chưa có permission `ai:*` nào? Ưu tiên
   thấp vì F28 chưa bắt đầu.
7. Policy UPDATE của `technician_jobs` chặn technician gán lại
   `technician_id` cho người khác, nhưng không chặn họ đổi `booking_id`
   sang một booking không liên quan. Thêm trigger kiểu Task 4 ngay bây
   giờ, hay chấp nhận là một khoảng trống còn lại, đã ghi chú, để lại
   cho F14/F15 (chưa có UI nào hiện tại có thể khai thác nó)?
8. Xác nhận vị trí/quy ước đặt tên chính xác cho test tích hợp RLS
   (Task 31) — chưa có file test nào trong `src/` dù `vitest` đã được
   cài và cấu hình (`vitest.config.mts` chỉ include `src/**/*.test.ts`);
   các test này cần một instance Supabase local đang chạy và nhiều
   session thật, khác hẳn bất kỳ thứ gì hiện có trong repo. Nên đặt dưới
   `src/` theo đúng pattern include của `vitest.config.mts` hiện tại,
   hay cần config/vị trí riêng vì đây không phải unit/mocked test thuần?
9. Việc tạo Auth user đa-role của Task 30 có nên trở thành một phần của
   `supabase/seed.sql` (luôn có sẵn ở local dev) hay giữ là một script
   setup test-only riêng, chỉ được gọi bởi test suite RLS? Đặt các tài
   khoản test có mật khẩu thật vào seed dev mặc định là một rủi ro nhẹ
   nhưng có thật nếu seed đó từng được trỏ vào một project shared/
   staging.
