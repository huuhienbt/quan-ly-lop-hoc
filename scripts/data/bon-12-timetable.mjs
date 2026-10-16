// Transcribed from the timetable supplied by the class teacher.
// No student information is included. Suggestions are editable, not extra homework.
export const timetableSource = Object.freeze({
  school_name: 'Trường Tiểu học Bến Tre',
  class_name: 'Bốn 12',
  class_slug: 'bon-12-2026-2027',
  academic_year: '2026–2027',
  year_starts_on: '2026-09-01',
  year_ends_on: '2027-05-31',
  teacher_name: 'Nguyễn Hữu Hiền',
  note: 'Đồ dùng và việc ôn tập dưới đây là gợi ý; ưu tiên thông báo cụ thể của thầy cô. TANN giữ nguyên cách viết trong ảnh.',
});

const subjects = {
  'Sinh hoạt dưới cờ': {
    todo: 'Tham gia sinh hoạt dưới cờ, lắng nghe và ghi nhớ lời nhắc của thầy cô.',
    preparation: 'Trang phục, khăn quàng hoặc phù hiệu theo quy định của trường; bình nước.',
  },
  'Tiếng Anh': {
    todo: 'Ôn lại từ và mẫu câu đã học; hoàn thành phần thầy cô giao nếu có.',
    preparation: 'Sách, vở Tiếng Anh và hộp bút.',
  },
  'Tiếng Việt': {
    todo: 'Đọc lại nội dung đã học; hoàn thành phần đọc, viết thầy cô giao nếu có.',
    preparation: 'Sách, vở Tiếng Việt và hộp bút.',
  },
  'Âm nhạc': {
    todo: 'Ôn bài hát hoặc tiết tấu đã học theo hướng dẫn của thầy cô.',
    preparation: 'Sách, vở Âm nhạc; nhạc cụ học tập chỉ khi thầy cô yêu cầu.',
  },
  'Giáo dục thể chất': {
    todo: 'Vận động vừa sức và nhớ uống nước; thực hiện bài tập theo hướng dẫn của thầy cô.',
    preparation: 'Trang phục thể dục, giày phù hợp và bình nước.',
  },
  TANN: {
    todo: 'Xem lại nội dung TANN đã học và thực hiện lời dặn của thầy cô nếu có.',
    preparation: 'Sách, vở và đồ dùng TANN theo hướng dẫn của thầy cô.',
  },
  'Mĩ thuật': {
    todo: 'Hoàn thiện sản phẩm Mĩ thuật nếu thầy cô giao; cất gọn đồ dùng sau khi làm.',
    preparation: 'Sách hoặc vở Mĩ thuật, bút chì, tẩy và màu vẽ theo hướng dẫn của thầy cô.',
  },
  'Sinh hoạt đội': {
    todo: 'Ghi nhớ nội dung sinh hoạt đội và thực hiện việc được phân công nếu có.',
    preparation: 'Trang phục, khăn quàng hoặc phù hiệu theo quy định của trường.',
  },
  'Đạo đức': {
    todo: 'Nhớ lại điều tốt đã học và thử thực hiện một việc phù hợp trong ngày.',
    preparation: 'Sách, vở Đạo đức và hộp bút.',
  },
  'Tin học': {
    todo: 'Ôn thao tác đã học; sử dụng thiết bị khi có người lớn hướng dẫn.',
    preparation: 'Sách, vở Tin học. Chưa cần mang điện thoại hoặc máy tính cá nhân nếu thầy cô chưa yêu cầu.',
  },
  'Công nghệ': {
    todo: 'Xem lại bài Công nghệ và hoàn thành sản phẩm khi thầy cô giao.',
    preparation: 'Sách, vở Công nghệ. Giấy, keo dán hoặc kéo học sinh chỉ chuẩn bị khi thầy cô yêu cầu; nhờ người lớn kiểm tra.',
  },
  'Toán': {
    todo: 'Xem lại cách làm đã học; hoàn thành bài thầy cô giao nếu có và ghi lại điều chưa hiểu.',
    preparation: 'Sách, vở Toán, bút chì, tẩy và thước kẻ.',
  },
  'Khoa học': {
    todo: 'Ôn nội dung Khoa học đã học; ghi lại một điều em quan sát hoặc thắc mắc.',
    preparation: 'Sách, vở Khoa học; vật liệu quan sát chỉ khi thầy cô thông báo.',
  },
  'Sinh hoạt lớp': {
    todo: 'Nhìn lại việc đã làm tốt trong tuần và ghi nhớ lời nhắc của thầy cô.',
    preparation: 'Sổ hoặc vở ghi lời dặn; thông tin cần trao đổi với thầy cô nếu có.',
  },
  'Lịch sử - Địa lý': {
    todo: 'Ôn nội dung Lịch sử - Địa lý đã học; kể lại một điều em nhớ.',
    preparation: 'Sách, vở Lịch sử - Địa lý và hộp bút.',
  },
  'Hoạt động trải nghiệm': {
    todo: 'Thực hiện việc trải nghiệm được giao nếu có và chia sẻ điều em học được.',
    preparation: 'Sách, vở Hoạt động trải nghiệm; đồ dùng hoạt động theo thông báo của thầy cô.',
  },
  'Kỹ năng công dân số': {
    todo: 'Nhớ một cách dùng Internet an toàn đã học; hỏi người lớn khi gặp nội dung lạ.',
    preparation: 'Sách, vở hoặc tài liệu theo hướng dẫn; chưa cần mang điện thoại hoặc máy tính cá nhân nếu thầy cô chưa yêu cầu.',
  },
  'Giáo dục kỹ năng sống': {
    todo: 'Thử thực hành kỹ năng đã học trong một tình huống phù hợp và an toàn.',
    preparation: 'Vở ghi và đồ dùng hoạt động theo thông báo của thầy cô.',
  },
};

