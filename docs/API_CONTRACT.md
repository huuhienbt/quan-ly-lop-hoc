# Chức năng quản lý tài khoản học sinh

Trang `/teacher?tab=hoc-sinh` đọc danh sách của lớp mà giáo viên được phân
công hoặc quản trị viên được phép truy cập. Kết quả không chứa mật khẩu hay
bản băm.

Biểu mẫu **Cấp lại hàng loạt** gửi `class_id`, `confirmed` và danh sách tài
khoản đã chọn (mã ghi danh, mã tài khoản và phiên bản hiện tại). Máy chủ kiểm
tra lại quyền, phiên bản và trạng thái hoạt động trước khi ghi. Mỗi lượt có
từ 1 đến 60 tài khoản khác nhau. Tài khoản dùng cho học sinh ở lớp khác chỉ
quản trị viên được cấp lại.

Một lượt thành công thay toàn bộ mật khẩu đã xác nhận, thu hồi các phiên cũ và
chỉ trả mật khẩu tạm trong kết quả của thao tác đó. Nếu quyền hoặc dữ liệu đã
thay đổi, lượt cấp lại bị từ chối; không áp dụng một phần. Tra cứu danh sách
sau đó không thể trả lại các mật khẩu tạm.
