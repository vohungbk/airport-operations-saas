# Kế hoạch: Airport Operations Color Palette & Sidebar Icons

## Tóm tắt

Đây là một thay đổi **chỉ thuộc phần giao diện (UI-only)**, gồm hai phần:

1. Thay thế các token màu shadcn mặc định hiện tại trong `src/app/globals.css`
   bằng bảng màu Airport Operations (aviation) được cung cấp — mở rộng hệ
   thống CSS variable / `@theme inline` đã có sẵn, **không** tạo hệ thống
   token mới.
2. Thêm icon Lucide và tinh chỉnh spacing/active-state cho sidebar (được xây
   ở F04), đồng thời đồng bộ màu badge trạng thái hiện có (hiện chỉ có
   `partner_status` ở F06) theo các token semantic mới.

Không có route mới, không có nav item mới, không thay đổi RBAC/permission,
không thay đổi database/auth, không thay đổi business logic. Chỉ thay
đổi class/token/icon trên những gì đã render sẵn.

Hai phát hiện quan trọng làm thay đổi phạm vi so với mô tả gốc của ticket,
và được coi là có giá trị cao hơn gợi ý ban đầu của ticket:

- Sidebar nav thực tế (`src/config/nav.ts`) hiện chỉ có **5 mục**:
  `Admin Operations` (`/admin`), `Partners` (`/partners`),
  `Airports` (`/airports`), `Technician Jobs` (`/technician`),
  `Partner Portal` (`/partner`) — không phải danh sách dài (Dashboard,
  Seats, Bookings, Flights, Cleaning, Inspections, Incidents, Finance,
  Settlements, Invoices, Reports, AI, Settings, Users, Profile) mà ticket
  gợi ý. Theo đúng nguyên tắc "không thêm nav item cho tính năng chưa xây",
  chỉ 5 mục này (cộng thêm `LogoutButton` riêng biệt) sẽ được gắn icon.
- `AppShell` hiện tại (`src/components/layout/app-shell.tsx`) là một cột
  `w-64` cố định, **không có hành vi collapse/mobile/responsive và không có
  component tooltip nào trong codebase**. Vì vậy không có gì để "giữ
  nguyên" cho tooltip ở trạng thái collapsed — việc thêm nó sẽ là phạm vi
  UX mới ngoài ticket này, nên được đưa vào phần "Open questions" thay vì
  triển khai.

**Ngoài phạm vi (out of scope), đã xác nhận:** bất kỳ nav item/route mới,
permission mới, thay đổi CRUD airport/partner, thay đổi DB/RLS, thay đổi
auth, thay đổi business logic của bookings/seats/flights/finance/AI, và
việc thêm cơ chế bật/tắt dark mode (khối CSS `.dark` tồn tại như phần
scaffold chưa dùng — xem Open Questions).

## Affected files/modules

**Design tokens**
- `src/app/globals.css` — khối CSS variable `:root` và `.dark`, và khối
  mapping `@theme inline` (thêm `--color-success`, `--color-warning`,
  `--color-info` nếu các token này được thêm).

**Sidebar / nav**
- `src/config/nav.ts` — interface `NavItem` (thêm field `icon`) và mảng
  `NAV_ITEMS` (5 mục).
- `src/components/layout/sidebar-nav.tsx` — render icon cho từng item,
  spacing, class active/hover.
- `src/components/layout/app-shell.tsx` — token màu nền/border của
  sidebar, phần header, vị trí `LogoutButton`.
- `src/features/auth/components/logout-button.tsx` — thêm icon `LogOut`.
- `src/config/nav.test.ts` — test hiện có chỉ assert trên `href`/permission,
  an toàn để mở rộng thêm, không phá vỡ.

**Status badges**
- `src/features/partners/components/partner-status-badge.tsx` — component
  status-badge duy nhất hiện có (`pending`/`active`/`suspended`/`inactive`),
  hiện đang map vào các variant shadcn chung (`secondary`/`default`/
  `outline`/`destructive`), chưa mang ý nghĩa semantic.
