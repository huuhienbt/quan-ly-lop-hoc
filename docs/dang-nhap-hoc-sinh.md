# Đăng nhập học sinh bằng số điện thoại

Tính năng này được bổ sung theo yêu cầu riêng sau khi tạo lớp Bốn 12 và nhập hồ sơ
học sinh. Nó gồm đăng nhập, đổi mật khẩu và xem hồ sơ; không triển khai thêm bảng
tin, ngân hàng sao, cảm xúc hoặc các tiện ích của giai đoạn sau.

## Dành cho học sinh và phụ huynh

1. Mở `/dang-nhap`, hoặc chọn **Đăng nhập** trên trang chủ rồi chọn **Học sinh**.
2. Nhập số điện thoại đã đăng ký với lớp và mật khẩu ban đầu do giáo viên cung cấp.
   Có thể nhập số bắt đầu bằng `0` hoặc `+84`; hệ thống giữ số `0` đầu khi chuẩn hóa.
3. Lần đăng nhập đầu, chọn mật khẩu riêng từ 8 đến 128 ký tự, khác mật khẩu được
   cấp và khác mật khẩu hiện tại. Nhập lại để xác nhận.
4. Đăng nhập lại bằng mật khẩu mới. Trang học sinh chỉ hiển thị hồ sơ được liên
   kết với tài khoản đó.

Sau năm lần nhập sai trong một khoảng 15 phút, tài khoản tạm khóa 15 phút.
Đổi mật khẩu làm hết hiệu lực các phiên cũ trên mọi thiết bị. Nếu chưa có số điện
thoại đăng ký hoặc cần trợ giúp về tài khoản, liên hệ giáo viên chủ nhiệm.

## Xem danh sách và cấp lại mật khẩu

1. Đăng nhập bằng tài khoản giáo viên, chọn lớp và mở mục **Học sinh** trên menu
   trang quản trị. Danh sách hiển thị họ tên, số điện thoại dùng để đăng nhập và
   tình trạng tài khoản. Có thể tìm theo tên hoặc số điện thoại.
2. Ở đúng dòng học sinh, bấm **Cấp lại mật khẩu**. Kiểm tra tên và số điện thoại,
   sau đó bấm **Xác nhận cấp lại**.
3. Sao chép mật khẩu tạm và gửi riêng cho phụ huynh. Mật khẩu tạm chỉ hiển thị
   trong hộp thoại kết quả; website không lưu mật khẩu dạng văn bản. Các phiên
   đăng nhập cũ bị thu hồi và người dùng phải đổi mật khẩu sau khi đăng nhập.

Mỗi số điện thoại là một tài khoản. Cấp lại ảnh hưởng đến mọi học sinh dùng
chung tài khoản đó. Giáo viên chỉ xem lớp được phân công; nếu tài khoản liên
kết với học sinh ở lớp khác đang hoạt động, chỉ quản trị viên có thể cấp lại.
Thao tác được ghi vào nhật ký, không lưu mật khẩu trong nhật ký. Chức năng sử
dụng dữ liệu đã có; không cần nhập lại danh sách hay thêm cột cơ sở dữ liệu.

## Cấu hình và dữ liệu

- Migration `0002_student_accounts.sql` bổ sung `student_accounts` và
  `student_account_students`, không sửa vai trò trong bảng `users`.
- Mỗi số điện thoại là một tài khoản. Một số gia đình có thể liên kết nhiều con;
  mỗi học sinh chỉ thuộc một tài khoản. Quyền liên kết được cấp từ dữ liệu do
  người quản lý nhập; học sinh không thể tự thêm liên kết.
- Chỉ dùng số điện thoại đã đối chiếu chính xác với hồ sơ và lớp. Không tự tạo số
  cho các học sinh thiếu thông tin. Không nhập lại hồ sơ học sinh để tạo tài khoản.
- Giữ file Excel và JSON nhập liệu ngoài Git; không đưa danh sách số điện thoại,
  mật khẩu, hash production hoặc dữ liệu học sinh vào repository.
- Không có đăng ký tài khoản học sinh công khai. Google Provider vẫn chỉ phục vụ
  luồng xét duyệt giáo viên và tài khoản quản trị.
- Không cần thêm biến bí mật ngoài cấu hình Production hiện tại. Đăng nhập học
  sinh cần gateway, `NEXTAUTH_SECRET` và `NEXTAUTH_URL` hợp lệ; không phụ thuộc vào
  các khóa Google.

## Kiểm tra thay đổi

Chạy từ `web`: `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`.
Chạy từ repository root: `python3 -m unittest discover -s database/tests -v`.
Các kiểm thử chỉ dùng cơ sở dữ liệu SQLite riêng và dữ liệu giả lập. Kiểm tra trình
duyệt cần xác nhận đăng nhập thật qua Credentials Provider, chuyển đến đổi mật khẩu,
thu hồi phiên cũ và từ chối quyền quản trị của tài khoản học sinh.
