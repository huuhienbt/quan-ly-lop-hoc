# Lớp học hạnh phúc

Nền tảng cho lớp Bốn 12, Trường Tiểu học Bến Tre; mở rộng cho toàn trường.

Đã viết phần ứng dụng **Giai đoạn 1**: Next.js App Router, Tailwind CSS,
NextAuth Google/JWT, phân quyền kiểm tra tại server và dashboard `/admin`.
Dashboard duyệt Teacher, tạo năm học/lớp, phân công GVCN và tạm khóa tài khoản.
Schema ban đầu bao quát cả bốn giai đoạn. Theo yêu cầu tiếp theo của chủ dự án,
đã bổ sung tài khoản học sinh đăng nhập bằng số điện thoại, đổi mật khẩu lần đầu,
bảng tin công khai, lịch tuần, góc học sinh và màn hình biên tập của giáo viên.
Các tính năng sao, cảm xúc, hòm thư và tiện ích trợ giảng chưa được triển khai.

- Tên miền đã được Vercel xác nhận Valid Configuration, gắn Production của project `web`: `https://e-class-vinhlong.vercel.app`.
- Super Admin đầu tiên: `huuhienbte@gmail.com`, sau đăng nhập Google đã xác minh.
- D1 production: `quan-ly-lop-hoc`, ID `bed7e67a-c194-4e57-954b-70ce613ff948`; schema gốc có 24 bảng, migration `0002_student_accounts.sql` thêm hai bảng đăng nhập học sinh, `0003_class_content.sql` thêm lịch lớp và checklist. Giữ nguyên toàn bộ hồ sơ đã nhập.
- Gateway đã triển khai: `https://lophocthongminh-d1.huuhienbte.workers.dev/query`; Secret `D1_GATEWAY_TOKEN` đã được đặt. Health check và truy vấn trường Bến Tre có xác thực trên production đều trả HTTP 200.
- Google OAuth Production đã được kiểm tra; tài khoản Super Admin đã đăng nhập thành công. Vercel dùng cùng token gateway đã đặt trong Worker.

## Đăng nhập học sinh

- `/hoc-sinh/dang-nhap`: đăng nhập bằng số điện thoại đã đăng ký.
- `/hoc-sinh/doi-mat-khau`: bắt buộc đổi mật khẩu ban đầu; đổi xong phải đăng nhập lại.
- `/hoc-sinh`: chỉ hiển thị học sinh được liên kết với tài khoản đang đăng nhập.

Mật khẩu được băm scrypt với salt riêng. Tài khoản học sinh tách khỏi tài khoản
Google của giáo viên/quản trị viên. Đăng nhập học sinh không cần cấu hình Google,
nhưng cần gateway, `NEXTAUTH_SECRET` và `NEXTAUTH_URL` hợp lệ.
Xem [hướng dẫn đăng nhập học sinh](docs/dang-nhap-hoc-sinh.md).

## Bảng tin và nội dung lớp

- `/`: bản tin công khai, thông báo, điều tốt trong tuần và góc phụ huynh.
- `/ban-tin/[id]`: đọc bài đã xuất bản công khai; bài riêng tư/bản nháp không có trang công khai.
- `/teacher`: giáo viên được phân công và Super Admin tạo/sửa/lưu trữ bài, sự kiện và nhắc việc.
- `/hoc-sinh`: tin của lớp, lịch tuần, việc hôm nay, chuẩn bị ngày mai, khám phá và hồ sơ riêng.

Checklist lưu trên D1 theo từng học sinh và từng ngày Việt Nam; tải lại trang vẫn
giữ trạng thái. Lịch cụ thể do thầy cô nhập. Có thể dùng `scripts/seed-class-content.mjs`
để thêm nội dung khởi đầu cho một lớp một cách chủ động; script giữ nguyên bài/việc
đã có, không tạo sự kiện hoặc ngày hẹn giả. Không chạy script này tự động khi setup.
Xem [hướng dẫn bản tin và nội dung lớp](docs/ban-tin-va-goc-hoc-sinh.md).

## Chạy local

Dùng Node.js 24. Từ checkout hiện có, không tạo repository/worktree mới:

```bash
cd /workspace/quan-ly-lop-hoc/web
npm ci
npm run setup:local
npm run db:migrate:local
npm run db:dev
```

Giữ terminal trên để chạy D1 gateway. Ở terminal thứ hai:

```bash
cd /workspace/quan-ly-lop-hoc/web
npm run dev
```

Khi cả hai tiến trình đã sẵn sàng, `npm run check:dev` kiểm tra truy vấn D1
và nội dung trang chủ mà không in các khóa cấu hình.

`setup:local` sinh khóa local ngẫu nhiên vào file được ignore, giữ nguyên khóa
đã có và không tạo tài khoản/đường đăng nhập giả. Nếu chưa cấu hình Google,
trang chủ hiện trạng thái đăng nhập đang được thiết lập.

## Kiểm tra

```bash
cd /workspace/quan-ly-lop-hoc/web
npm run test
npm run lint
npm run typecheck
npm run build

cd ..
python3 -m unittest discover -s database/tests -v
```

## Tài liệu và cấu trúc

- [Hướng dẫn triển khai từng bước](docs/giai-doan-1.md)
- [Kết quả kiểm tra và giới hạn hiện tại](docs/kiem-thu-giai-doan-1.md)
- [Toàn bộ schema SQL](database/migrations/0001_initial.sql)
- [Mẫu biến local](.env.example) / [mẫu production](.env.production.example)
- `web/`: ứng dụng Next.js; Vercel **Root Directory = `web`**.
- `tools/d1-gateway.mjs`: Worker server-to-server có token, dùng D1 `DB.batch()`.
- `wrangler.jsonc`: migration D1; `wrangler.gateway.jsonc`: gateway production;
  `wrangler.local.jsonc`: gateway local.
- `scripts/`: chuẩn bị local và wrapper Wrangler với thư mục ghi hợp lệ.

Vercel gọi gateway Worker có token; Worker giữ D1 binding. Các thay đổi liên
quan trong một thao tác quản trị nằm trong một transaction. Trình duyệt không
nhận token database. JWT chỉ chứa user ID; vai trò/trạng thái đọc lại từ D1.
