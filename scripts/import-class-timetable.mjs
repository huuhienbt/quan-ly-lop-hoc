// Dry-run by default. Import the teacher-supplied Bốn 12 timetable only.
// node --conditions=react-server --use-env-proxy scripts/import-class-timetable.mjs --remote
// Add --apply only after reviewing the dry-run. Existing edits require --replace.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { bon12Timetable, timetableSource } from './data/bon-12-timetable.mjs';

const allowedOptions = new Set(['--remote', '--apply', '--replace', '--help']);
const args = process.argv.slice(2);
if (args.some(arg => !allowedOptions.has(arg) && !arg.startsWith('--actor='))) {
  throw new Error('Tùy chọn không hợp lệ. Dùng --help để xem hướng dẫn.');
}
if (args.includes('--help')) {
  console.log('Kiểm tra: node --conditions=react-server --use-env-proxy scripts/import-class-timetable.mjs [--remote] [--actor=email]\nGhi dữ liệu: thêm --apply. Chỉ thêm --replace khi chủ động thay thời khóa biểu đã có.');
  process.exit(0);
}

const remote = args.includes('--remote');
const apply = args.includes('--apply');
const replace = args.includes('--replace');
const actorOptions = args.filter(arg => arg.startsWith('--actor='));
if (actorOptions.length > 1) throw new Error('Chỉ cung cấp một --actor.');
const actorEmail = actorOptions[0]?.slice('--actor='.length).trim().toLowerCase() || 'huuhienbte@gmail.com';

if (!process.execArgv.some(arg => arg === '--conditions=react-server' || arg === '-C=react-server')) {
  throw new Error('Chạy script với node --conditions=react-server để dùng thư viện máy chủ.');
}
if (remote) {
  // A development environment may contain local credentials. Never silently target it.
  delete process.env.D1_LOCAL_API_URL;
  delete process.env.D1_LOCAL_API_TOKEN;
  process.env.NODE_ENV = 'production';
  process.env.D1_GATEWAY_URL ||= 'https://lophocthongminh-d1.huuhienbte.workers.dev/query';
} else {
  try { process.loadEnvFile(fileURLToPath(new URL('../web/.env.local', import.meta.url))); }
  catch { throw new Error('Chưa có cấu hình local. Chạy npm run setup:local trước.'); }
  if (!process.env.D1_LOCAL_API_URL) throw new Error('Chưa có D1 local. Không sử dụng gateway Production thay thế.');
}

const requireFromWeb = createRequire(new URL('../web/package.json', import.meta.url));
const { tsImport } = await import(pathToFileURL(requireFromWeb.resolve('tsx/esm/api')).href);
const importServerModule = relativePath => tsImport(new URL(relativePath, import.meta.url).href, {
  parentURL: import.meta.url,
  tsconfig: fileURLToPath(new URL('../web/tsconfig.json', import.meta.url)),
});
const d1Module = await importServerModule('../web/src/lib/d1.ts');
const timetableModule = await importServerModule('../web/src/lib/class-timetable.ts');
const { query } = d1Module.query ? d1Module : d1Module.default;
const { getTeacherTimetable, saveClassTimetable } = timetableModule.getTeacherTimetable ? timetableModule : timetableModule.default;

const [classes, actors] = await Promise.all([
  query(`SELECT c.id,c.name,c.grade,s.id AS school_id,s.name AS school_name,
    y.name AS academic_year,y.starts_on,y.ends_on
    FROM classes c JOIN schools s ON s.id=c.school_id
    JOIN academic_years y ON y.id=c.academic_year_id AND y.school_id=c.school_id
    WHERE c.slug=? AND c.archived_at IS NULL AND s.archived_at IS NULL`, [timetableSource.class_slug]),
  query(`SELECT id FROM users WHERE email=? AND role='SUPER_ADMIN'
    AND status='ACTIVE' AND email_verified_at IS NOT NULL`, [actorEmail]),
]);
const normalizedYear = value => String(value).replace(/[–—]/g, '-').replace(/\s/g, '');
const normalizedName = value => String(value).normalize('NFC').trim().toLocaleLowerCase('vi');
if (classes.length !== 1 || actors.length !== 1) {
  throw new Error('Không tìm thấy đúng lớp hoặc quản trị viên đang hoạt động, đã xác minh. Chưa ghi dữ liệu.');
}
const classroom = classes[0];
if (classroom.school_id !== 'school-ben-tre' || classroom.grade !== 4 ||
    normalizedName(classroom.school_name) !== normalizedName(timetableSource.school_name) ||
    normalizedName(classroom.name) !== normalizedName(timetableSource.class_name) ||
    normalizedYear(classroom.academic_year) !== normalizedYear(timetableSource.academic_year) ||
    classroom.starts_on !== timetableSource.year_starts_on || classroom.ends_on !== timetableSource.year_ends_on) {
  throw new Error('Tên trường, lớp hoặc năm học không khớp ảnh thời khóa biểu. Chưa ghi dữ liệu.');
}

const actorId = actors[0].id;
const current = await getTeacherTimetable(actorId, classroom.id);
const comparable = value => JSON.stringify({
  effective_from: value.effective_from,
  lessons: value.lessons.map(item => ({
    weekday: item.weekday,
    session: item.session,
    starts_at: item.starts_at,
    ends_at: item.ends_at,
    subject: item.subject,
    instructor: item.instructor,
    todo: item.todo,
    preparation: item.preparation,
  })).sort((a, b) => a.weekday - b.weekday || a.starts_at.localeCompare(b.starts_at)),
});
const summary = {
  target: remote ? 'Production' : 'local',
  class: timetableSource.class_name,
  academic_year: timetableSource.academic_year,
  effective_from: bon12Timetable.effective_from,
  lesson_blocks: bon12Timetable.lessons.length,
  current_revision: current.revision,
};
if (current.revision > 0 && comparable(current) === comparable(bon12Timetable)) {
  console.log(JSON.stringify({ ...summary, changed: false, reason: 'Thời khóa biểu này đã được lưu; không tạo bản trùng.' }));
  process.exit(0);
}
if (current.revision > 0 && !replace) {
  throw new Error('Lớp đã có thời khóa biểu khác. Dừng để giữ nguyên nội dung đã chỉnh; chỉ dùng --replace khi chủ động thay thế.');
}
if (!apply) {
  console.log(JSON.stringify({ ...summary, dry_run: true, would_replace: current.revision > 0,
    note: timetableSource.note,
    afternoon_merged_blocks: bon12Timetable.lessons.filter(item => item.session === 'AFTERNOON' && item.starts_at === '15:25' && item.ends_at === '16:35').map(({ weekday, starts_at, ends_at, subject }) => ({ weekday, starts_at, ends_at, subject })),
  }));
} else {
  // Revisions prevent overwriting another teacher's save after the read above.
  const saved = await saveClassTimetable(actorId, { class_id: classroom.id, revision: current.revision, ...bon12Timetable });
  console.log(JSON.stringify({ ...summary, changed: true, saved_revision: saved.revision }));
}
