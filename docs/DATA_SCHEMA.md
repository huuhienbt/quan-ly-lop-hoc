# Dữ liệu tài khoản học sinh

Mỗi số điện thoại tương ứng một bản ghi `student_accounts`; bảng
`student_account_students` liên kết tài khoản với một hoặc nhiều học sinh.
`student_enrollments` xác định lớp của từng học sinh. Lớp và quyền của người
thao tác được kiểm tra theo danh sách đang hoạt động.

| Trường trong `student_accounts` | Ý nghĩa |
| --- | --- |
| `password_hash` | Bản băm scrypt của mật khẩu, không lưu mật khẩu gốc. |
| `must_change_password` | Giá trị 1 chỉ cho phép vào luồng đổi mật khẩu. |
| `session_version` | Tăng khi cấp lại, đặt mật khẩu tạm hoặc khi học sinh đổi mật khẩu để thu hồi các phiên cũ. |
| `temporary_password_expires_at` | Hạn dùng theo UTC của mật khẩu tạm cấp từ trang quản trị (một hoặc nhiều tài khoản). Cột có thể rỗng với mật khẩu đã cấp trước đây và được xóa khi đổi mật khẩu. |

Migration `0012_student_temporary_password_expiry.sql` thêm cột hạn dùng,
không ghi đè dữ liệu hoặc chuyển đổi mật khẩu hiện có. Nhật ký cấp lại theo
lô (`STUDENT_PASSWORD_BULK_RESET`) và đặt thủ công (`STUDENT_PASSWORD_MANUAL_SET`)
lưu người thao tác, lớp, mã tài khoản và hạn dùng; không ghi mật khẩu.
Phiếu đăng nhập không tạo thêm bản ghi, dùng ngay mã tạm trong hộp thoại
kết quả để tải ảnh trên thiết bị của giáo viên.

## Hồ sơ cá nhân học sinh

Học sinh có thể cập nhật `students.display_name`, `date_of_birth`, `gender`
và ảnh của mình. Họ tên chính thức, mã học sinh, lớp và tài khoản vẫn do giáo
viên quản lý. `students.avatar_key` dùng cột TEXT hiện có, lưu một ảnh WebP
256 × 256 px tối đa 64 KiB theo dạng `inline-webp-v1:<base64>`; thay ảnh
ghi đè bản cũ, xóa ảnh đặt giá trị NULL. Không cần migration dữ liệu.
`students.updated_at` dùng để từ chối ghi đè khi hồ sơ vừa được cập nhật.
Ảnh được phục vụ qua API yêu cầu phiên đăng nhập đúng học sinh đang theo học.
Nhật ký `STUDENT_PROFILE_UPDATED` chỉ ghi thông tin thao tác, không ghi ảnh
hoặc giá trị các trường cá nhân.
