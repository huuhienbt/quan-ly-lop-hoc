# Chức năng quản lý tài khoản học sinh

Trang `/teacher?tab=hoc-sinh` đọc danh sách của lớp mà giáo viên được phân
công hoặc quản trị viên được phép truy cập. Kết quả không chứa mật khẩu hay
bản băm.

Biểu mẫu **Cấp lại mật khẩu** và **Cấp lại hàng loạt** dùng cùng thao tác gửi `class_id`, `confirmed` và danh sách tài
khoản đã chọn (mã ghi danh, mã tài khoản và phiên bản hiện tại). Máy chủ kiểm
tra lại quyền, phiên bản và trạng thái hoạt động trước khi ghi. Mỗi lượt có
từ 1 đến 60 tài khoản khác nhau. Tài khoản dùng cho học sinh ở lớp khác chỉ
quản trị viên được cấp lại.

Biểu mẫu **Đặt mật khẩu** dùng thao tác riêng `setStudentPasswordAction` cho
một tài khoản, nhận `class_id`, `enrollment_id`, `account_id`, `session_version`,
`confirmed=yes` và `temporary_password` từ 8 đến 128 ký tự. Cũng như khi học
sinh tự đổi mật khẩu, có thể dùng một cụm từ trên một dòng (có dấu cách),
không cần pha trộn chữ hoa, số hoặc ký tự đặc biệt. Mật khẩu mới phải khác
mật khẩu hiện tại và không dùng các giá trị phổ biến hoặc ngày sinh. Máy
chủ vẫn kiểm tra cùng phạm vi quyền và loại mật khẩu tạm lấy từ số đăng nhập.
Mật khẩu tạm hết hạn sau 24 giờ và được đổi khi đăng nhập. Cấp tự động vẫn
tạo mã 8 chữ số.

Một lượt thành công thay toàn bộ mật khẩu đã xác nhận, thu hồi các phiên cũ và
chỉ trả mật khẩu tạm trong kết quả của thao tác đó. Nếu quyền hoặc dữ liệu đã
thay đổi, lượt cấp lại bị từ chối; không áp dụng một phần. Tra cứu danh sách
sau đó không thể trả lại các mật khẩu tạm.

**Xuất phiếu** dùng kết quả cấp lại hoặc đặt mã đang mở để tạo ảnh PNG trong trình duyệt.
Mỗi lần xuất chỉ dùng một tài khoản, có thể gồm nhiều tên trong lớp nếu dùng
chung số. Mật khẩu dài được xuống dòng, dấu cách được đánh dấu khi cần đọc
từ ảnh; chức năng sao chép giữ nguyên từng ký tự. Phiếu không đưa mật khẩu
vào URL, không gửi thêm yêu cầu lên máy chủ và không có đường dẫn công khai
để truy xuất lại.

## Hồ sơ và bảng tin học sinh

- Trang `/hoc-sinh/thong-tin` dùng server action `updateStudentProfile` để
  cập nhật ngày sinh, giới tính và ảnh của chính học sinh. Yêu cầu phiên hợp
  lệ, lớp đang học, phiên bản hồ sơ hiện tại; từ chối trường họ tên hoặc tên
  hiển thị, mã học sinh, lớp hoặc quyền truy cập trong yêu cầu chỉnh sửa.
- Ảnh gốc JPG, PNG, WebP tối đa 2 MiB. Trình duyệt thu nhỏ ảnh trước khi gửi
  (tối đa 200 KiB); máy chủ kiểm tra định dạng và kích thước, lưu WebP
  256 × 256 px không quá 64 KiB. Xóa ảnh được hỗ trợ.
- `GET /api/student-avatars/{enrollmentId}` trả ảnh cho đúng tài khoản học
  sinh đang hoạt động, hoặc cho thành viên cùng lớp và giáo viên có quyền
  quản lý lớp trong năm học đang diễn ra. Không có ảnh hoặc không đủ quyền
  trả 404; phản hồi riêng tư, không lưu cache. API trò chuyện trả đường dẫn
  ảnh theo phiên bản hiện tại (`sender_avatar_url` và `avatar_url` cho danh
  sách chọn học sinh của giáo viên), không trả dữ liệu ảnh trong JSON.
- Tin lớp sau đăng nhập dùng cùng thẻ bài và ảnh bìa theo giao diện trang chủ.
  Trang chi tiết `/ban-tin/{id}` phục vụ tin công khai hoặc tin riêng của lớp
  đang học, kiểm tra quyền phía máy chủ. Danh sách chỉ đọc dữ liệu thẻ bài;
  nội dung chi tiết được đọc khi mở bài.
- Học tập dùng cùng kiểu thẻ như Tin lớp. `/?muc=hoc-tap&bai={id}` chỉ đọc
  bài đã xuất bản của lớp mà học sinh được phép truy cập; hiển thị trực tiếp
  nội dung và PDF bên dưới menu. Danh sách không đọc toàn bộ tài liệu của
  từng bài, và ảnh bìa nếu có được tải riêng.
