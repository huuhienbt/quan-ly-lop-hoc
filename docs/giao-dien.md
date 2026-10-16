# Ba giao diện của Lớp học hạnh phúc

## Chọn giao diện

1. Đăng nhập Google bằng tài khoản Super Admin.
2. Chọn **Đổi giao diện** ở đầu trang chủ, trang biên tập hoặc trang quản trị;
   liên kết dẫn tới `/admin#giao-dien`.
3. Chọn **Giao diện 1 – Lớp học vui nhộn**, **Giao diện 2 – Thế giới khám phá**
   hoặc **Giao diện 3 – Lớp học khám phá hạnh phúc**.
4. Chọn **Áp dụng giao diện**. Sau khi lưu thành công, trang tải lại để áp dụng.

Lựa chọn được lưu trên D1 cho toàn website, dùng tiếp trên các thiết bị và lần
truy cập sau. Không cần triển khai lại Vercel để đổi qua lại. Giáo viên và học
sinh không có quyền thay đổi lựa chọn chung này.

Nếu cửa sổ khác đã đổi giao diện trước khi bạn lưu, hệ thống yêu cầu tải lại
để tránh ghi đè lựa chọn mới. Nếu kết nối lỗi, trang quản trị báo lỗi; lựa chọn
chưa được xác nhận sẽ không được thông báo là đã lưu.

## Giao diện 1 luôn được giữ lại

**Lớp học vui nhộn** dùng xanh dương, vàng, hồng, sân trường và nhân vật 3D.
CSS, phông Nunito và hai ảnh minh họa gốc vẫn được giữ trong ứng dụng. Khi chọn
lại Giao diện 1, lớp CSS của Giao diện 2 ngừng áp dụng.

Phiên bản đầy đủ trước khi thêm Giao diện 2 được lưu trên GitHub với tag
[`giao-dien-1`](https://github.com/huuhienbt/quan-ly-lop-hoc/tree/giao-dien-1),
trỏ đến commit `b196d3ac6fc6fd2ee198c36d9b61fe76a61af34b`.
Tag này là bản lưu nguồn; việc chọn lại giao diện thường ngày thực hiện ngay
trong quản trị để giữ các tính năng ứng dụng được bổ sung sau đó.

## Giao diện 2 – Thế giới khám phá

Phong cách truyện cổ tích 3D: xanh trời, xanh ngọc, trắng kem và vàng nắng.
Minh họa đảo nổi, thư viện trên cây, rồng đọc sách và hành trình khám phá được
lưu cùng mã nguồn. Trang chủ dùng các bài viết, lịch và lời nhắn thực tế đã có;
không tạo truyện, trò chơi hay nhận xét phụ huynh giả để lấp các khu vực mẫu.

Mã nguồn riêng:

- `web/src/components/discovery-home.tsx` và `web/src/app/discovery-home.css`.
- `web/src/app/discovery-portals.css`: chỉ áp dụng khi
  `html[data-site-theme="discovery"]`.
- `web/public/images/discovery-hero-3d.webp` và `discovery-stories-3d.webp`.
- `web/src/lib/site-theme.ts`: đọc lựa chọn và ghi thay đổi kèm kiểm tra quyền,
  phiên bản và nhật ký trong một giao dịch.

Đổi giao diện chỉ thay đổi cách trình bày. Hồ sơ học sinh, mật khẩu, bài viết,
lịch, dấu hoàn thành và phân quyền tiếp tục dùng dữ liệu hiện có.

Đầu trang Giao diện 2 đã được thu gọn để các lối tắt và nội dung lớp xuất hiện
sớm hơn.

### Backup Giao diện 2 đã thu nhỏ tranh

Bản đã thu gọn được lưu chính thức trên GitHub với tên
[`giao-dien-2`](https://github.com/huuhienbt/quan-ly-lop-hoc/tree/giao-dien-2).
[Tải backup Giao diện 2 dạng ZIP](https://github.com/huuhienbt/quan-ly-lop-hoc/archive/refs/tags/giao-dien-2.zip).
Tranh đầu trang cao 480–560 px trên máy tính, 525 px trên máy tính bảng và
490 px trên điện thoại. Các ảnh minh họa gốc vẫn được giữ cùng mã nguồn.

Theo yêu cầu lưu bản thu nhỏ vào đúng **Giao diện 2**, tag `giao-dien-2`
đã được cập nhật. Phiên bản trước khi thu gọn được giữ với tên riêng
[`giao-dien-2-ban-dau`](https://github.com/huuhienbt/quan-ly-lop-hoc/tree/giao-dien-2-ban-dau),
giữ đúng đối tượng tag gốc và commit `70e601f6cd2104d59c14afe9a62be6e326723872`.
Backup riêng `giao-dien-2-thu-nho` đã tạo trước đó cũng được giữ lại.
Bản backup mới chứa toàn bộ mã nguồn ở thời điểm lưu, gồm cả ba giao diện,
trò chơi và chức năng chọn ảnh từ thiết bị. Dữ liệu D1 và cấu hình bí mật
không nằm trong bản sao mã nguồn này.

Để sử dụng lại thiết kế đã thu nhỏ, chọn **Giao diện 2 – Thế giới khám phá**
trong `/admin#giao-dien`; lựa chọn này không cần khôi phục mã nguồn cũ.

## Giao diện 3 – Lớp học khám phá hạnh phúc

Kết hợp bố cục gọn, nút vàng và điểm nhấn hồng của Giao diện 1 với nền kem,
xanh ngọc và minh họa cổ tích của Giao diện 2. Lời chào và tranh đứng cạnh nhau
trên máy tính; thông báo mới, bốn lối tắt, bản tin và lịch được đưa lên trước.
Trang học sinh, giáo viên và quản trị dùng cùng bảng màu, ưu tiên nội dung rõ ràng.

Giao diện dùng mã `harmony`, có lớp CSS và thành phần trang chủ riêng để hai mẫu
cũ tiếp tục hoạt động độc lập. Migration `0005_harmony_theme.sql` mở rộng danh
sách giao diện, giữ nguyên lựa chọn hiện tại và lịch sử thay đổi. Chỉ khi quản trị
áp dụng mẫu mới thì giao diện chung của website mới thay đổi.

Chi tiết thiết kế: [Giao diện 3](giao-dien-3-de-xuat.md).
