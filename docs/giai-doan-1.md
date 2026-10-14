# Giai đoạn 1 — chạy local và triển khai

## Những gì đã viết

- Next.js 16.4.0 App Router, React 19, TypeScript, Tailwind 4.
- NextAuth.js 4.24.15 Google Provider, JWT session, logout có CSRF protection.
- Super Admin đầu tiên: `huuhienbte@gmail.com`, được kiểm tra qua email Google đã
  xác minh và whitelist server. Google `sub` là định danh; không tự liên kết email.
- User mới ngoài whitelist có vai trò PENDING; Super Admin duyệt thành Teacher.
- `/admin`: tạo năm học, tạo lớp, duyệt/từ chối Teacher, phân công/kết thúc GVCN,
  tạm khóa/mở lại tài khoản. Server kiểm tra quyền mỗi lần đọc/ghi.
- 24 bảng D1 cho cả bốn giai đoạn; chưa viết các tính năng Giai đoạn 2–4.

Mã ứng dụng đã được đẩy lên GitHub. Tên miền `e-class.vercel.app` và đăng nhập
Google trên Vercel chưa được xác nhận hoạt động.
Database D1 `quan-ly-lop-hoc` đã nạp migration remote thành công ngày 14/10/2026:
24 bảng ứng dụng, có trường Bến Tre và không có lỗi khóa ngoại. Gateway Worker
đã triển khai; còn thiếu Secret `D1_GATEWAY_TOKEN` và cấu hình Google OAuth.
Chỉ sang Giai đoạn 2 khi bạn nói “Giai đoạn 1 đã xong”.

## Kiến trúc

```text
Trình duyệt → Next.js trên Vercel → Worker gateway có token → Cloudflare D1
```

Gateway dùng binding `env.DB` và `DB.batch()` được D1 đảm bảo transaction. Vercel
không có Worker binding trực tiếp. Các giá trị input được truyền bằng SQL params;
không đưa token gateway ra client. API chỉ nhận JSON POST có Bearer token.
Không có CORS cho ứng dụng trình duyệt truy cập database trực tiếp.

NextAuth dùng JWT, không cần bảng sessions/verification_tokens hoặc adapter D1
của Workers. Vai trò trong token không cấp quyền: nguồn quyền hiện tại là D1.
Tạm khóa tài khoản kết thúc các phân công lớp; mở lại không tự phân công lại.

## Bước 1: chạy trong môi trường cloud hiện tại

Dùng Node.js 24 và checkout `/workspace/quan-ly-lop-hoc`. Không tạo worktree.
Ứng dụng đã được khởi tạo trong `web/`; không chạy lại create-next-app.

Terminal thứ nhất:

```bash
cd /workspace/quan-ly-lop-hoc/web
npm ci
npm run setup:local
npm run db:migrate:local
npm run db:dev
```

Giữ terminal này chạy gateway D1 local. Terminal thứ hai:

```bash
cd /workspace/quan-ly-lop-hoc/web
npm run dev
```

`setup:local` tạo `.env.local` và `.dev.vars` với khóa ngẫu nhiên, giữ nguyên
giá trị đã có. Script không in khóa ra log. Nếu đã đặt D1_GATEWAY_URL cho remote,
script giữ cấu hình đó và không tự ép về database local.
Wrapper Wrangler tự dùng thư mục config/log có quyền ghi trong cloud.

Google chưa cấu hình thì nút đăng nhập được khóa với thông báo rõ ràng.
Không có tài khoản demo hay endpoint bỏ qua xác thực.

## Bước 2: đưa mã nguồn lên GitHub

Vercel import mã nguồn từ repo GitHub. Khi đã xem và đồng ý với thay đổi, chạy:

```bash
cd /workspace/quan-ly-lop-hoc
git status --short
git add README.md docs database scripts tools web .gitignore \
  .env.example .env.production.example .dev.vars.example wrangler*.jsonc
git commit -m "Implement phase 1 classroom platform"
git push -u origin main
```

Các file chứa giá trị thật `.env.local`, `.dev.vars`, cùng node_modules và dữ
liệu D1 local được ignore. Chỉ template không chứa secret được đưa lên Git.
Mã Giai đoạn 1 đã được đẩy lên nhánh main. Các lệnh trên dùng cho những lần cập
nhật tiếp theo khi có thay đổi chưa commit.

## Bước 3: nạp schema vào database D1 production đã có

**Đã hoàn tất:** migration `0001_initial.sql` chạy đủ 62 lệnh; kiểm tra remote
xác nhận 24 bảng, trường Bến Tre và `PRAGMA foreign_key_check` không có lỗi.
Giữ các lệnh dưới đây để kiểm tra hoặc áp dụng migration tiếp theo; không cần
tạo lại database hoặc chạy lại SQL bằng tay trong Dashboard.

