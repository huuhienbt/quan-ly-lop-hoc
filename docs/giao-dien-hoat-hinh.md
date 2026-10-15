# Giao diện hoạt hình 3D

Giao diện dùng xanh dương làm màu chính, phối vàng nắng, hồng và các nền pastel.
Trang chủ, bảng tin, góc học sinh, đăng nhập và khu vực thầy cô cùng sử dụng
phông chữ tròn và thẻ bo góc. Trang quản trị ưu tiên biểu mẫu rõ ràng, dễ đọc.

- Màu chung nằm trong `web/src/app/globals.css`: `--blue`, `--blue-deep`,
  `--yellow`, `--pink`, `--sky`. Các tên `--green` và `--green-dark` cũ được
  giữ để tương thích, nhưng giá trị đã chuyển sang xanh dương.
- Nunito variable được lưu tại `web/src/app/fonts`, dùng `next/font/local`.
  Phông hỗ trợ tiếng Việt; giấy phép OFL đi kèm file gốc. Trình duyệt không
  cần gọi Google Fonts.
- Hai ảnh minh họa được tạo cho thiết kế này và lưu dưới `web/public/images`.
  `happy-school-3d.webp` là cảnh sân trường; `classroom-friends-3d.webp` là
  sprite nền trong suốt gồm bốn chủ đề, được hiển thị bằng CSS.
- Bài viết có ảnh bìa riêng sẽ ưu tiên ảnh do giáo viên chọn; nếu chưa có,
  hệ thống dùng nhân vật minh họa tương ứng với chủ đề.
- Trên màn hình nhỏ, nội dung chuyển về một cột. Trang học sinh ưu tiên
  lịch, tin và việc cần làm; hình trang trí được giảm để thao tác thuận tiện.

Đây là thay đổi giao diện. Luồng đăng nhập, đổi mật khẩu, quyền xem và chỉnh sửa,
dữ liệu bài viết, học sinh và dấu hoàn thành không thay đổi.
