# Quản lý mật khẩu và phiếu đăng nhập học sinh

- Các thao tác mật khẩu nằm ngay trong **Quản trị lớp học → Học sinh**.
  Nút **Cấp lại hàng loạt** nằm cạnh ô tìm kiếm; dùng **Cấp lại mật khẩu**
  hoặc **Đặt mật khẩu** ở dòng học sinh để thao tác với từng tài khoản. Sau khi
  cấp hoặc đặt, xuất một ảnh PNG riêng cho từng số điện thoại trong hộp
  thoại kết quả. Xem [hướng dẫn sử dụng](dang-nhap-hoc-sinh.md).
- Học sinh tự đổi và người quản trị đặt thủ công dùng mật khẩu từ 8–128 ký
  tự, không bắt buộc chữ hoa, số hay ký tự đặc biệt. Cấp tự động vẫn tạo
  mã 8 chữ số. Mật khẩu đã cấp và bản băm trước đây tiếp tục sử dụng được.
- Áp dụng migration `0012_student_temporary_password_expiry.sql` vào đúng
  cơ sở dữ liệu D1 trước khi đưa phiên bản web có tính năng này lên chính
  thức. Mục đặt mật khẩu và xuất phiếu dùng cột hiện có, không cần migration
  mới hay nhập lại hồ sơ.
- Kiểm tra với dữ liệu giả lập: cấp 42 tài khoản, gộp học sinh dùng chung số,
  giữ nguyên số 0 ở đầu mã nhập tay, từ chối cấp ngoài lớp hoặc đặt mã dễ
  đoán, hết hạn đúng thời điểm và thu hồi mật khẩu tạm khi đổi mật khẩu.
  Kiểm thử chỉ cấp hoặc đặt mật khẩu trên tài khoản giả lập.

Quy ước kỹ thuật: [dữ liệu](DATA_SCHEMA.md) và [hành vi máy chủ](API_CONTRACT.md).

### Bảng tin và hồ sơ học sinh

- Dùng chung thẻ bài của trang chủ cho Tin lớp sau đăng nhập, hiển thị ảnh
  ngay; giữ quyền đọc tin riêng theo lớp.
- Căn giữa thông tin học sinh; thêm chỉnh sửa thông tin và ảnh đại diện,
  chuyển Đổi mật khẩu xuống cuối. Giới hạn ảnh và kiểm tra quyền trên máy chủ.
- Lưu một ảnh nhỏ trong trường có sẵn, không cần migration hoặc cấu hình
  dịch vụ lưu ảnh mới. Các kiểm thử hồ sơ và quyền đọc tin dùng dữ liệu giả lập.
