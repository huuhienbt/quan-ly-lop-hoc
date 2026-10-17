# Bảng tin và góc học sinh

Phần này gồm bản tin của lớp, góc riêng cho học sinh và chỗ cập nhật cho thầy cô.
Chưa bổ sung sao, cảm xúc,
hòm thư, album hay tiện ích của các giai đoạn sau.

## Trang chủ dễ theo dõi

Cả ba giao diện có lời chào và tranh thu gọn, tiếp theo là sáu lối vào:
**Việc hôm nay**, **Chuẩn bị buổi tới**, **Trò chuyện**, **Tin lớp**,
**Lịch tuần** và **Trò chơi học tập**. Học sinh đã đăng nhập được đưa tới đúng
mục trong góc của mình; học sinh chưa đăng nhập được đưa tới trang đăng nhập.
Thông báo, bản tin và lịch lớp nằm bên dưới; phần đăng nhập thầy cô ở cuối.

Đã bỏ khối **Ba mẹ cùng con khám phá / Ba mẹ đồng hành**, các liên kết tới khối
này và chủ đề ba mẹ trong danh sách bài ở trang chủ. Bài thuộc `PARENT_GUIDE`
vẫn được lưu, biên tập và xem qua đường dẫn bài theo quyền hiện hành; thay đổi
trang chủ không xóa hay lưu trữ bài. Tên và lựa chọn của ba giao diện được giữ.

## Cập nhật nội dung

1. Đăng nhập Google bằng tài khoản quản trị hoặc giáo viên đã được phân công.
2. Vào `/teacher` bằng nút **Cập nhật bản tin lớp** trên trang chủ. Super Admin
   cũng có đường dẫn **Biên tập nội dung lớp** trong `/admin`; có thể dùng cùng
   tài khoản để quản lý trường và biên tập lớp Bốn 12.
3. Chọn đúng lớp trước khi tạo bài, lịch hoặc việc cần làm.

Bài viết có tiêu đề, nội dung, loại bài, chủ đề, ảnh bìa tùy chọn và trạng
thái. Bản nháp chỉ dành cho người biên tập. Chọn **Công khai** và **Xuất bản**
để xuất hiện trên trang chủ (trừ chủ đề dành cho ba mẹ); chọn **Trong lớp** để chỉ học sinh đã liên kết xem.
Việc công khai một bài chỉ áp dụng cho bài đó; hồ sơ, số điện thoại và checklist
của học sinh vẫn nằm trong khu vực đăng nhập.

Thầy cô có thể ghim thông báo, chỉnh sửa bài và lưu trữ nội dung không còn dùng.
Lưu trữ ẩn nội dung khỏi người đọc nhưng giữ lịch sử trong cơ sở dữ liệu.
Góc điều tử tế ưu tiên bài đăng trong tuần; nếu chưa có bài mới, lời nhắn gần
nhất tiếp tục hiển thị cho đến khi thầy cô thay thế hoặc lưu trữ.

## Chọn ảnh từ thiết bị

Trong biểu mẫu tạo hoặc chỉnh sửa bài viết, chọn **Chọn ảnh từ thiết bị**,
chọn ảnh rồi kiểm tra phần xem trước. Bấm **Lưu bài viết** hoặc **Lưu thay đổi
bài viết** để lưu cả nội dung và ảnh. Có thể chọn ảnh khác, **Bỏ ảnh**, hoặc
tiếp tục dùng mục **Hoặc dán liên kết ảnh** với đường dẫn HTTPS.

Nhận JPG, PNG hoặc WebP tối đa 20 MB; ảnh HEIC cần đổi sang JPG trước.
Trình duyệt thu gọn ảnh trước khi gửi. Nếu tệp mới lỗi, lựa chọn ảnh trước đó
được giữ lại. Ảnh chưa được lưu cho đến khi bài viết lưu thành công.

Ảnh đã tải lên có cùng phạm vi xem với bài viết: bài công khai đã xuất bản cho
mọi người xem, bài trong lớp chỉ cho học sinh liên kết và thầy cô có quyền.
Ảnh cũng xuất hiện khi mở nội dung trong góc học sinh. Chuyển bài về riêng tư,
bản nháp hoặc lưu trữ sẽ chặn lượt tải ảnh công khai tiếp theo.

Triển khai dùng migration `0006_post_images.sql`, không cần khóa hay dịch vụ
lưu ảnh mới. Server kiểm tra lại dữ liệu ảnh, loại EXIF/GPS và lưu WebP tối đa
256 KiB, cạnh tối đa 1600 px trong D1. Bài viết, ảnh và nhật ký được ghi trong
cùng giao dịch; lỗi ghi không để lại ảnh mồ côi. API `/api/post-images/[id]`
kiểm tra quyền hiện hành và trả `private, no-store`; các thẻ `Image` dùng
`unoptimized` để gửi cookie trực tiếp tới API. Không đặt ảnh riêng qua bộ tối ưu
ảnh công khai. Ảnh cũ đã thay được giữ trong D1 nhưng không còn công khai khi
không có bài công khai nào tham chiếu; chưa có album hoặc công cụ dọn ảnh cũ.

## Lịch và nhắc việc

Thời khóa biểu của lớp tạo thêm lời nhắc theo môn trong **Hôm nay em làm gì?**
và danh sách sách vở trong **Chiếc cặp ngày mai / buổi học tới**. Xem
[cách sử dụng và cập nhật thời khóa biểu](thoi-khoa-bieu.md). Các công việc nhập
tay bên dưới được giữ riêng, không bị ghi đè khi đổi lịch.

- **Sự kiện:** nhập ngày thật, giờ tùy chọn và phạm vi công khai/trong lớp. Bản
  nháp không hiển thị với người đọc. Lịch tuần lấy từ thứ Hai đến Chủ nhật theo
  giờ Việt Nam.
- **Việc cần làm:** học sinh thấy những việc của hôm nay.
- **Chuẩn bị ngày mai:** học sinh thấy những việc có ngày mục tiêu là ngày mai.
- Để trống ngày của công việc để lặp lại hằng ngày. Mỗi học sinh có dấu hoàn
  thành riêng theo ngày thực hiện, kể cả việc chuẩn bị cho ngày mai. Sang ngày
  mới, công việc lặp lại bắt đầu với trạng thái chưa đánh dấu; lịch sử được giữ.

## Trò chuyện

Góc học sinh còn có **Trò chuyện**: phòng chung với lớp và kênh riêng với thầy
cô. Giáo viên trả lời tại `/teacher#tro-chuyen`. Xem
[hướng dẫn trò chuyện trong lớp](tro-chuyen-lop.md).

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
