# Lớp học hạnh phúc

Nền tảng cho lớp Bốn 12, Trường Tiểu học Bến Tre; mở rộng cho toàn trường.

Đã viết phần ứng dụng **Giai đoạn 1**: Next.js App Router, Tailwind CSS,
NextAuth Google/JWT, phân quyền kiểm tra tại server và dashboard `/admin`.
Dashboard duyệt Teacher, tạo năm học/lớp, phân công GVCN và tạm khóa tài khoản.
Schema ban đầu bao quát cả bốn giai đoạn. Theo yêu cầu tiếp theo của chủ dự án,
đã bổ sung tài khoản học sinh đăng nhập bằng số điện thoại, đổi mật khẩu lần đầu,
bảng tin công khai, góc học sinh và màn hình biên tập của giáo viên.
Các tính năng sao, cảm xúc, hòm thư và tiện ích trợ giảng chưa được triển khai.

- Tên miền đã được Vercel xác nhận Valid Configuration, gắn Production của project `web`: `https://e-class-vinhlong.vercel.app`.
- Super Admin đầu tiên: `huuhienbte@gmail.com`, sau đăng nhập Google đã xác minh.
- D1 production: `quan-ly-lop-hoc`, ID `bed7e67a-c194-4e57-954b-70ce613ff948`; schema gốc có 24 bảng, migration `0002_student_accounts.sql` thêm hai bảng đăng nhập học sinh, `0003_class_content.sql` thêm lịch lớp và checklist, `0004_site_theme.sql` lưu lựa chọn giao diện toàn website. Giữ nguyên toàn bộ hồ sơ đã nhập.
- Gateway đã triển khai: `https://lophocthongminh-d1.huuhienbte.workers.dev/query`; Secret `D1_GATEWAY_TOKEN` đã được đặt. Health check và truy vấn trường Bến Tre có xác thực trên production đều trả HTTP 200.
- Google OAuth Production đã được kiểm tra; tài khoản Super Admin đã đăng nhập thành công. Vercel dùng cùng token gateway đã đặt trong Worker.

## Đăng nhập học sinh

- `/dang-nhap`: lối đăng nhập chung; học sinh dùng số điện thoại và mật khẩu, giáo viên và quản trị viên chọn **Giáo viên** để đăng nhập Google. Học sinh trở lại đúng mục đã chọn trên trang chủ.
- `/hoc-sinh/doi-mat-khau`: bắt buộc đổi mật khẩu ban đầu; đổi xong phải đăng nhập lại.
- Bấm tên tài khoản ở đầu trang để xem hồ sơ liên kết, đổi mật khẩu hoặc đăng xuất tại `/hoc-sinh/thong-tin`.

Mật khẩu được băm scrypt với salt riêng. Tài khoản học sinh tách khỏi tài khoản
Google của giáo viên/quản trị viên. Đăng nhập học sinh không cần cấu hình Google,
nhưng cần gateway, `NEXTAUTH_SECRET` và `NEXTAUTH_URL` hợp lệ.
Xem [hướng dẫn đăng nhập học sinh](docs/dang-nhap-hoc-sinh.md).

## Bảng tin và nội dung lớp

- `/`: một menu chung **Tin lớp**, **Học tập**, **Đố vui**, **Trò chuyện**. Giữ banner khi đổi mục; tải nội dung của mục đang mở. Khách xem tin công khai và đố vui; học sinh đăng nhập xem tin nội bộ, bài học và trò chuyện của lớp được liên kết.
- `/ban-tin/[id]`: đọc bài đã xuất bản công khai; bài riêng tư/bản nháp không có trang công khai.
- `/teacher`: giáo viên và Super Admin có các mục **Bài viết**, **Học tập** và **Trò chuyện**. Chọn **Thêm bài viết mới** để soạn bài và thêm ảnh bìa.
- Đường dẫn `/hoc-sinh` và lối tắt cũ của ứng dụng sẽ mở mục tương ứng trên trang chủ.

