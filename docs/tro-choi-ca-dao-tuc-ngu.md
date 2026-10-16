# Đố vui ca dao, tục ngữ Việt Nam

Trò chơi tại `/tro-choi/ca-dao-tuc-ngu` phù hợp học sinh lớp 4 và có thể chơi
trực tiếp, không cần đăng nhập. Nội dung chung không chứa dữ liệu học sinh.

## Mở trò chơi

- Trang chủ cả ba giao diện: mục **Vui học mỗi ngày**, sau các lối tắt,
  chọn **Chơi đố vui**.
- Góc học sinh: chọn **Trò chơi** trong điều hướng lớp, hoặc thẻ
  **Đố vui ca dao, tục ngữ Việt Nam** phía dưới nội dung lớp.
- Học sinh vẫn phải đăng nhập và đổi mật khẩu mặc định trước khi xem góc học sinh.

## Nội dung và cách chơi

Ngân hàng có 30 câu hỏi với 30 câu ca dao, tục ngữ khác nhau:

- 10 câu điền từ còn thiếu.
- 10 câu tìm hiểu ý nghĩa.
- 10 câu vận dụng vào tình huống gần gũi.

Các chủ đề gồm biết ơn, yêu thương, đoàn kết, chăm học, kiên trì, trung thực,
lễ phép và cẩn thận. Lời giải diễn đạt riêng, ngắn gọn, dùng câu dân gian quen thuộc.

1. Chọn một dạng hoặc **Thử sức tổng hợp**, rồi chọn **Bắt đầu chơi**.
2. Mỗi lượt chọn ngẫu nhiên 5 câu, không lặp trong lượt; thứ tự đáp án cũng đổi.
3. Chọn một đáp án và nhấn **Kiểm tra đáp án**. Sau đó đọc đáp án đúng, nguyên văn
   câu ca dao/tục ngữ và lời giải. Câu điền từ không lộ nguyên văn trước khi chấm.
4. Tiếp tục tới **Xem kết quả**, xem lại cả năm câu, rồi chơi lượt mới hoặc đổi dạng.

Kết quả chỉ thuộc lượt chơi đang mở. Trò chơi luyện tập không ghi điểm hoặc sao
vào tài khoản, không có bảng xếp hạng và không thay đổi dữ liệu lớp.

## Mã nguồn

- `web/src/lib/proverb-quiz.ts`: nội dung và cách tạo lượt chơi.
- `web/src/components/proverb-quiz.tsx`: tương tác, lời giải và tổng kết.
- `web/src/app/tro-choi/ca-dao-tuc-ngu`: trang và CSS riêng.
- `web/src/components/learning-game-card.tsx`: thẻ mở trò chơi dùng chung.

Khi bổ sung câu hỏi, dùng mã riêng, bốn đáp án khác nhau, một đáp án đúng rõ ràng
và lời giải phù hợp trẻ em. Dạng hiểu nghĩa cần trích đủ câu trong phần hỏi;
dạng điền từ dùng chỗ trống trong `prompt`, giữ câu đầy đủ ở `saying` để giải đáp.