Trong Terminal có thể hoàn thành Cloudflare login bằng trình duyệt, từ `web/`:

```bash
node ../scripts/wrangler.mjs login
```

Database đã được tạo trong Cloudflare Dashboard:

```text
Tên: quan-ly-lop-hoc
Database ID: bed7e67a-c194-4e57-954b-70ce613ff948
Account ID: 1cbb6895e6fe935d9acc42e27809d088
```

ID, tên và account đã được cập nhật trong **cả hai** file:

```text
wrangler.jsonc
wrangler.gateway.jsonc
```

`wrangler.local.jsonc` dành riêng cho local và vẫn dùng UUID toàn số 0. Lệnh
`db:migrate:local` cũng dùng file local này, nên ID production không ảnh hưởng
database thử nghiệm. Không cần tạo lại database trên Cloudflare.

Nếu để Codex chạy các lệnh remote trong cloud, thêm `CLOUDFLARE_API_TOKEN` bằng
phần Secret của Environment settings, với đích HTTPS `api.cloudflare.com`.
Token giới hạn vào account trên, có quyền D1 Edit và Workers Scripts Edit để
chạy migration và triển khai gateway. Không gửi token qua chat. Đăng nhập
Cloudflare trên dashboard không tự đăng nhập Wrangler trong máy cloud.

Áp dụng SQL vào đúng D1 remote:

```bash
npm run db:migrate:remote
node ../scripts/wrangler.mjs d1 execute DB --remote \
  --config ../wrangler.jsonc \
  --command "SELECT id, name FROM schools; PRAGMA foreign_key_check;"
```

Kết quả cần có trường Bến Tre và không có dòng vi phạm foreign key. SQL chỉ
seed trường; năm học và lớp Bốn 12 sẽ được tạo qua `/admin`.

## Bước 4: triển khai gateway Worker

Worker `lophocthongminh-d1` đã triển khai và bind đúng database production.
URL thực tế là `https://lophocthongminh-d1.huuhienbte.workers.dev`.
Chưa đặt Secret `D1_GATEWAY_TOKEN`; các bước nhập khóa dưới đây vẫn cần làm.

Vẫn trong `web/`, sau khi ID production đã đúng:

```bash
npm run db:deploy:gateway
node ../scripts/wrangler.mjs secret put D1_GATEWAY_TOKEN \
  --config ../wrangler.gateway.jsonc
```

Tự tạo khóa ngẫu nhiên mạnh tối thiểu 32 ký tự cho D1_GATEWAY_TOKEN; nhập bằng
prompt của Wrangler. Sau đó nhập cùng giá trị vào Vercel Environment Variables.
Giữ khóa trong trình quản lý bí mật, không gửi qua chat. Nếu Codex thực hiện
bước đặt Secret Worker, nhập cùng khóa vào mục `D1_GATEWAY_TOKEN` trong Secret
của môi trường Codex, cho phép hai đích `api.cloudflare.com` và
`lophocthongminh-d1.huuhienbte.workers.dev`, lưu rồi Publish môi trường.
Codex dùng binding qua proxy để gửi khóa tới Cloudflare API và kiểm tra gateway;
không sao chép giá trị từ máy cloud. `.dev.vars` chỉ phục vụ
local; nó không thay thế Secret của Worker production.

Wrangler cung cấp địa chỉ Worker thật. Biến phía Vercel cần là:

```text
D1_GATEWAY_URL=https://lophocthongminh-d1.huuhienbte.workers.dev/query
D1_GATEWAY_TOKEN=<cùng khóa đã đặt trong Worker>
```

URL trên là địa chỉ Worker thực tế đã được Wrangler cấp cho account của dự án.
Gateway thiếu secret hoặc secret ngắn sẽ từ chối hoạt động.
Không cần gửi Cloudflare API token vào ứng dụng Next.js runtime.

## Bước 5: tạo Google OAuth Web client

Trong Google Cloud Console của bạn:

1. Chọn/tạo Google Cloud project.
2. Mở Google Auth Platform, cấu hình Branding, Audience và thông tin consent.
3. Với ứng dụng đang Testing, thêm `huuhienbte@gmail.com` và Gmail Teacher thử
   nghiệm vào danh sách Test users.
4. Tạo OAuth client loại **Web application**.
5. Thêm Authorized JavaScript origin production:

```text
https://e-class.vercel.app
```

Thêm Authorized redirect URI chính xác:

```text
https://e-class.vercel.app/api/auth/callback/google
```

Nếu thử Google OAuth local, thêm origin và redirect URI local vào cùng client:

```text
http://localhost:3000
http://localhost:3000/api/auth/callback/google
```

Sao chép Client ID và Client secret vào Vercel Settings hoặc `.env.local` khi
thử local. Không commit hoặc gửi các giá trị secret qua chat.