- `src/components/ui/badge.tsx` — `badgeVariants` (cva) dùng chung, hiện có
  `default | secondary | destructive | outline | ghost | link`; cần thêm
  variant `success` / `warning` / `info` nếu Goal 5 được triển khai qua
  component dùng chung (đúng theo nguyên tắc "không tự chế biến variant
  handling" trong `frontend.md`).

**Component UI dùng token sẵn có (chỉ kiểm tra lại, không viết lại)**
- `src/components/ui/button.tsx`, `table.tsx`, `card.tsx`, `input.tsx`,
  `select.tsx`, `dialog.tsx`, `alert.tsx`, `field.tsx`, `label.tsx`,
  `separator.tsx` — đều đã dùng token (`bg-primary`, `text-muted-foreground`,
  `border-border`, v.v.), không tìm thấy hex thô hay class màu tùy tiện
  trong `src` (đã grep xác nhận). Các component này sẽ tự cập nhật giao
  diện khi token đổi; chỉ cần kiểm tra lại (spot-check).
- Các trang `src/app/(dashboard)/dashboard/page.tsx`,
  `(admin)/admin`, `(admin)/partners/**`, `(admin)/airports/**` — kiểm tra/
  xác nhận việc dùng token, không đụng vào logic.

**Docs**
- `docs/architecture.md` — phần F04 đã mô tả `nav.ts`/`sidebar-nav.tsx`/
  `app-shell.tsx`; thêm một đoạn ngắn ghi chú field `icon` mới và nguồn
  bảng màu, không viết lại toàn bộ.
- `docs/roadmap.md` — việc này không map vào feature `F` nào trong
  roadmap (là polish cross-cutting); ghi chú rõ điều này thay vì tạo một
  mục `F` giả.

## Task list

1. Chuyển 12 giá trị hex đã cho sang định dạng token hiện có và soạn bản
   thay thế `:root` đầy đủ. Token hiện tại dùng `oklch(...)`; cần quyết
   định một lần (xem Open Questions) là giữ định dạng đó (convert hex→oklch)
   hay chuyển token brand mới sang hex, sau đó map: `--background`→#F5F7FA,
   `--foreground`→#172033, `--card`/`--popover`→#FFFFFF (`--card-foreground`/
   `--popover-foreground`→#172033), `--primary`→#0F4C81 (`--primary-foreground`
   →trắng, cần kiểm tra contrast), `--secondary`→#2F6B8A
   (`--secondary-foreground`→trắng hoặc #172033, chọn giá trị đạt contrast),
   `--muted-foreground`→#64748B (`--muted` cần một giá trị neutral sáng dẫn
   xuất, không nằm trong 12 hex đã cho — giữ tông xám nhạt nhất quán với
   `--background`/`--border`), `--border`/`--input`→#E2E8F0,
   `--destructive`→#DC2626. Không phụ thuộc task nào; đây là bước soạn/kiểm
   tra, chưa áp dụng.
2. Thêm token semantic mới cho Success/Warning/Info (`--success`,
   `--success-foreground`, `--warning`, `--warning-foreground`, `--info`,
   `--info-foreground`) vào `:root`, dùng #16A34A / #D97706 / #0284C7 làm
   nền và chọn màu chữ (`-foreground`) đạt contrast cho từng cái — các
   token này chưa tồn tại trong shadcn boilerplate hiện tại, cần thêm mới
   chứ không chỉ remap.
3. Đăng ký các token mới vào khối `@theme inline` trong `globals.css`
   (`--color-success: var(--success)`, v.v.) để các class Tailwind như
   `bg-success`/`text-success-foreground` khả dụng — theo đúng pattern đã
   dùng cho `--color-destructive`/`--color-muted`/v.v.
4. Áp dụng cùng bảng màu cho `.dark` nếu dark mode vẫn nằm trong phạm vi
   (xem Open Questions) — biến thể tối hơn/điều chỉnh của cùng màu
   brand/semantic, theo đúng pattern khối `.dark` hiện có (ví dụ cách
   `--destructive` được làm sáng hơn cho dark mode hiện tại).
