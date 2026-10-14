# Kết quả kiểm tra Giai đoạn 1

Đã thực hiện trên môi trường cloud của dự án:

- `npm ci`: cài lại theo lockfile thành công.
- `npm run test`: 32/32 kiểm thử Auth, thao tác quản trị, cấu hình và D1 đều đạt.
- `python3 -m unittest discover -s database/tests -v`: 27/27 kiểm thử schema đã đạt.
- ESLint, TypeScript và `npm run build`: đạt.
- Bản build production chạy local hiển thị được trang chủ; trình duyệt chưa
  đăng nhập bị chuyển khỏi `/admin`, và endpoint Google thiếu cấu hình trả 503
  như thiết kế. Đây chưa phải kiểm tra website trên Vercel.
- D1 local chạy toàn bộ migration, chạy lại không có migration mới.
- `setup:local` chạy lại giữ nguyên các khóa đã tạo.

Kiểm tra trình duyệt với D1 local thật và dữ liệu tạm:

- Trang chủ hiển thị đúng trên điện thoại, không tràn ngang.
- Chưa cấu hình Google thì đăng nhập bị khóa rõ ràng.
- Chưa đăng nhập hoặc là Teacher không truy cập được `/admin`.
- Super Admin duyệt Teacher, tạo năm học, tạo lớp riêng tư và phân công GVCN.
- Tạm khóa Teacher khiến phiên hiện tại mất quyền và kết thúc phân công ngay.
- Thao tác có audit log; logout NextAuth hoạt động.
- Gateway từ chối request thiếu token; batch lỗi rollback trên D1 local thật.

Browser fixture dùng JWT ký hợp lệ phục vụ kiểm tra local và được xóa sau chạy.
Ứng dụng không có đường đăng nhập demo hoặc bỏ qua Google trong production.

Kiểm tra Cloudflare production ngày 14/10/2026:

- Token Cloudflare truy cập đúng account/database thành công.
- D1 remote chạy migration `0001_initial.sql` đủ 62 lệnh; xác nhận 24 bảng ứng
  dụng, có trường Bến Tre và `PRAGMA foreign_key_check` không có dòng lỗi.
- Worker `lophocthongminh-d1` đã triển khai, bind D1 `quan-ly-lop-hoc`, URL thực
  tế `https://lophocthongminh-d1.huuhienbte.workers.dev`.
- Secret `D1_GATEWAY_TOKEN` đã được đặt qua binding bảo mật vào Cloudflare API,
  trả HTTP 201; không in giá trị hoặc ghi secret vào file.
- GET `/health` có xác thực trả HTTP 200, `success: true`.
- POST `/query` có xác thực trả HTTP 200; SELECT xác nhận đúng trường Bến Tre
  trong database production.
- Kết nối tới hostname Worker trước đây bị proxy chặn. Sau khi Publish cấu
  hình có hostname này và binding secret, kiểm tra lại đã thành công bằng
  Node.js fetch. Request từ Python đã gặp lỗi Cloudflare 1010 do User-Agent.

Vercel Domains đã được xác nhận qua ảnh của chủ dự án:

- Project `web`: `e-class-vinhlong.vercel.app` có **Valid Configuration**,
  kết nối **Production**. Chưa xác nhận các biến Production hoặc đăng nhập.
- Trang chủ công khai trả HTTP 200 và có nội dung Lớp học hạnh phúc.
- Endpoint `/api/auth/providers` hiện trả HTTP 503 `ConfigurationUnavailable`;
  cấu hình xác thực Production chưa sẵn sàng.

Chưa kiểm tra:

- Google OAuth authorization/callback trên Google Cloud.
- Các biến môi trường và đăng nhập tại `e-class-vinhlong.vercel.app`.
- Luồng Super Admin/Teacher và thao tác tạo lớp, duyệt/phân công/khóa tài khoản
  trên website Vercel với Google OAuth và D1 production.

Các mục này cần chủ dự án hoàn thành cấu hình theo
[hướng dẫn triển khai](giai-doan-1.md) trước khi xác nhận hoàn tất Giai đoạn 1.
