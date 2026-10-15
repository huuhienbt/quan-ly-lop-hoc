# Bảng tin và góc học sinh

Phần này thực hiện đề xuất đã được chủ dự án chọn: bản tin chung cho gia đình,
góc riêng cho học sinh và chỗ cập nhật cho thầy cô. Chưa bổ sung sao, cảm xúc,
hòm thư, album hay tiện ích của các giai đoạn sau.

## Cập nhật nội dung

1. Đăng nhập Google bằng tài khoản quản trị hoặc giáo viên đã được phân công.
2. Vào `/teacher` bằng nút **Cập nhật bản tin lớp** trên trang chủ. Super Admin
   cũng có đường dẫn **Biên tập nội dung lớp** trong `/admin`; có thể dùng cùng
   tài khoản để quản lý trường và biên tập lớp Bốn 12.
3. Chọn đúng lớp trước khi tạo bài, lịch hoặc việc cần làm.

Bài viết có tiêu đề, nội dung, loại bài, chủ đề, ảnh bìa HTTPS tùy chọn và trạng
thái. Bản nháp chỉ dành cho người biên tập. Chọn **Công khai** và **Xuất bản**
để xuất hiện trên trang chủ; chọn **Trong lớp** để chỉ học sinh đã liên kết xem.
Việc công khai một bài chỉ áp dụng cho bài đó; hồ sơ, số điện thoại và checklist
của học sinh vẫn nằm trong khu vực đăng nhập.

Thầy cô có thể ghim thông báo, chỉnh sửa bài và lưu trữ nội dung không còn dùng.
Lưu trữ ẩn nội dung khỏi người đọc nhưng giữ lịch sử trong cơ sở dữ liệu. Ảnh bìa
dùng liên kết ảnh có sẵn; tính năng tải ảnh lên và quản lý album thuộc phần sau.
Góc điều tử tế ưu tiên bài đăng trong tuần; nếu chưa có bài mới, lời nhắn gần
nhất tiếp tục hiển thị cho đến khi thầy cô thay thế hoặc lưu trữ.

## Lịch và nhắc việc

- **Sự kiện:** nhập ngày thật, giờ tùy chọn và phạm vi công khai/trong lớp. Bản
  nháp không hiển thị với người đọc. Lịch tuần lấy từ thứ Hai đến Chủ nhật theo
  giờ Việt Nam.
- **Việc cần làm:** học sinh thấy những việc của hôm nay.
- **Chuẩn bị ngày mai:** học sinh thấy những việc có ngày mục tiêu là ngày mai.
- Để trống ngày của công việc để lặp lại hằng ngày. Mỗi học sinh có dấu hoàn
  thành riêng theo ngày thực hiện, kể cả việc chuẩn bị cho ngày mai. Sang ngày
  mới, công việc lặp lại bắt đầu với trạng thái chưa đánh dấu; lịch sử được giữ.

## Nội dung khởi đầu

`scripts/seed-class-content.mjs` chứa năm bài công khai về lời chào, niềm vui
nhỏ, lắng nghe và đồng hành cùng con; hai bài khám phá riêng của lớp; năm thói
quen/việc chuẩn bị lặp lại. Không tạo sự kiện có ngày hẹn thay cho thầy cô.

Script mặc định chỉ kiểm tra và báo số lượng dự kiến. Chỉ chạy khi tác vụ cho
phép thêm nội dung. Ví dụ từ repository root:

```bash
node --use-env-proxy scripts/seed-class-content.mjs --remote
node --use-env-proxy scripts/seed-class-content.mjs --remote --apply
```

Có thể chỉ định `--class=<slug>` và `--actor=<email-quan-tri>`. Bỏ `--remote`
để dùng gateway local đã được `setup:local` chuẩn bị. Script xác minh lớp và
tài khoản, dùng một transaction, có ID ổn định và không ghi đè bài đã biên tập.
Không đưa dữ liệu học sinh, khóa gateway hoặc mật khẩu vào file nội dung.

## Kiểm tra

Trong `web`: `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`.
Tại repository root: `python3 -m unittest discover -s database/tests -v`.
Kiểm thử chức năng cần xác nhận bài công khai xuất hiện ở trang chủ, bài riêng
không truy cập được qua URL công khai, giáo viên chỉ sửa lớp được giao và
checkbox học sinh được lưu sau khi tải lại trang.
