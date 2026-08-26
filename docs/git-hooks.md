# Git Hooks — chặn commit dữ liệu nhạy cảm

Repo này dùng một **pre-commit hook** (Bash, không phụ thuộc thư viện
ngoài) để quét các thay đổi đã `staged` trước mỗi commit, nhằm chặn việc
commit nhầm API key, token, mật khẩu hoặc private key.

## Hook kiểm tra những gì

- **Phạm vi**: chỉ quét `git diff --cached` (phần đã `git add`), bỏ qua
  phần chưa staged.
- **Bỏ qua**: file binary (phát hiện qua `git diff --numstat`), file lock
  (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, ...), file `*.log`.
- **Phát hiện**:
  - AWS Access Key ID / Secret Access Key
  - GitHub token (`ghp_...` và các biến thể `gho_/ghu_/ghs_/ghr_`)
  - Slack token (`xoxb-...` và các biến thể `xoxa-/xoxp-/xoxr-/xoxs-`)
  - OpenAI API key (`sk-...`)
  - JWT token
  - API key/secret dạng biến chung (`api_key=`, `access_token=`, ...)
  - Biến `password` / `pass` / `secret` / `private_key` được gán một giá
    trị cụ thể (bỏ qua giá trị rỗng và placeholder rõ ràng như
    `YOUR_PASSWORD`, `CHANGEME`, `<...>`, `${...}`)
  - Khối `-----BEGIN PRIVATE KEY-----` / `-----BEGIN RSA PRIVATE KEY-----`
    / `-----BEGIN EC PRIVATE KEY-----` / `-----BEGIN OPENSSH PRIVATE KEY-----`
- **Khi phát hiện vi phạm**: in ra file, số dòng, loại nghi vấn và nội
  dung dòng đó (màu đỏ), rồi chặn commit (`exit 1`).
- **Bypass khẩn cấp** (chỉ dùng khi thật sự cần thiết, ví dụ false
  positive đã xác nhận): `git commit --no-verify`.

Source code của hook nằm ở [`../.githooks/pre-commit`](../.githooks/pre-commit)
và được version-control cùng repo (khác với `.git/hooks/`, thư mục này
**không** được Git theo dõi nên không thể chia sẻ hook qua commit — đây
là lý do cần bước cài đặt bên dưới).

## Cài đặt cho từng máy dev

`.git/hooks/` là thư mục cục bộ, không nằm trong Git, nên mỗi máy phải tự
cài hook một lần. Có 2 cách, chọn 1:

### Cách 1 — Tự động qua npm (khuyến nghị, không thêm dependency)

Repo đã khai báo sẵn script `prepare` trong `package.json`:

```json
"scripts": {
  "prepare": "bash scripts/setup-git-hooks.sh"
}
```

npm tự chạy script `prepare` sau mỗi lần `npm install`, nên chỉ cần:

```bash
npm install
```

là hook được copy vào `.git/hooks/pre-commit` và cấp quyền thực thi. Mỗi
khi `.githooks/pre-commit` được cập nhật (qua git pull), chạy lại
`npm install` (hoặc `npm run prepare`) để đồng bộ bản mới nhất.

### Cách 2 — Cài thủ công

```bash
cp .githooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## Phương án thay thế: Husky

Nếu về sau team muốn quản lý nhiều hook hơn (pre-push, commit-msg, ...)
và chấp nhận thêm một dev-dependency, có thể chuyển sang
[Husky](https://typicode.github.io/husky/):

```bash
npm install --save-dev husky
npx husky init
cp .githooks/pre-commit .husky/pre-commit
```

Husky quản lý `core.hooksPath` tự động qua `npm install`, tương tự cách
`scripts/setup-git-hooks.sh` đang làm — chỉ nên thêm nếu thực sự cần các
tính năng khác của Husky, để tránh dependency không cần thiết
(xem `CLAUDE.md`: *Do not introduce unnecessary dependencies*).

## Test hook thủ công

```bash
git add <file>
.git/hooks/pre-commit; echo "exit code: $?"
```
