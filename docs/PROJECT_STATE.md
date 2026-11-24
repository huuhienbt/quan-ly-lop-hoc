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
- Căn giữa thông tin học sinh; giữ họ tên theo danh sách lớp, cho chỉnh ngày
  sinh, giới tính và ảnh đại diện. Hai ô nhập cùng kích thước; Đổi mật khẩu
  cùng hàng với Chỉnh sửa thông tin. Giữ giới hạn ảnh gốc 2 MB như trước.
- Đồng bộ ảnh hiện tại vào hồ sơ và trò chuyện, chỉ trong phạm vi lớp và người
  được phép xem. Học tập dùng chung thẻ Tin lớp, mở trực tiếp bài và PDF,
  không tải trước toàn bộ tài liệu của các bài khác.
- Lưu một ảnh nhỏ trong trường có sẵn, không cần migration hoặc cấu hình
  dịch vụ lưu ảnh mới. Các kiểm thử hồ sơ và quyền đọc tin dùng dữ liệu giả lập.

### Tối ưu thời gian tải

- Đọc tin công khai song song với giao diện; đọc phiên học sinh và danh sách
  ghi danh trong một lượt D1. Khi mở tài liệu, kiểm tra quyền trong chính
  truy vấn lấy tệp.
- Dùng cùng phông Nunito nhưng dạng WOFF2 (khoảng 99 KiB thay cho 270 KiB).
  CSS thư viện ảnh chỉ được tải cùng các thành phần thư viện.
- Không cần migration, không lưu cache dữ liệu cá nhân và không thay đổi
  quyền đọc nội dung hay giao diện.
- Đo trên bản chạy thử với dữ liệu giả lập, thêm độ trễ 180 ms cho mỗi lượt
  qua D1 (trung vị 3 lần sau làm nóng): trang chủ 490 → 363 ms, Học tập
  641 → 496 ms, hồ sơ 441 → 263 ms, lấy PDF 595 → 207 ms và trò chuyện
  574 → 422 ms. Đây là số đo phản hồi ứng dụng trong mô phỏng, không phải
  tốc độ tải đầy đủ trên mạng thực tế.
