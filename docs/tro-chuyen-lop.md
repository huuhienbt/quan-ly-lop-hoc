# Trò chuyện trong lớp

Mỗi lớp có một phòng **Cả lớp** và một cuộc trò chuyện riêng giữa từng học
sinh với thầy cô phụ trách. Dùng tài khoản hiện có, không cần đăng ký thêm.

## Học sinh

1. Đăng nhập tại `/hoc-sinh/dang-nhap`; hoàn tất đổi mật khẩu lần đầu nếu được yêu cầu.
2. Trong Góc học sinh, chọn **Trò chuyện** ở thanh điều hướng của lớp.
3. Chọn **Cả lớp** để trao đổi cùng thầy cô và các bạn trong lớp.
4. Chọn **Nhắn riêng với thầy cô** khi muốn hỏi hoặc chia sẻ riêng.
5. Viết tin nhắn rồi bấm **Gửi**. Chờ xác nhận gửi thành công.

Tin nhắn mới tự cập nhật khi đang mở khung trò chuyện. Có thể dùng nút làm
mới để kiểm tra ngay. Nội dung đang soạn được giữ khi đổi phòng hoặc khi gửi
chưa thành công. Lịch sử đã gửi được lưu trên D1 và vẫn còn khi đăng nhập lại.

Phòng chung chỉ dành cho thành viên của lớp. Các bạn khác không xem được
cuộc trò chuyện riêng của em với thầy cô. Khi một tài khoản liên kết nhiều
học sinh, hãy mở đúng không gian học sinh trước khi nhắn; mỗi em có kênh riêng.

## Thầy cô và quản trị viên

1. Đăng nhập bằng tài khoản Google đã được duyệt hoặc tài khoản Super Admin.
2. Mở **Biên tập nội dung lớp → Trò chuyện**, hoặc nút **Trò chuyện với lớp**
   trong Không gian quản trị.
3. Chọn lớp cần trao đổi. Phòng **Cả lớp** dùng cho thông báo và hỏi đáp chung.
4. Chọn một học sinh để đọc và trả lời tin nhắn riêng của em đó.
5. Thầy cô có thể **Ẩn tin nhắn**. Người đọc thấy thông báo tin đã ẩn thay cho
   nội dung; lịch sử thao tác được giữ để quản lý lớp.

Giáo viên chỉ truy cập lớp đang được phân công. Super Admin có thể hỗ trợ
quản lý các lớp. Kênh riêng dành cho học sinh đó và thầy cô có quyền với lớp;
không có nhắn riêng giữa các học sinh.

## Phạm vi và vận hành

- Tin nhắn dạng văn bản, tối đa 2.000 ký tự; chưa có gửi ảnh, tệp, gọi thoại
  hoặc thông báo đẩy khi đã đóng website.
- Nội dung và tên người gửi lấy từ tài khoản đã xác thực. Không hiển thị số
  điện thoại hoặc email trong khung chat. Nội dung được hiển thị như văn bản,
  không thực thi HTML do người dùng nhập.
- Máy chủ giới hạn gửi liên tiếp để tránh gửi dồn. Gửi lại cùng một tin sau
  lỗi kết nối không tạo bản trùng; chỉ soạn tin tiếp theo khi đã xác nhận.
- Trò chuyện hoạt động trong thời gian năm học của lớp. Mọi lần đọc và ghi
  đều kiểm tra quyền hiện hành, lớp còn hoạt động, liên kết học sinh và
  phiên đăng nhập. Tài khoản học sinh chưa đổi mật khẩu ban
  đầu, bị khóa hoặc đã thu hồi phiên không được truy cập tin nhắn.
- API riêng trả `private, no-store`; tin nhắn không xuất hiện trong bản tin
  công khai hoặc kết quả truy vấn của lớp khác.

Migration `0008_class_chat.sql` bổ sung dữ liệu trò chuyện, tách khỏi bảng
`messages` dành cho hòm thư trong schema ban đầu. Không cần dịch vụ, package
hoặc khóa bí mật mới. Chỉ áp dụng migration khi triển khai; không tạo tin
nhắn mẫu, tài khoản hoặc hội thoại thử nghiệm trên Production.

Chạy kiểm tra trong `web`: `npm run test`, `npm run lint`, `npm run typecheck`
và `npm run build`. Chạy kiểm tra schema tại repository root bằng
`python3 -m unittest discover -s database/tests -v`. Kiểm tra trình duyệt dùng
tài khoản hư cấu trong D1 local để xác nhận tin chung, tin riêng, trả lời,
ẩn tin, giữ bản nháp và hiển thị trên điện thoại.
