# Dữ liệu tài khoản học sinh

Mỗi số điện thoại tương ứng một bản ghi `student_accounts`; bảng
`student_account_students` liên kết tài khoản với một hoặc nhiều học sinh.
`student_enrollments` xác định lớp của từng học sinh. Lớp và quyền của người
thao tác được kiểm tra theo danh sách đang hoạt động.

| Trường trong `student_accounts` | Ý nghĩa |
| --- | --- |
| `password_hash` | Bản băm scrypt của mật khẩu, không lưu mật khẩu gốc. |
| `must_change_password` | Giá trị 1 chỉ cho phép vào luồng đổi mật khẩu. |
| `session_version` | Tăng khi cấp lại hoặc đổi mật khẩu để thu hồi các phiên cũ. |
| `temporary_password_expires_at` | Hạn dùng theo UTC của mật khẩu cấp theo lô. Cột rỗng cho các mật khẩu đã có và được xóa khi đổi mật khẩu. |

Migration `0012_student_temporary_password_expiry.sql` thêm cột hạn dùng,
không ghi đè dữ liệu hoặc chuyển đổi mật khẩu hiện có. Nhật ký cấp lại theo
lô lưu người thao tác, lớp, mã tài khoản và hạn dùng; không ghi mật khẩu.