const lesson = (weekday, session, starts_at, ends_at, subject, instructor = '') => ({
  weekday, session, starts_at, ends_at, subject, instructor, ...subjects[subject],
});

export const bon12Timetable = {
  effective_from: '2026-09-28',
  lessons: [
    lesson(1, 'MORNING', '07:20', '07:55', 'Sinh hoạt dưới cờ'),
    lesson(1, 'MORNING', '08:00', '08:35', 'Tiếng Anh', 'Điều'),
    lesson(1, 'MORNING', '09:05', '09:40', 'Tiếng Việt'),
    lesson(1, 'MORNING', '09:45', '10:20', 'Tiếng Việt'),
    lesson(1, 'AFTERNOON', '13:40', '14:15', 'Lịch sử - Địa lý'),
    lesson(1, 'AFTERNOON', '14:20', '14:55', 'Khoa học'),
    lesson(1, 'AFTERNOON', '15:25', '16:00', 'Toán'),
    lesson(1, 'AFTERNOON', '16:00', '16:35', 'Hoạt động trải nghiệm'),

    lesson(2, 'MORNING', '07:20', '07:55', 'Tiếng Anh', 'Điều'),
    lesson(2, 'MORNING', '08:00', '08:35', 'Tiếng Anh', 'Điều'),
    lesson(2, 'MORNING', '09:05', '09:40', 'Âm nhạc', 'Oanh'),
    lesson(2, 'MORNING', '09:45', '10:20', 'Giáo dục thể chất', 'Trường'),
    lesson(2, 'AFTERNOON', '13:40', '14:15', 'Tiếng Việt'),
    lesson(2, 'AFTERNOON', '14:20', '14:55', 'Toán'),
    lesson(2, 'AFTERNOON', '15:25', '16:00', 'Kỹ năng công dân số'),
    lesson(2, 'AFTERNOON', '16:00', '16:35', 'Giáo dục kỹ năng sống'),

    lesson(3, 'MORNING', '07:20', '07:55', 'TANN'),
    lesson(3, 'MORNING', '08:00', '08:35', 'TANN'),
    lesson(3, 'MORNING', '09:05', '09:40', 'Giáo dục thể chất', 'Trường'),
    lesson(3, 'MORNING', '09:45', '10:20', 'Mĩ thuật', 'Châu'),
    lesson(3, 'AFTERNOON', '13:40', '14:15', 'Tiếng Việt'),
    lesson(3, 'AFTERNOON', '14:20', '14:55', 'Toán'),
    lesson(3, 'AFTERNOON', '15:25', '16:00', 'Lịch sử - Địa lý'),

    lesson(4, 'MORNING', '07:20', '07:55', 'Sinh hoạt đội'),
    lesson(4, 'MORNING', '08:00', '08:35', 'Đạo đức'),
    lesson(4, 'MORNING', '09:05', '09:40', 'Tin học', 'Tú'),
    lesson(4, 'MORNING', '09:45', '10:20', 'Công nghệ', 'Tú'),
    lesson(4, 'AFTERNOON', '13:40', '14:15', 'Tiếng Việt'),
    lesson(4, 'AFTERNOON', '14:20', '14:55', 'Toán'),
    lesson(4, 'AFTERNOON', '15:25', '16:35', 'Tiếng Anh', 'Điều'),

    lesson(5, 'MORNING', '07:20', '07:55', 'Tiếng Việt'),
    lesson(5, 'MORNING', '08:00', '08:35', 'Tiếng Việt'),
    lesson(5, 'MORNING', '09:05', '09:40', 'Toán'),
    lesson(5, 'MORNING', '09:45', '10:20', 'Khoa học'),
    lesson(5, 'MORNING', '10:25', '11:00', 'Sinh hoạt lớp'),
  ],
};
