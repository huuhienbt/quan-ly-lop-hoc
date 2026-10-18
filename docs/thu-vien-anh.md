# Thư viện ảnh của lớp

Trang chủ có mục **Thư viện ảnh của lớp** và nút **Mở thư viện ảnh**. Học sinh
cũng có nút thư viện ngay dưới tên lớp trong không gian của mình.

## Thầy thêm ảnh

1. Bấm **Đăng nhập**, đăng nhập Google bằng tài khoản đang quản lý lớp.
2. Trong quản trị, chọn **Thư viện ảnh**, hoặc mở `/teacher#thu-vien-anh`.
3. Chọn đúng lớp, tạo album, đặt tên và ngày sự kiện nếu có.
4. Giữ **Trong lớp** để chỉ học sinh và giáo viên của lớp xem. Chỉ chọn
   **Công khai** khi muốn cho mọi người xem album trên trang chủ.
5. Trong album, bấm **Chọn ảnh từ thiết bị**, chọn ảnh, nhập chú thích nếu
   cần rồi tải lên. Mỗi lượt chọn tối đa 10 ảnh.
6. Có thể sửa thông tin/quyền xem album, ẩn từng ảnh hoặc lưu trữ cả album.
   Với ảnh cũ, mở toàn bộ album để xem và quản lý qua các trang ảnh.

Ảnh nhận định dạng JPG, PNG hoặc WebP, tối đa 20 MB mỗi ảnh trước khi tối ưu
trên thiết bị. Máy chủ kiểm tra lại, đổi sang WebP tối đa 256 KiB/1.600 px và
bỏ thông tin EXIF/GPS. Không nhận tệp GIF. Khi tải lỗi, ảnh chưa lưu được
giữ trong biểu mẫu để thử lại; đóng trang sẽ mất lựa chọn tạm trên thiết bị.

## Quyền xem và lưu trữ

Album mặc định riêng tư. Mỗi lần đọc ảnh, server đọc lại quyền album, trạng
thái trường/lớp và tài khoản. Học sinh cần đổi mật khẩu ban đầu và có liên
kết học sinh đang học tại đúng lớp. Giáo viên chỉ quản lý lớp được phân công;
Super Admin quản lý các lớp đang hoạt động.

Ảnh trả qua `/api/gallery-images/[id]`, dùng `private, no-store`, không đi qua
cache ảnh công khai của Next.js. Ẩn ảnh, lưu trữ album hoặc chuyển về riêng tư
sẽ chặn các lượt tải tiếp theo. Ảnh đã được người có quyền tải về thiết bị
trước đó vẫn là bản sao trên thiết bị của họ.

Lưu trữ/ẩn là thay đổi trạng thái trong D1, không xóa hồ sơ hoặc byte ảnh.
Hiện biểu mẫu chưa có nút khôi phục album/ảnh đã lưu trữ. Danh sách hiển thị
100 album mới nhất; trang album chia 60 ảnh mỗi trang. Trang chủ chỉ đưa ra
4 album công khai gần nhất và đường dẫn mở toàn bộ thư viện.

## Cấu hình

Chạy migration `0009_gallery_images.sql` trước khi triển khai mã mới. Migration
thêm cột `photos.archived_at` và bảng `gallery_images`, giữ các bảng và dữ liệu
đã có. Không cần thêm biến môi trường hoặc bucket lưu ảnh. Upload dùng UUID
ổn định để tránh tạo ảnh trùng khi thử lại sau khi phản hồi bị mất. Mỗi lần
ghi album/ảnh nằm trong cùng giao dịch với nhật ký kiểm toán.

## Kiểm tra ngày 18/10/2026

- Toàn bộ 198 kiểm thử ứng dụng, 93 kiểm thử schema, ESLint, TypeScript và
  bản build production đạt.
- Trình duyệt local đạt 181 bước kiểm tra, gồm 40 bố cục trên ba giao diện
  và các chiều rộng 360/390/768/1365 px, không tràn ngang hoặc lỗi JavaScript.
- Tải hai ảnh thật qua nút chọn tệp, xem ảnh bằng tài khoản học sinh thử,
  kiểm tra quyền lớp/phiên hết hiệu lực/đổi mật khẩu, công khai/riêng tư,
  ẩn ảnh, lưu trữ album và quản lý ảnh ở trang thứ hai của album 61 ảnh.
- Tài khoản học sinh thử đi qua đăng nhập Credentials thật; phiên giáo viên
  là JWT local có chữ ký hợp lệ. Không thực hiện đăng nhập Google mới trong
  lượt kiểm thử này.
- Đã dọn toàn bộ fixture local, khôi phục đúng giao diện và revision ban đầu;
  các tag backup giao diện và tệp APK không đổi.
- Migration 0009 đã áp dụng trên Cloudflare Production, giữ nguyên 42 học
  sinh, 42 tài khoản, 7 bài viết, 5 nhắc việc và lịch sử trò chuyện hiện có;
  kiểm tra khóa ngoại không có lỗi. Không đưa album/ảnh thử lên Production.