## Bước 6: tạo project Vercel

Trong Vercel Dashboard:

1. **Add New → Project**, import `huuhienbt/quan-ly-lop-hoc` sau khi đã push code.
2. **Project Name:** `e-class`.
3. **Framework Preset:** Next.js; **Root Directory:** `web`.
4. Dùng Node.js 24. Thêm biến môi trường **Production** bên dưới trước khi login.
5. Deploy và kiểm tra **Settings → Domains** để xác nhận Vercel cấp đúng
   `e-class.vercel.app`. Tên miền chưa được đặt chỗ bằng thay đổi source.
   Nếu tên đã được sử dụng, cần xử lý quyền sở hữu hoặc chọn tên khác rồi cập
   nhật NEXTAUTH_URL và callback Google cùng nhau.

| Tên biến | Giá trị / nguồn |
| --- | --- |
| `NEXTAUTH_URL` | `https://e-class.vercel.app` |
| `NEXTAUTH_SECRET` | Khóa ngẫu nhiên mạnh ít nhất 32 ký tự, riêng cho production |
| `GOOGLE_CLIENT_ID` | Google Web OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google Web OAuth client secret |
| `D1_GATEWAY_URL` | URL Worker thật có đường dẫn `/query` |
| `D1_GATEWAY_TOKEN` | Cùng Secret của Worker, tối thiểu 32 ký tự |
| `SUPER_ADMIN_EMAILS` | `huuhienbte@gmail.com` |

Mẫu nằm trong [`.env.production.example`](../.env.production.example).
Không đặt D1_LOCAL_API_URL/D1_LOCAL_API_TOKEN trong Production; ứng dụng sẽ
từ chối cấu hình loopback khi NODE_ENV=production.

**Đặt SUPER_ADMIN_EMAILS trước lần đăng nhập Google đầu tiên.** Whitelist chỉ
bootstrap tài khoản mới. Thêm email vào whitelist sau khi tài khoản đã là
PENDING không tự nâng quyền; khi đó cần phục hồi quyền qua thao tác database
được chủ dự án kiểm soát. Mở lại tài khoản bị khóa cũng không tự cấp lại lớp.

## Bước 7: kiểm tra Giai đoạn 1 trên bản thật

1. Đăng nhập `huuhienbte@gmail.com`; phải có nút vào trang quản trị.
2. Tạo năm học thực tế của trường, rồi tạo Bốn 12, khối 4. Chọn slug có năm học.
3. Dùng Gmail Teacher khác đăng nhập; chưa duyệt thì không vào `/admin`.
4. Super Admin duyệt Teacher và phân công lớp Bốn 12.
5. Teacher đã duyệt vẫn không vào `/admin`; quyền lớp sẽ phục vụ dashboard
   Giai đoạn 2. Kết thúc phân công/tạm khóa phải thu hồi quyền ngay.
6. Đăng xuất/đăng nhập lại; xác nhận tài khoản bị khóa không phục hồi quyền.
7. Kiểm tra giao diện trên điện thoại và thông báo lỗi khi input trùng/không hợp lệ.

Chỉ coi Giai đoạn 1 hoạt động production sau khi những kiểm tra này hoàn tất.

## Schema cho cả bốn giai đoạn

[Toàn bộ SQL](../database/migrations/0001_initial.sql) gồm:

| Nhóm | Bảng / view |
| --- | --- |
| Quản trị | schools, academic_years, users, accounts, teacher_requests, classes, class_teachers, audit_logs |
| Dữ liệu lớp | students, student_enrollments, posts, media_assets, post_media |
| Tương tác | stars, moods, messages, gratitudes; view student_star_balances |
| Ảnh/tiện ích | albums, photos, photo_likes, group_sessions, student_groups, group_members, wheel_draws |

Hồ sơ học sinh tách khỏi enrollment để giữ lịch sử theo năm/lớp. FK kép ngăn
dữ liệu chéo lớp/trường. Sao là ledger bất biến; mỗi học sinh một mood/ngày
theo Asia/Ho_Chi_Minh. Thư ẩn danh không lưu trường nhận diện; lời biết ơn cần
duyệt; ảnh lưu metadata/URL thay vì blob. Timestamp UTC, updated_at do app đặt.

## Các lệnh kiểm tra mã

```bash
cd /workspace/quan-ly-lop-hoc/web
npm run test
npm run lint
npm run typecheck
npm run build
cd ..
python3 -m unittest discover -s database/tests -v
```

Unit tests dùng SQLite trong bộ nhớ và callback fixtures, không gọi Google
thật hay dữ liệu production. Kiểm tra trình duyệt local dùng JWT ký hợp lệ cho
fixture tạm và D1 local thật; fixture được xóa sau chạy, không có bypass trong
code ứng dụng. Build thành công không thay thế việc cấu hình và thử OAuth thật.