Dữ liệu lịch, nhắc việc và dấu hoàn thành đã lưu vẫn nằm trong D1. Có thể dùng `scripts/seed-class-content.mjs`
để thêm nội dung khởi đầu cho một lớp một cách chủ động; script giữ nguyên bài/việc
đã có, không tạo sự kiện hoặc ngày hẹn giả. Không chạy script này tự động khi setup.
Xem [hướng dẫn bản tin và nội dung lớp](docs/ban-tin-va-goc-hoc-sinh.md).

Biểu mẫu bài viết có **Chọn ảnh từ thiết bị**, xem trước, thay/bỏ ảnh và tùy
chọn dán liên kết HTTPS. Migration `0006_post_images.sql` lưu ảnh WebP đã tối
ưu cùng bài trong D1; ảnh riêng được kiểm tra quyền trước mỗi lượt tải. Nhận
JPG/PNG/WebP tối đa 20 MB, không cần thêm biến môi trường hay dịch vụ lưu ảnh.

Mục **Trò chuyện** trong Góc học sinh có phòng chung của lớp và kênh nhắn
riêng với thầy cô. Giáo viên trả lời, chọn học sinh và ẩn tin nhắn tại
`/teacher?tab=tro-chuyen#tro-chuyen`; Super Admin dùng cùng tài khoản quản trị hiện có.
Xem [hướng dẫn trò chuyện trong lớp](docs/tro-chuyen-lop.md).

Menu trang chủ có bốn mục: **Tin lớp**, **Học tập**, **Đố vui** và **Trò chuyện**.
Học sinh chọn **Học tập** để mở bài đọc trong lớp. **Học tập** và **Trò chuyện**
yêu cầu đăng nhập; **Tin lớp** và **Đố vui** mở trực tiếp.
Giáo viên đăng nội dung có định dạng, hình ảnh, PDF, video và âm thanh từ
[trang Học tập](docs/bai-hoc.md). Triển khai cần migration D1 `0010_learning_posts.sql`.

Đầu trang hiện chỉ có logo và nút **Đăng nhập/Tài khoản**; bỏ menu ngang,
khối ngày/“Lời nhắn mới” và thu nhỏ banner thêm khoảng 20% trên cả ba giao diện.
Các tag backup giao diện được giữ nguyên.

## Thư viện ảnh của lớp

- `/thu-vien-anh`: xem album công khai và album riêng của lớp sau đăng nhập.
- `/thu-vien-anh/[id]`: xem ảnh theo album, 60 ảnh mỗi trang.
- Mục thư viện ảnh đã được gỡ khỏi trang chủ và trang biên tập; album đã lưu vẫn có đường dẫn riêng và giữ quyền xem cũ.

Album mới mặc định **Trong lớp**. Chọn **Công khai** để hiện trên trang chủ
và cho phép người chưa đăng nhập xem. Ảnh riêng luôn được kiểm tra quyền tại
server; đổi quyền hoặc ẩn ảnh có hiệu lực ngay ở URL ảnh. Migration
`0009_gallery_images.sql` lưu WebP đã tối ưu, không cần dịch vụ/khóa mới.
Xem [hướng dẫn thư viện ảnh](docs/thu-vien-anh.md).

## Ứng dụng Android

