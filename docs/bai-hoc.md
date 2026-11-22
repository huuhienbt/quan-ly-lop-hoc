# Đăng bài trong mục Học tập

1. Giáo viên vào **Học tập → Thêm bài học** hoặc **Bài viết → Thêm bài viết**,
   rồi chọn loại bài, điền tiêu đề và **Ngày đăng**.
2. Gõ trực tiếp trong khung **Nội dung**. Bôi đen chữ rồi chọn **Đậm**,
   **Nghiêng**, **Gạch chân** hoặc **Màu chữ**. Dùng các nút căn lề cho đoạn
   đang soạn, hoặc chèn **Ô trống**, **Phân số** và **Ký hiệu**.
3. Đặt con trỏ tại vị trí cần chèn rồi chọn **Link**, **Ảnh**, **Video**,
   **Nghe** hoặc **PDF**. Mở **Sửa** trên tệp để thay đường dẫn hay tệp gốc.
   Dùng mũi tên để chuyển tệp lên hoặc xuống.
4. Bấm **Lưu nháp** để soạn tiếp hoặc **Đăng lên hệ thống**. Khi mở
   **Chỉnh sửa bài viết** hoặc **Sửa bài học**, có thể đổi **Ngày đăng**
   về hôm nay hoặc một ngày trước đó. Bài đã đăng hiển thị và sắp xếp theo
   ngày đã chọn; bài ghim vẫn nằm trên cùng. Ô ngày không hẹn giờ xuất bản.

Trong **Bài viết**, có thể chọn chuyên mục, ảnh bìa, ghim bài và phạm vi
người xem. Khi chọn **Công khai trên trang chủ**, người ngoài lớp có thể xem
nội dung và tệp chèn trong bài đã đăng.

Ảnh JPG, PNG, WebP và PDF tải từ máy tối đa 3 MB mỗi tệp. Có thể dùng
liên kết HTTPS để chèn ảnh hoặc PDF. Ảnh có các mức 25%, 40%, 60%, 80% và
100% chiều rộng; dùng **Cỡ ảnh** trên thanh công cụ hoặc trong phần chèn
ảnh. Web tự giữ tỷ lệ ảnh gốc. Với PDF, học sinh có thể xem
trong bài hoặc mở ở tab khác nếu trình duyệt trên điện thoại không hỗ trợ
xem nhúng.

Dùng liên kết YouTube hoặc liên kết chia sẻ tệp Google Drive cho video và âm
thanh; dùng đường dẫn tới tệp công khai trên GitHub (MP4, WebM, MP3, v.v.).
YouTube phát qua trình phát video; trang không tách MP3. Học sinh vẫn cần
quyền xem trên nền tảng gốc. Nếu nguồn chặn nhúng, chọn **Mở nguồn**.
Không dùng liên kết công khai cho tài liệu chứa thông tin riêng của học sinh.

Migration `0010_learning_posts.sql` bổ sung bài học và kho tệp trong D1.
Migration `0011_bulletin_composer.sql` bổ sung nội dung định dạng cho bảng tin
và ngày đăng có thể chỉnh. Bài học và tệp học tập chỉ hiển thị theo quyền của lớp.
