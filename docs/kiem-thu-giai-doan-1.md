# Kết quả kiểm tra Giai đoạn 1

Đã thực hiện trên môi trường cloud của dự án:

- `npm ci`: cài lại theo lockfile thành công.
- `npm run test`: 32/32 kiểm thử Auth, thao tác quản trị, cấu hình và D1 đều đạt.
- `python3 -m unittest discover -s database/tests -v`: 27/27 kiểm thử schema đã đạt.
- ESLint, TypeScript và `npm run build`: đạt.
- Bản production chạy được trang chủ; trình duyệt chưa đăng nhập bị chuyển khỏi
  `/admin`, và endpoint Google thiếu cấu hình trả 503 như thiết kế.
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

Chưa kiểm tra với tài khoản dịch vụ thật:

- Google OAuth authorization/callback trên Google Cloud.
- D1 remote và gateway Worker đã triển khai trên Cloudflare.
- Vercel deployment và quyền sử dụng hostname `e-class.vercel.app`.

Các mục này cần chủ dự án hoàn thành cấu hình theo
[hướng dẫn triển khai](giai-doan-1.md) trước khi xác nhận hoàn tất Giai đoạn 1.