Mở [trang cài ứng dụng](https://e-class-vinhlong.vercel.app/cai-ung-dung) trên
điện thoại để tải APK. Ứng dụng dành cho Android 8 trở lên, dùng Chrome hoặc
trình duyệt tương thích được cập nhật và cần Internet. Tài khoản, dữ liệu và
các nội dung mới của lớp dùng chung với website.

Mã nguồn Android nằm trong `android/`; APK đã ký được phục vụ tại
`web/public/downloads/`, kèm mã SHA-256. Website có manifest và Digital Asset
Links xác minh đúng chữ ký ứng dụng. Xem [hướng dẫn Android](android/README.md)
để dựng lại và giữ khóa ký cho các bản cập nhật. Khóa riêng không nằm trong Git
hoặc thư mục public.

## Giao diện

Mục **Đố vui** ở ngay trang chủ (`/?muc=do-vui`) có trò [Đố vui ca dao, tục ngữ Việt Nam](docs/tro-choi-ca-dao-tuc-ngu.md):
30 câu hỏi, 5 câu mỗi lượt, có đáp án và lời giải. Kết quả luyện tập không ghi vào
điểm hay sao của tài khoản.

Ba giao diện có thể chuyển qua lại tại `/admin?muc=giao-dien#cai-dat`: **Giao diện 1 –
Lớp học vui nhộn**, **Giao diện 2 – Thế giới khám phá** và **Giao diện 3 –
Lớp học khám phá hạnh phúc**. Lựa chọn lưu trên D1,
chỉ Super Admin được đổi và không cần redeploy. Bản nguồn Giao diện 1 còn được
giữ với tag GitHub `giao-dien-1`. Migration `0005_harmony_theme.sql` thêm lựa chọn
thứ ba và giữ nguyên cấu hình hiện có. Xem [cách đổi và giữ ba giao diện](docs/giao-dien.md).

Phong cách hoạt hình 3D với xanh dương, vàng và hồng, thẻ pastel bo tròn,
phông Nunito hỗ trợ tiếng Việt. Ảnh minh họa và phông chữ được lưu cùng mã
nguồn; không cần thêm dịch vụ ảnh hoặc Google Fonts khi chạy ứng dụng.
Xem [cấu trúc giao diện và tài nguyên](docs/giao-dien-hoat-hinh.md).

## Chạy local

Dùng Node.js 24. Từ checkout hiện có, không tạo repository/worktree mới:

```bash
cd /workspace/quan-ly-lop-hoc/web
npm ci
npm run setup:local
npm run db:migrate:local
npm run db:dev
```

Giữ terminal trên để chạy D1 gateway. Ở terminal thứ hai:

```bash
cd /workspace/quan-ly-lop-hoc/web
npm run dev
```

Khi cả hai tiến trình đã sẵn sàng, `npm run check:dev` kiểm tra truy vấn D1
và nội dung trang chủ mà không in các khóa cấu hình.

`setup:local` sinh khóa local ngẫu nhiên vào file được ignore, giữ nguyên khóa
đã có và không tạo tài khoản/đường đăng nhập giả. Nếu chưa cấu hình Google,
trang chủ hiện trạng thái đăng nhập đang được thiết lập.

## Kiểm tra

```bash
cd /workspace/quan-ly-lop-hoc/web
npm run test
npm run lint
npm run typecheck
npm run build

cd ..
python3 -m unittest discover -s database/tests -v
```

## Tài liệu và cấu trúc

- [Hướng dẫn triển khai từng bước](docs/giai-doan-1.md)
- [Kết quả kiểm tra và giới hạn hiện tại](docs/kiem-thu-giai-doan-1.md)
- [Toàn bộ schema SQL](database/migrations/0001_initial.sql)
- [Mẫu biến local](.env.example) / [mẫu production](.env.production.example)
- `web/`: ứng dụng Next.js; Vercel **Root Directory = `web`**.
- `tools/d1-gateway.mjs`: Worker server-to-server có token, dùng D1 `DB.batch()`.
- `wrangler.jsonc`: migration D1; `wrangler.gateway.jsonc`: gateway production;
  `wrangler.local.jsonc`: gateway local.
- `scripts/`: chuẩn bị local và wrapper Wrangler với thư mục ghi hợp lệ.

Vercel gọi gateway Worker có token; Worker giữ D1 binding. Các thay đổi liên
quan trong một thao tác quản trị nằm trong một transaction. Trình duyệt không
nhận token database. JWT chỉ chứa user ID; vai trò/trạng thái đọc lại từ D1.
