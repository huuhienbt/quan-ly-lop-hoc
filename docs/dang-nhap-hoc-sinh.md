# Đăng nhập học sinh bằng số điện thoại

Tính năng này được bổ sung theo yêu cầu riêng sau khi tạo lớp Bốn 12 và nhập hồ sơ
học sinh. Nó gồm đăng nhập, đổi mật khẩu và xem hồ sơ; không triển khai thêm bảng
tin, ngân hàng sao, cảm xúc hoặc các tiện ích của giai đoạn sau.

## Dành cho học sinh và phụ huynh

1. Mở `/dang-nhap`, hoặc chọn **Đăng nhập** trên trang chủ rồi chọn **Học sinh**.
2. Nhập số điện thoại đã đăng ký với lớp và mật khẩu ban đầu do giáo viên cung cấp.
   Có thể nhập số bắt đầu bằng `0` hoặc `+84`; hệ thống giữ số `0` đầu khi chuẩn hóa.
3. Lần đăng nhập đầu, chọn mật khẩu riêng từ 8 đến 128 ký tự, khác mật khẩu hiện
   tại và tránh các mật khẩu dễ đoán. Em có thể dùng một cụm từ dễ nhớ, không
   cần chữ hoa, chữ số hay ký tự đặc biệt. Nhập lại để xác nhận.
4. Đăng nhập lại bằng mật khẩu mới. Trang học sinh chỉ hiển thị hồ sơ được liên
   kết với tài khoản đó.

Sau năm lần nhập sai trong một khoảng 15 phút, tài khoản tạm khóa 15 phút.
Đổi mật khẩu làm hết hiệu lực các phiên cũ trên mọi thiết bị. Nếu chưa có số điện
thoại đăng ký hoặc cần trợ giúp về tài khoản, liên hệ giáo viên chủ nhiệm.

## Xem danh sách và quản lý mật khẩu

1. Đăng nhập bằng tài khoản giáo viên, chọn lớp và mở mục **Học sinh** trên menu
   trang quản trị. Danh sách hiển thị họ tên, số điện thoại dùng để đăng nhập và
   tình trạng tài khoản. Có thể tìm theo tên hoặc số điện thoại.
2. Ở đúng dòng học sinh, bấm **Cấp lại mật khẩu** rồi **Xác nhận cấp lại** để
   hệ thống tạo mã ngẫu nhiên. Để dùng mã do thầy cô chọn, bấm **Đặt mật khẩu**,
   kiểm tra tên và số điện thoại, nhập từ 8 đến 128 ký tự rồi bấm **Lưu mật khẩu**.
   Có thể dùng một cụm từ dễ nhớ. Tránh ngày sinh, số điện thoại, mật khẩu
   dễ đoán và mật khẩu hiện tại.
3. Trong **Phiếu gửi phụ huynh**, bấm **Xuất phiếu** để tải ảnh PNG cho đúng
   số điện thoại, hoặc **Sao chép mã**. Tải phiếu trước khi bấm **Xong** và gửi
   riêng cho từng gia đình. Phiếu có tên học sinh, số điện thoại đăng nhập,
   mật khẩu tạm, giờ hết hạn và hướng dẫn đổi mật khẩu.

Mật khẩu tạm có hiệu lực 24 giờ. Khi cấp lại hoặc đặt mật khẩu,
mật khẩu và các phiên cũ hết hiệu lực. Học sinh phải đổi mật khẩu khi đăng nhập.
Website không lưu mật khẩu dạng văn bản và không thể tải lại phiếu từ
danh sách sau khi đã đóng hộp thoại kết quả.

Mỗi số điện thoại là một tài khoản. Cấp lại hoặc đặt mã áp dụng cho mọi học sinh dùng
chung tài khoản đó. Giáo viên chỉ xem lớp được phân công; nếu tài khoản liên
kết với học sinh ở lớp khác đang hoạt động, chỉ quản trị viên có thể thao tác.
Thao tác được ghi vào nhật ký, không lưu mật khẩu trong nhật ký. Chức năng sử
dụng danh sách học sinh và tài khoản hiện có.

### Cấp lại hàng loạt

Trong **Học sinh**, bấm **Cấp lại hàng loạt** cạnh ô tìm kiếm, chọn các
tài khoản hoặc bấm **Chọn tất cả**, rồi kiểm tra số lượng trước khi xác nhận. Mỗi số điện thoại
được cấp một mật khẩu tạm ngẫu nhiên gồm đúng 8 chữ số. Anh chị em dùng chung
số điện thoại xuất hiện trên một dòng. Tài khoản không có quyền cấp lại hoặc
đang tạm ngừng không xuất hiện trong danh sách chọn.

Tải từng phiếu hoặc sao chép từng mã và gửi riêng cho phụ huynh. Khi nhập
mật khẩu tạm, học sinh nhập đủ 8 chữ số, kể cả số 0 ở đầu nếu có.
Khi thành công, mật khẩu cũ và phiên đăng nhập trước đó của các tài khoản đã
chọn hết hiệu lực. Nếu một tài khoản đã thay đổi sau khi mở hộp thoại, hệ thống
yêu cầu chọn lại và không cấp mật khẩu nào trong lượt đó. Mỗi lượt tối đa 60
tài khoản.

## Cấu hình và dữ liệu

- Migration `0002_student_accounts.sql` bổ sung `student_accounts` và
  `student_account_students`, không sửa vai trò trong bảng `users`.
- Chạy migration `0012_student_temporary_password_expiry.sql` trước khi triển
  khai mã sử dụng cột `student_accounts.temporary_password_expires_at`. Cột này
  mặc định rỗng nên các mật khẩu đã cấp vẫn dùng như trước. Cấp lại hoặc đặt mã tạm
  đặt hạn dùng; khi học sinh đổi mật khẩu, hạn dùng được xóa. Không cần nhập
  lại danh sách.
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

## Chỉnh sửa thông tin và ảnh đại diện

Học sinh đăng nhập, bấm tên tài khoản ở đầu trang, chọn **Chỉnh sửa thông tin**.
Có thể đổi ngày sinh, giới tính và chọn ảnh JPG, PNG hoặc WebP
từ thiết bị, tối đa 2 MB. Ảnh được thu nhỏ trước khi gửi; có thể thay hoặc xóa
ảnh. Bấm **Lưu thông tin** để lưu. Họ tên học sinh không thể tự thay đổi;
mã học sinh và lớp cũng do giáo viên quản lý. Ảnh đại diện tự cập nhật trong
hồ sơ và tin nhắn của lớp. Chỉ học sinh cùng lớp và giáo viên được phân quyền
có thể xem ảnh, không công khai trên trang chủ.
Nút **Đổi mật khẩu** nằm cùng hàng với **Chỉnh sửa thông tin**.
