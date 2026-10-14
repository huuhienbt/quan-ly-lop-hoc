# Lớp học hạnh phúc

Nền tảng cho lớp Bốn 12, Trường Tiểu học Bến Tre; mở rộng cho toàn trường.

Đã viết phần ứng dụng **Giai đoạn 1**: Next.js App Router, Tailwind CSS,
NextAuth Google/JWT, phân quyền kiểm tra tại server và dashboard `/admin`.
Dashboard duyệt Teacher, tạo năm học/lớp, phân công GVCN và tạm khóa tài khoản.
Schema 24 bảng bao quát cả bốn giai đoạn; chưa triển khai tính năng Giai đoạn 2–4.
Chỉ chuyển sang Giai đoạn 2 khi chủ dự án nói **“Giai đoạn 1 đã xong”**.

- Tên miền production mong muốn: `https://lophocthongminh.vercel.app`.
- Super Admin đầu tiên: `huuhienbte@gmail.com`, sau đăng nhập Google đã xác minh.
- D1 production đã tạo: `quan-ly-lop-hoc`, ID `bed7e67a-c194-4e57-954b-70ce613ff948`.
- Website chưa được triển khai; tên miền chưa được xác nhận cấp trên Vercel.
- D1 production cần nạp schema; gateway và Google OAuth cần hoàn tất cấu hình trước khi dùng thật.

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
