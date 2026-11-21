# Thời khóa biểu và lời nhắc hằng ngày

Thời khóa biểu lớp Bốn 12, Trường Tiểu học Bến Tre, năm học 2026–2027 được
nhập từ ảnh do giáo viên cung cấp, áp dụng từ 28/09/2026. Lịch có 35 khung học
thứ Hai–thứ Sáu; một khung có thể gộp hai tiết. Không đưa giờ ra chơi hoặc ra
về vào danh sách môn. Thứ Sáu không có buổi chiều. Tiết sau ra chơi buổi sáng
bắt đầu lúc 09:05. Tên môn TANN giữ nguyên theo ảnh.

Theo xác nhận của giáo viên, Lịch sử - Địa lý chiều thứ Tư học một tiết
15:25–16:00; Tiếng Anh chiều thứ Năm học hai tiết 15:25–16:35.
Thầy cô có thể điều chỉnh giờ và môn khi có lịch mới.

Trang chủ và Góc học sinh hiện không hiển thị lịch tuần, việc cần làm hằng
ngày hay danh sách đồ dùng cho buổi học tới. Thời khóa biểu và các lời nhắc đã
lưu vẫn được giữ để thầy cô quản lý trong khu vực biên tập.

## Giáo viên cập nhật

1. Dùng tài khoản Google Super Admin hoặc giáo viên được phân công lớp.
2. Mở **Biên tập nội dung lớp → Thời khóa biểu**, chọn đúng lớp.
3. Chọn ngày trong tuần, thêm/bỏ khung giờ sáng hoặc chiều, chỉnh môn và giáo viên.
4. Mở **Lời nhắc ôn lại và chuẩn bị** để sửa việc cần làm và đồ dùng cho từng môn.
5. Chọn **Áp dụng từ ngày** trong năm học, rồi **Lưu thời khóa biểu**.

Mỗi lần lưu tạo một phiên bản đầy đủ cho cả tuần, thay thế lịch cũ kể từ ngày
áp dụng. Phiên bản mới có ngày áp dụng trong tương lai chưa ảnh hưởng lịch hiện
hành. Các phiên bản cũ và dấu hoàn thành được giữ lại; lịch vừa thay đổi có bộ
dấu riêng. Một cửa sổ đang giữ phiên bản cũ phải tải lại trước khi ghi tiếp.

Thao tác chỉnh thời khóa biểu không thay đổi các bài đã đăng trong bản tin.

## Nhập lịch và triển khai

Migration `0007_class_timetable.sql` thêm bốn bảng lịch, phiên bản, khung học
và dấu hoàn thành, với khóa ngoại cùng lớp. Dữ liệu lịch nằm trên D1, không
phụ thuộc thiết bị. Không cần biến môi trường hoặc dịch vụ mới.

Dữ liệu ảnh đã chép tại `scripts/data/bon-12-timetable.mjs`. Script nhập kiểm
tra đúng trường/lớp/năm học và tài khoản Super Admin; mặc định chỉ xem trước:

```bash
# Chạy tại repository root.
node --conditions=react-server --use-env-proxy scripts/import-class-timetable.mjs --remote
node --conditions=react-server --use-env-proxy scripts/import-class-timetable.mjs --remote --apply
```

Chỉ ghi sau khi migration đã được áp dụng. Chạy lại với cùng dữ liệu không tạo
bản trùng; nếu giáo viên đã đổi lịch, script dừng để giữ nội dung đó. `--replace`
chỉ dùng khi chủ động thay thế lịch đang có. Không tự nhập lịch Production trong
setup hoặc startup.

Ngày và giờ hiển thị theo `Asia/Ho_Chi_Minh`. Lịch nằm trong giới hạn năm học;
ứng dụng tìm buổi học kế tiếp trong 14 ngày, không đoán lịch sau khi năm học kết
thúc. Việc lưu lịch và nhật ký cùng một transaction; mọi đọc/ghi kiểm tra quyền
hiện hành, trạng thái trường/lớp và phiên đăng nhập học sinh.
