# Quản lý mật khẩu và phiếu đăng nhập học sinh

- Chức năng nằm trong **Quản trị lớp học → Học sinh → Mật khẩu học sinh**.
  Có thể cấp lại từng tài khoản từ **Danh sách**, hoặc cấp hàng loạt. Sau
  khi cấp, xuất một ảnh PNG riêng cho từng số điện thoại trong hộp thoại
  kết quả. Xem [hướng dẫn sử dụng](dang-nhap-hoc-sinh.md).
- Áp dụng migration `0012_student_temporary_password_expiry.sql` vào đúng
  cơ sở dữ liệu D1 trước khi đưa phiên bản web có tính năng này lên chính
  thức. Mục xuất phiếu dùng cột hiện có, không cần migration mới hay nhập
  lại hồ sơ.
- Kiểm tra với dữ liệu giả lập: cấp 42 tài khoản, gộp học sinh dùng chung số,
  từ chối cấp ngoài lớp, hết hạn đúng thời điểm và thu hồi mật khẩu tạm khi
  đổi mật khẩu. Không chạy thử thao tác cấp lại trên tài khoản thật.

Quy ước kỹ thuật: [dữ liệu](DATA_SCHEMA.md) và [hành vi máy chủ](API_CONTRACT.md).
