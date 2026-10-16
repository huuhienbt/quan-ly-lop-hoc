# Thời khóa biểu và lời nhắc hằng ngày

Thời khóa biểu lớp Bốn 12, Trường Tiểu học Bến Tre, năm học 2026–2027 được
nhập từ ảnh do giáo viên cung cấp, áp dụng từ 28/09/2026. Lịch có 35 khung học
thứ Hai–thứ Sáu; một khung có thể gộp hai tiết. Không đưa giờ ra chơi hoặc ra
về vào danh sách môn. Thứ Sáu không có buổi chiều. Tiết sau ra chơi buổi sáng
bắt đầu lúc 09:05. Tên môn TANN giữ nguyên theo ảnh.

Theo xác nhận của giáo viên, Lịch sử - Địa lý chiều thứ Tư học một tiết
15:25–16:00; Tiếng Anh chiều thứ Năm học hai tiết 15:25–16:35.
Thầy cô có thể điều chỉnh giờ và môn khi có lịch mới.

## Học sinh sử dụng

Sau khi đăng nhập và hoàn tất đổi mật khẩu ban đầu, mở **Góc học sinh**:

- **Hôm nay em làm gì?**: hiện các môn hôm nay, buổi và giờ học, kèm lời nhắc
  ôn lại hoặc hoạt động cần hoàn thành. Nhiều tiết cùng môn được gom vào một
  mục, vẫn liệt kê đầy đủ các giờ học.
- **Chiếc cặp ngày mai**: sách, vở và đồ dùng theo lịch của ngày học tiếp theo.
  Nếu ngày mai không có tiết, tiêu đề đổi thành **Chiếc cặp buổi học tới** và
  ghi rõ ngày cần chuẩn bị, chẳng hạn thứ Sáu chuẩn bị cho thứ Hai.
- Đánh dấu khi đã làm hoặc đã soạn xong. Dấu chỉ đổi sau khi máy chủ xác nhận,
  và vẫn được giữ khi tải lại trang. Mỗi học sinh có dấu riêng. Việc chuẩn bị
  cho cùng một buổi học được giữ xuyên cuối tuần; các ngày học khác có dấu mới.

Lời nhắc theo lịch là gợi ý, không suy đoán trang sách hoặc bài tập chưa được
thầy cô giao. Những việc đọc sách, sắp xếp góc học tập và lời nhắc nhập trước
đó tiếp tục xuất hiện bên dưới. Thông báo nghỉ học thực tế của nhà trường và
lời dặn của giáo viên được ưu tiên; ứng dụng không tự suy đoán ngày nghỉ lễ.

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

Lớp chưa nhập thời khóa biểu vẫn dùng các lời nhắc cũ. Học sinh chỉ thấy lịch
của lớp mình; thời khóa biểu không được đưa vào bản tin công khai.

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
