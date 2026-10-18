# Android — Lớp học hạnh phúc

Ứng dụng Android mở website `https://e-class-vinhlong.vercel.app/` bằng **Trusted Web Activity** của trình duyệt. Hỗ trợ Android 8 trở lên và cần Chrome hoặc trình duyệt tương thích được cập nhật, cùng kết nối Internet. Dữ liệu lớp, đăng nhập, thời khóa biểu và trò chuyện dùng chung với website.

Google OAuth hoạt động trong trình duyệt thực. Ứng dụng không nhúng WebView, không giữ mật khẩu hoặc khóa Cloudflare, không yêu cầu quyền danh bạ, bộ nhớ, máy ảnh hay vị trí. Khi chọn ảnh từ thiết bị, trình duyệt dùng bộ chọn tệp của Android. Nếu thiết bị chưa hỗ trợ TWA, ứng dụng mở Custom Tab có thanh địa chỉ.

Từ phiên bản **1.0.1** (`versionCode` 2), `MainActivity` hiển thị màn hình mở lớp học với trạng thái, nút **Mở bằng trình duyệt** và **Thử lại**. Nếu sau 6 giây vẫn chưa kết nối được với dịch vụ Custom Tabs, ứng dụng chuyển sang mở website bằng trình duyệt. Cơ chế này tránh chờ vô hạn khi trình duyệt không phản hồi; nó không kiểm tra hoặc bảo đảm tốc độ tải website. Nếu trình duyệt chưa được cài hoặc không mở được, ứng dụng giữ thông báo và các lựa chọn để người dùng thử lại.

## Cài đặt

1. Mở `https://e-class-vinhlong.vercel.app/cai-ung-dung` trên điện thoại Android.
2. Tải APK. Khi Android hỏi, cho phép trình duyệt đang dùng **Cài ứng dụng không rõ nguồn gốc** để cài tệp này.
3. Mở **Lớp học hạnh phúc** và dùng tài khoản học sinh hoặc Google của giáo viên như trên website.
4. Có thể tắt lại quyền cài ứng dụng của trình duyệt sau khi cài xong.

Nếu bản 1.0.0 đã cài nhưng mở màn hình trắng hoặc đứng ở màn hình mở đầu, tải bản 1.0.1 từ trang trên rồi chọn **Cập nhật**. Bản mới dùng cùng package và khóa ký nên cài đè lên bản cũ; không cần gỡ ứng dụng. Hãy giữ kết nối Internet và cập nhật Chrome. Khi chưa mở được lớp học trong ứng dụng, chọn **Mở bằng trình duyệt**.

Ứng dụng này là bản APK cài trực tiếp, chưa phát hành trên Google Play. Những thay đổi nội dung website xuất hiện trong ứng dụng khi tải lại trang. Khi thay đổi mã Android, cần phát hành APK mới với cùng khóa ký và `versionCode` lớn hơn.

## Xây dựng

Yêu cầu JDK 17 hoặc 21, Android SDK Platform 36, Build Tools 35.0.0. Dự án cố định Gradle 8.11.1, Android Gradle Plugin 8.10.1 và Android Browser Helper 2.7.4. Gradle Wrapper kiểm tra SHA-256 bản phân phối trước khi chạy.

Trong môi trường Codex Linux mới, có thể chuẩn bị bộ công cụ độc lập bằng Python 3.12 trở lên (không ghi vào HOME, không cần quyền quản trị):

```bash
python3 android/scripts/setup-cloud.py --tool-root /workspace/shared/android-tools
source /workspace/shared/android-tools/toolchain.env
```

Script chỉ tải các bản chính thức từ Google, Gradle và Eclipse Temurin; kiểm tra SHA-256 cố định trước khi giải nén. Nó dùng proxy hiện có và kho CA Java của hệ thống nếu có. Việc này không tạo khóa ký mới; tiếp tục dùng khóa riêng đã sao lưu. Android SDK và công cụ của Google sử dụng theo điều khoản giấy phép tương ứng.

