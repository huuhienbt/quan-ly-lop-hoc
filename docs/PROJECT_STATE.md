# Quản lý mật khẩu và phiếu đăng nhập học sinh

- Chức năng nằm trong **Quản trị lớp học → Học sinh → Mật khẩu học sinh**.
  Có thể cấp lại từng tài khoản, cấp hàng loạt, hoặc chọn **Đặt mật khẩu**
  ở dòng học sinh để tự nhập mã tạm 8 chữ số cho một tài khoản. Sau khi
  cấp hoặc đặt, xuất một ảnh PNG riêng cho từng số điện thoại trong hộp
  thoại kết quả. Xem [hướng dẫn sử dụng](dang-nhap-hoc-sinh.md).
- Áp dụng migration `0012_student_temporary_password_expiry.sql` vào đúng
  cơ sở dữ liệu D1 trước khi đưa phiên bản web có tính năng này lên chính
  thức. Mục đặt mật khẩu và xuất phiếu dùng cột hiện có, không cần migration
  mới hay nhập lại hồ sơ.
- Kiểm tra với dữ liệu giả lập: cấp 42 tài khoản, gộp học sinh dùng chung số,
  giữ nguyên số 0 ở đầu mã nhập tay, từ chối cấp ngoài lớp hoặc đặt mã dễ
  đoán, hết hạn đúng thời điểm và thu hồi mật khẩu tạm khi đổi mật khẩu.
  Kiểm thử chỉ cấp hoặc đặt mật khẩu trên tài khoản giả lập.

Quy ước kỹ thuật: [dữ liệu](DATA_SCHEMA.md) và [hành vi máy chủ](API_CONTRACT.md).