5. Quyết định vị trí đặt `Primary Dark` (#0B3558) và triển khai: dùng làm
   `--primary` cho dark mode, và/hoặc shade hover/active cho brand color
   chính (codebase đã có tiền lệ dùng `color-mix()` cho pattern "hover: tối/
   sáng hơn base một chút" trong variant `secondary` của `button.tsx` — nên
   tái sử dụng convention này thay vì tạo token `--primary-dark` không có
   trong chuẩn shadcn). Phụ thuộc task 1 (giá trị primary cuối cùng) và
   task 4 (nếu dùng làm primary cho dark mode).
6. Thêm variant `success` / `warning` / `info` vào `badgeVariants` trong
   `src/components/ui/badge.tsx`, theo đúng cấu trúc variant `default`/
   `secondary`/`destructive` hiện có (nền tint + màu chữ tương ứng, ví dụ
   `bg-success/10 text-success` giống cách `destructive` đang được style ở
   độ mờ 10-20%). Phụ thuộc task 2/3 (token phải tồn tại trước).
7. Remap `STATUS_VARIANT` trong `partner-status-badge.tsx` sang variant
   semantic mới theo quy tắc Goal 5 (`active`→`success`, `pending`→
   `warning`, `inactive`→xử lý neutral/muted, `suspended`→cần quyết định rõ,
   xem Open Questions). Phụ thuộc task 6.
8. Rà soát `docs/architecture.md` phần F06/F07 và toàn bộ UI liên quan đến
   status/badge trong các feature khác (`partners-table.tsx`,
   `partner-detail.tsx`, danh sách/chi tiết `airports` — airports không có
   cột status theo F07) để xác nhận `PartnerStatusBadge` đúng là component
   status-indicator duy nhất hiện tại, tránh bỏ sót khi áp dụng Goal 5.
   (Task chỉ đọc/kiểm tra, có thể chạy song song với task 1-7.)
9. Thêm field `icon` vào `NavItem` (`src/config/nav.ts`), kiểu dữ liệu theo
   type icon component của `lucide-react` (ví dụ `LucideIcon`), gán icon
   cho từng mục hiện có: `Admin Operations`→`LayoutDashboard` (gần nhất vì
   không có mục "Dashboard" theo đúng nghĩa đen), `Partners`→`Building2`,
   `Airports`→`Plane`, `Technician Jobs`→`ClipboardList` (gần nhất với
   "Jobs"), `Partner Portal`→cần quyết định vì `Building2` đã dùng cho
   `Partners` (xem Open Questions). Không phụ thuộc các task về token.
10. Render icon trong `sidebar-nav.tsx`, kích thước nhất quán 16-20px
    (`size-4`/`size-[18px]` theo convention size Tailwind đã dùng trong
    `button.tsx`/`badge.tsx`), khoảng cách icon/label cố định qua utility
    `gap-*` sẵn có, `aria-hidden="true"` trên icon vì label text luôn hiện
    diện song song (Goal 6). Phụ thuộc task 9.
11. Cập nhật class active/hover trong `sidebar-nav.tsx` để dùng token
    `primary` mới rõ ràng cho mục active (ví dụ `bg-primary/10 text-primary`
    thay cho style active hiện tại `bg-muted text-foreground`) và hover
    state riêng biệt, nhẹ hơn active. Phụ thuộc task 1-4 (giá trị primary
    cuối cùng) và task 10 (icon đã render sẵn để style active bao trùm cả
    icon+label).
12. Thêm icon `LogOut` vào `LogoutButton`
    (`src/features/auth/components/logout-button.tsx`), kích thước nhất
    quán với sidebar nav; vì button đã có text "Sign out"/"Signing out..."
    hiển thị, icon là decorative (`aria-hidden="true"`), không thay thế
    label.
13. Kiểm tra khả năng hiển thị focus khi dùng bàn phím trên sidebar link và
    logout button — xác nhận class `focus-visible:` sẵn có trong cva output
    của `button.tsx` vẫn áp dụng/giữ nguyên; xác nhận thẻ `<Link>` trong
    `sidebar-nav.tsx` có ring focus-visible tương đương (hiện chưa có ngoài
    default của browser). Đây là Goal 6, chỉ thêm mới, không đụng gì khác
    ngoài focus styling.
14. Spot-check lại từng component UI dùng token chung (`button.tsx`,
    `table.tsx`, `card.tsx`, `input.tsx`, `select.tsx`, `dialog.tsx`,
    `alert.tsx`) sau khi đổi token, trên các trang list/detail/create/edit
    của partners/airports và trang dashboard/admin placeholder — xác nhận
    không có gì bị vỡ layout (ví dụ một `dark:` variant hardcode giả định
    bảng màu gần-grayscale cũ). Không kỳ vọng có thay đổi code ở task này
    trừ khi phát hiện vấn đề; nếu có, tách thành task nhỏ riêng thay vì sửa
    ngay tại chỗ.
15. Mở rộng `src/config/nav.test.ts` (hoặc thêm test nhỏ mới) assert mỗi
    `NAV_ITEM` đều có `icon` xác định, theo quy tắc testing (config dùng
    chung mới/thay đổi cần ít nhất một happy-path test). Phụ thuộc task 9.
16. Thêm/cập nhật test cho mapping variant của `PartnerStatusBadge` (hiện
    chưa có test) bao phủ cả 4 giá trị `PartnerStatus` map đúng variant
    semantic dự kiến — theo `testing.md` ("mỗi feature cần happy path cộng
    edge case") và vì đây là loại pure-mapping logic rẻ để lock lại. Phụ
    thuộc task 7.
17. Cập nhật phần F04 trong `docs/architecture.md` với ghi chú ngắn rằng
    `NavItem` giờ có field `icon`, và thêm ghi chú ngắn (subsection mới hoặc
    addendum, không phải mục roadmap giả) về nguồn bảng màu token cho người
    đóng góp sau này. Phụ thuộc việc task 1-11 đã chốt.
18. Chạy lint và build (`npm run lint`, `npm run build`) theo yêu cầu
    CLAUDE.md ("chạy lint và build sau thay đổi đáng kể"), và chạy test
    suite (`npm run test`) vì có test mới/thay đổi ở task 15-16.

## Dependencies

- Task 2 và 3 chặn task 6 (badge variant cần token tồn tại trước).
- Task 6 chặn task 7 (badge component cần variant mới trước khi partner
  badge dùng được).
- Task 1 (giá trị primary/secondary cuối cùng) chặn task 5 (vị trí đặt
  primary-dark) và task 11 (style active-state).
- Task 9 chặn task 10, 12 (render icon cần icon đã gán trước) và task 15
  (test cần field đã tồn tại).
- Task 7 chặn task 16 (test cần mapping cuối cùng).
- Task 1-11 nên hoàn tất trước task 17 (docs mô tả trạng thái đã xong,
  không phải đang dở).
- Task 18 chạy sau cùng, sau khi mọi thay đổi code hoàn tất.

## Risks & edge cases

- **Nguy cơ giảm contrast.** Đổi `--secondary` từ neutral gần-trắng
  (`oklch(0.97 0 0)`) sang teal-blue bão hòa (#2F6B8A) ảnh hưởng mọi
  component dùng variant `secondary` (button, badge) — `secondary-foreground`
  cần kiểm tra lại contrast WCAG với nền mới, không chỉ giữ nguyên giá trị
  gần-trắng cũ.
- **`--muted` không có hex được chỉ định trong ticket.** 12 màu đã cho
  không bao gồm giá trị cho nền `--muted` (chỉ có `--muted-foreground` qua
  "Muted Text" #64748B) — phải suy ra (một neutral sáng nhất quán với
  `--background`/`--border`), đây là quyết định thiết kế, không phải map
  trực tiếp.
- **Trạng thái "inactive" của partner hiện đang hiển thị màu destructive
  (đỏ).** Quy tắc trong Goal 5 ("neutral/inactive→muted") sẽ đổi màu badge
  của partner bị deactivate từ đỏ sang xám — một thay đổi ý nghĩa semantic
  thật sự, nhìn thấy được, dù "chỉ là màu sắc". Đã được nêu rõ, không tự ý
  áp dụng.
- **Trạng thái "suspended" của partner không có mapping rõ ràng** trong
  danh sách success/warning/danger/info/muted của Goal 5 — đoán mò sẽ mâu
  thuẫn với nguyên tắc "không tự ý thêm/suy diễn phạm vi".
- **Xung đột icon**: `Building2` được gợi ý cho khái niệm "Partners" chung
  chung, cũng là lựa chọn hiển nhiên cho "Partner Portal" — nhưng đây là 2
  nav item khác nhau (`/partners` CRUD nội bộ vs. `/partner` portal dành
  cho đối tác) — dùng chung 1 icon cho cả hai sẽ gây nhầm lẫn trong sidebar
  chỉ có 5 mục.
- **Không có component tooltip nào trong `src/components/ui`.** Nếu sau
  này có tính năng collapsed-sidebar, yêu cầu "accessible labels/tooltips
  khi collapsed" sẽ cần thêm shadcn tooltip primitive mới — ngoài phạm vi
  hiện tại, nhưng cần nêu rõ để không ngầm hứa hẹn điều ticket này không
  triển khai.
- **File `globals.css` import base stylesheet của package `shadcn`** (từ
  npm package `shadcn` v4.19.0) — việc override token phải giữ nguyên ở
  `:root`/`.dark` trong `globals.css` như hiện tại; không sửa gì bên trong
  chính package `shadcn`.
- **Dark mode hiện chưa có cơ chế kích hoạt nào** (không có `next-themes`,
  không có toggle, không có `ThemeProvider`, không có script gán class
  `.dark`) — khối CSS `.dark` chỉ tồn tại như scaffold chưa dùng từ lúc
  setup shadcn ban đầu. Cập nhật nó tốn ít công sức nhưng chưa có hiệu ứng
  hiển thị nào cho tới khi có toggle.
- **Vitest đã có sẵn** (`package.json` có `"test": "vitest run"` và các
  file `.test.ts` theo từng feature) — mô tả "chưa cài test runner" trong
  `testing.md` đã lỗi thời; các quy tắc coverage tối thiểu trong file đó
  vẫn áp dụng cho thay đổi này (nav config mới/thay đổi, badge mapping
  mới/thay đổi).

## Quyết định đã chốt

Người dùng đã duyệt kế hoạch với các quyết định sau cho các "Open questions":

1. **Định dạng token**: convert 12 giá trị hex sang `oklch(...)`, giữ nhất
   quán với toàn bộ token hiện có trong `globals.css`.
2. **Giá trị nền `--muted`**: dùng một neutral sáng dẫn xuất từ
   `--background`/`--border` (không giữ nguyên giá trị oklch cũ của
   shadcn boilerplate).
3. **Vị trí Primary Dark (#0B3558)**: dùng làm shade hover/active của
   `--primary` (qua `color-mix()`, theo đúng convention đã có ở variant
   `secondary` của `button.tsx`), không dùng làm `--primary` riêng cho
   dark mode.
4. **Màu status của partner**: `inactive`→`muted` (xám), `suspended`→
   `warning` (amber) — đúng theo tinh thần "neutral/inactive→muted" của
   Goal 5. Đây là thay đổi UX có thể nhìn thấy (badge "inactive" đổi từ
   đỏ sang xám), đã được xác nhận là chủ đích.
5. **Icon cho 2 nav item không map rõ ràng**: `Admin Operations`→
   `LayoutDashboard`, `Partner Portal`→`UserCircle` (phân biệt với
   `Building2` của `Partners`).
6. **Dark mode**: vẫn cập nhật khối `.dark` theo bảng màu mới như
   future-proofing (chi phí thấp, dù hiện chưa có toggle/provider nào
   kích hoạt nó).
7. **Ghi chú docs**: thêm một đoạn ngắn "cross-cutting UI polish" vào
   `docs/architecture.md`, không tạo mục `F`-number giả trong
   `docs/roadmap.md`.

## Open questions

1. **Định dạng giá trị token**: token brand/semantic mới nên biểu diễn
   dưới dạng `oklch(...)` (khớp mọi token hiện có trong `globals.css`) hay
   custom property hex thô? Convert hex sang oklch giữ tính nhất quán nội
   bộ nhưng cần bước convert không được ticket chỉ định; giữ hex đơn giản
   hơn nhưng trộn lẫn định dạng trong cùng file. Cần quyết định trước khi
   chốt task 1.
2. **Giá trị nền `--muted`**: không có trong 12 màu ticket đưa ra. Giá trị
   neutral sáng nào nên dùng làm nền (ví dụ tint sáng hơn của
   `--background` hoặc `--border`)? Cần xác nhận thay vì đoán.
3. **Vị trí đặt Primary Dark (#0B3558)**: dùng làm `--primary` cho dark
   mode, shade hover/active của primary ở light mode, hay cả hai? Ticket
   liệt kê nó như một brand color cấp cao nhất nhưng bộ token shadcn không
   có slot "primary-dark" riêng.
4. **Màu semantic cho trạng thái `suspended` của partner**: thuộc nhóm nào
   — `warning` (tạm dừng, cần chú ý) hay nhóm khác? Không nằm trong danh
   sách success/warning/danger/info/muted rõ ràng của ticket.
5. **Đổi màu `inactive` từ destructive (đỏ) sang muted (xám)**: xác nhận
   đây đúng là thay đổi UX mong muốn trước khi triển khai, vì nó thay đổi
   mức độ "khẩn cấp" khi nhìn vào badge của một partner đã bị deactivate.
6. **Icon cho 2 nav item không map rõ ràng vào danh sách gợi ý của ticket**:
   `Admin Operations` (không có mục "Dashboard" đúng nghĩa đen — dùng
   `LayoutDashboard` có chấp nhận được không, hay có icon khác phù hợp hơn
   cho trang landing admin chung?) và `Partner Portal` (cần icon khác biệt
   với `Building2` của `Partners` — ticket không gợi ý cho nhãn này).
7. **Phạm vi dark mode**: vì khối CSS `.dark` tồn tại trong `globals.css`
   nhưng chưa từng được kích hoạt trong app (không có toggle/provider), có
   nên vẫn cập nhật nó theo bảng màu mới như một dạng "future-proofing" hay
   để nguyên vì nó chưa dùng tới và cập nhật là công sức bỏ vào code chết?
8. **Việc này có cần một mục ghi chú riêng trong roadmap/architecture
   docs không** — nó không tương ứng với feature `F` nào trong
   `docs/roadmap.md`; cần xác nhận một ghi chú ngắn "cross-cutting UI
   polish" trong `docs/architecture.md` là đủ, hay cần theo dõi theo cách
   khác.