```bash
cd android
export ANDROID_HOME=/duong-dan/android-sdk
export ECLASS_ANDROID_SIGNING_FILE=/duong-dan-rieng/release-signing.json
./gradlew --no-daemon --console=plain :app:assembleRelease :app:lintRelease
```

APK tạo tại `app/build/outputs/apk/release/app-release.apk`. Các thư mục `build`, `.gradle`, `local.properties` và khóa riêng đều bị loại khỏi Git.

Tệp ký riêng là JSON với các trường `storeFile` (đường dẫn tuyệt đối), `storePassword`, `keyAlias`, `keyPassword`. Không đưa tệp JSON hoặc keystore vào Git, thư mục public, email hay ảnh chụp màn hình. Lần thiết lập đầu tiên đã lưu chúng trong `/workspace/shared/android-signing/` với quyền chỉ chủ sở hữu đọc/ghi. Giữ bản sao riêng của **cả keystore và JSON** để tiếp tục cập nhật ứng dụng; không tạo khóa thay thế khi dựng bản mới.

Build release sẽ dừng nếu thiếu đường dẫn ký. Build debug dùng `./gradlew :app:assembleDebug`; chữ ký debug không khớp website nên trình duyệt sẽ hiện thanh địa chỉ.

## Kiểm tra luồng mở ứng dụng

Các bài kiểm tra `MainActivityTest` dùng **Robolectric 4.17** để mô phỏng luồng khởi động trên JVM: trạng thái ban đầu, kết nối Custom Tabs, hết thời gian chờ, mở trình duyệt và thử lại. Chạy cùng các kiểm tra bản phát hành:

```bash
./gradlew --no-daemon --console=plain :app:testDebugUnitTest :app:lintRelease :app:assembleRelease
```

Các bài kiểm tra này không thay thế việc cài APK trên điện thoại thật. Chưa xác minh lỗi màn hình trắng trên chính thiết bị đã báo lỗi; cần kiểm tra mở ứng dụng, chuyển sang trình duyệt, cập nhật từ bản 1.0.0 và đăng nhập Google trên thiết bị đó.

Kiểm tra ngày 18/10/2026: 28 bài kiểm tra chạy trên cả API 26 và API 36,
đủ **56/56 trường hợp đạt**, không bỏ qua bài nào. Bao gồm kết nối treo,
Binder session không phản hồi, callback muộn, thử lại, quay về từ trình duyệt,
xoay/tạo lại màn hình, phục hồi trạng thái và trình duyệt không khả dụng.
Gradle chuẩn bị hai SDK Robolectric cố định vào `app/build/robolectric-sdks`
và dùng resolver offline; không cần ghi cache vào thư mục home.

Luồng cũ có thể chờ vô hạn khi Android nhận yêu cầu bind dịch vụ nhưng trình
duyệt không trả callback. Bản mới giới hạn bước này; chưa có logcat để khẳng
định đó là nguyên nhân duy nhất trên điện thoại đã báo lỗi. Nếu nội dung web
vẫn không tải, bấm Back để trở về các nút mở bằng trình duyệt/thử lại.

## Liên kết đã xác minh

- Application ID: `vn.edu.bentre.eclass`.
- Chứng chỉ công khai: `release-certificate.pem`.
- SHA-256 chứng chỉ: `36:F1:AA:14:8A:5A:25:9B:7F:87:8B:B3:7C:B0:F4:C9:4C:88:D7:D9:FE:9E:17:FB:D9:7B:78:90:4B:7E:8A:C5`.
- Website phục vụ `/.well-known/assetlinks.json` với đúng package và chứng chỉ trên. `asset_statements` trong APK xác nhận chiều ngược lại.

Không thêm miền Google vào các miền TWA tin cậy: khi đăng nhập, trình duyệt cần hiển thị rõ nguồn Google; sau đó quay về callback của website. Không dùng tham số URL để truyền token hoặc mật khẩu từ Android.

Kiểm tra bản phát hành bằng `apksigner verify --verbose --print-certs app-release.apk`, `zipalign -c -P 16 4 app-release.apk` và `aapt dump badging app-release.apk`. Cần kiểm tra cài đặt và đăng nhập trên điện thoại thực trước khi phân phối rộng trong trường.
