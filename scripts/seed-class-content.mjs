// Run explicitly for a chosen class. Existing articles/tasks are never overwritten.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const remote = process.argv.includes('--remote');
const apply = process.argv.includes('--apply');
const option = (name, fallback) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback;
const classSlug = option('class', 'bon-12-2026-2027');
const actorEmail = option('actor', 'huuhienbte@gmail.com');
let local = '';
if (!remote) {
  try { local = readFileSync(fileURLToPath(new URL('../web/.env.local', import.meta.url)), 'utf8'); }
  catch { throw new Error('Chưa có cấu hình local. Chạy npm run setup:local trước.'); }
}
const localValue = name => local.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim().replace(/^(['"])(.*)\1$/, '$2');
const endpoint = remote ? process.env.D1_GATEWAY_URL || 'https://lophocthongminh-d1.huuhienbte.workers.dev/query' : localValue('D1_LOCAL_API_URL');
const token = remote ? process.env.D1_GATEWAY_TOKEN : localValue('D1_LOCAL_API_TOKEN');
if (!endpoint || !token) throw new Error('Chưa có cấu hình gateway.');
const target = new URL(endpoint);
const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
if (target.pathname !== '/query' || target.username || target.password || target.search || target.hash ||
  (remote ? target.protocol !== 'https:' || loopback : target.protocol !== 'http:' || !loopback)) throw new Error('Gateway không hợp lệ.');

async function request(statements) {
  const response = await fetch(endpoint, { method: 'POST',
    headers: {'Content-Type':'application/json',Authorization:`Bearer ${token}`},
    body: JSON.stringify(statements),redirect:'error',signal:AbortSignal.timeout(30000) });
  const payload = await response.json();
  if (!response.ok || payload.success !== true || payload.result?.length !== statements.length || payload.result.some(result=>result.success!==true)) {
    throw new Error('Chưa xác nhận được thao tác. Kiểm tra dữ liệu trước khi chạy lại.');
  }
  return payload.result;
}

const [classes, actors] = await request([
  {sql:`SELECT c.id,c.school_id FROM classes c JOIN schools s ON s.id=c.school_id WHERE c.slug=? AND c.archived_at IS NULL AND s.archived_at IS NULL`,params:[classSlug]},
  {sql:`SELECT id FROM users WHERE email=? AND role='SUPER_ADMIN' AND status='ACTIVE' AND email_verified_at IS NOT NULL`,params:[actorEmail]},
]);
if (classes.results.length!==1 || actors.results.length!==1) throw new Error('Không tìm thấy lớp hoặc tài khoản quản trị hợp lệ.');
const classroom = classes.results[0], actorId = actors.results[0].id;
const prefix = `starter-${classroom.id}-`;
const posts = [
  {key:'welcome',title:'Chào mừng đến với bảng tin lớp Bốn 12',kind:'ANNOUNCEMENT',category:'GENERAL',visibility:'PUBLIC',pinned:1,
    body:'Một lớp học, muôn điều hạnh phúc. Đây là góc kết nối của lớp Bốn 12, Trường Tiểu học Bến Tre, nơi thầy cô và gia đình cùng đồng hành với các em.\n\nBa mẹ có thể theo dõi bản tin, các chia sẻ và lịch công khai của lớp ngay trên trang chủ. Học sinh chọn “Dành cho học sinh”, đăng nhập bằng số điện thoại đã đăng ký và mật khẩu được cấp. Ở lần đầu tiên, các em cần đổi mật khẩu trước khi vào góc riêng.\n\nTrong góc học sinh, em có thể xem lời nhắn của thầy cô, chuẩn bị cho ngày mai và đánh dấu những việc mình đã làm được. Các thông báo và lịch cụ thể sẽ được thầy cô cập nhật tại đây.'},
  {key:'small-joys',title:'Những niềm vui nhỏ của lớp mình',kind:'NEWS',category:'CLASS_STORY',visibility:'PUBLIC',pinned:0,
    body:'Một lời chào buổi sáng, một bàn tay giúp bạn nhặt chiếc bút, một câu hỏi được mạnh dạn giơ tay — niềm vui của lớp học có thể bắt đầu từ những điều rất nhỏ.\n\nGóc chuyện vui lớp mình dành để lưu lại những khoảnh khắc đáng nhớ và sự tiến bộ của các em. Thầy cô sẽ chia sẻ những câu chuyện và hình ảnh phù hợp để cả gia đình cùng dõi theo.\n\nEm thử để ý một điều tốt quanh mình hôm nay và kể lại với ba mẹ hoặc thầy cô nhé. Mỗi bạn đều có một câu chuyện đáng được lắng nghe.'},
  {key:'listening',title:'Mình cùng học cách lắng nghe',kind:'NEWS',category:'KINDNESS',visibility:'PUBLIC',pinned:0,
    body:'Tuần này, mình cùng thực hành một điều nhỏ: lắng nghe để hiểu nhau hơn. Khi được lắng nghe, mỗi bạn sẽ cảm thấy mình được quan tâm và tôn trọng.\n\nBa việc em có thể thử:\n• Nghe bạn nói hết câu trước khi góp ý.\n• Giơ tay khi muốn phát biểu.\n• Dành cho bạn một lời động viên khi bạn đang cố gắng.\n\nCuối ngày, em có thể tự hỏi: Hôm nay mình đã lắng nghe ai? Mình hiểu thêm điều gì về bạn? Một thay đổi nhỏ cũng là một bước tiến đáng vui.'},
  {key:'family-talk',title:'10 phút trò chuyện cùng con mỗi ngày',kind:'NEWS',category:'PARENT_GUIDE',visibility:'PUBLIC',pinned:0,
    body:'Một cuộc trò chuyện ngắn, không vội vàng, có thể giúp ba mẹ hiểu thêm về ngày học của con. Hãy chọn lúc cả nhà thoải mái và dành cho con sự chú ý trọn vẹn.\n\nBa câu hỏi gợi mở:\n• Hôm nay điều gì làm con vui?\n• Có việc nào con thấy khó và muốn được giúp không?\n• Con đã làm được điều gì mà con muốn kể với ba mẹ?\n\nBa mẹ hãy để con nói hết, ghi nhận sự cố gắng và cùng con chọn một bước nhỏ cho ngày mai. Không cần tìm ngay một lời giải cho mọi chuyện; đôi khi, được lắng nghe đã là điều con cần.'},
  {key:'study-corner',title:'Một góc học tập gọn gàng, một khởi đầu nhẹ nhàng',kind:'NEWS',category:'PARENT_GUIDE',visibility:'PUBLIC',pinned:0,
    body:'Ba mẹ có thể cùng con dành ít phút cuối ngày để sắp xếp lại góc học tập. Khi sách vở và đồ dùng có chỗ riêng, con sẽ dễ tự chuẩn bị hơn.\n\nCùng con thử ba bước:\n1. Cất sách, vở và bút về đúng chỗ.\n2. Đối chiếu thời khóa biểu thầy cô đã gửi để chuẩn bị cho ngày mai.\n3. Kiểm tra đồ dùng cần thiết và chọn một cuốn sách con muốn đọc.\n\nHãy để con tự làm những việc vừa sức và khen vào hành động cụ thể: “Con đã tự soạn xong sách vở rồi”. Thói quen tự lập được vun đắp bằng những lần thực hành nhỏ.'},
  {key:'reading-challenge',title:'Thử thách đọc sách: một trang, ba điều hay',kind:'NEWS',category:'DISCOVERY',visibility:'PRIVATE',pinned:0,
    body:'Em chọn một trang sách hoặc một đoạn truyện mình yêu thích, đọc chậm rãi rồi tìm ba điều hay.\n\n1. Một nhân vật hoặc chi tiết khiến em chú ý.\n2. Một từ mới hoặc một câu em muốn ghi nhớ.\n3. Một câu hỏi em muốn tìm hiểu thêm.\n\nEm có thể kể lại với ba mẹ, nói cho bạn nghe hoặc ghi ngắn vào vở. Mỗi ngày đọc một chút, thế giới quanh em sẽ rộng thêm một chút.'},
  {key:'shape-hunt',title:'Góc khám phá: hình học ở quanh em',kind:'NEWS',category:'DISCOVERY',visibility:'PRIVATE',pinned:0,
    body:'Em thử tìm năm đồ vật có mặt hình chữ nhật trong góc học tập hoặc trong nhà nhé.\n\nVới mỗi đồ vật, em hãy quan sát: cạnh nào dài hơn? Những góc của nó có điều gì giống nhau? Nếu có thước, em có thể đo chiều dài và chiều rộng của một đồ vật phù hợp.\n\nEm nhớ chọn đồ vật an toàn, vừa tầm và nhờ người lớn hỗ trợ khi cần. Toán học đang ở rất gần chúng mình!'},
];
const tasks = [
  {key:'reading',title:'Đọc sách 15 phút',details:'Chọn một cuốn sách phù hợp và kể lại một điều em thấy thú vị.',kind:'TODO',order:1},
  {key:'tidy',title:'Xếp gọn góc học tập',details:'Cất sách, vở và bút về đúng chỗ sau khi học.',kind:'TODO',order:2},
  {key:'thank-you',title:'Nói một lời cảm ơn',details:'Dành một lời cảm ơn chân thành cho người đã giúp em hôm nay.',kind:'TODO',order:3},
  {key:'schoolbag',title:'Soạn sách vở cho ngày mai',details:'Đối chiếu thời khóa biểu thầy cô đã gửi để chuẩn bị đúng sách, vở và đồ dùng.',kind:'PREPARATION',order:1},
  {key:'supplies',title:'Kiểm tra bút và bình nước',details:'Chuẩn bị đồ dùng cần thiết, cất gọn vào cặp và nhờ ba mẹ kiểm tra khi cần.',kind:'PREPARATION',order:2},
];
const actorGuard = `EXISTS(SELECT 1 FROM users WHERE id=? AND role='SUPER_ADMIN' AND status='ACTIVE' AND email_verified_at IS NOT NULL)`;
const statements = [];
for(const post of posts) {
  statements.push({sql:`INSERT INTO posts(id,class_id,author_id,kind,title,body,status,visibility,is_pinned,published_at,category)
    SELECT ?,c.id,?,?,?,?, 'PUBLISHED',?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'),? FROM classes c JOIN schools s ON s.id=c.school_id
    WHERE c.id=? AND c.archived_at IS NULL AND s.archived_at IS NULL AND ${actorGuard} ON CONFLICT(id) DO NOTHING`,
    params:[prefix+post.key,actorId,post.kind,post.title,post.body,post.visibility,post.pinned,post.category,classroom.id,actorId]});
  statements.push({sql:`INSERT INTO audit_logs(id,actor_user_id,school_id,class_id,action,entity_type,entity_id,details_json)
    SELECT ?,?,?,?,'STARTER_POST_CREATED','post',?,'{"seed_version":1}' WHERE changes()>0`,
    params:[prefix+post.key+'-audit',actorId,classroom.school_id,classroom.id,prefix+post.key]});
}
for(const task of tasks) {
  statements.push({sql:`INSERT INTO class_tasks(id,class_id,title,details,kind,task_date,sort_order,created_by)
    SELECT ?,c.id,?,?,?,NULL,?,? FROM classes c JOIN schools s ON s.id=c.school_id WHERE c.id=?
    AND c.archived_at IS NULL AND s.archived_at IS NULL AND ${actorGuard} ON CONFLICT(id) DO NOTHING`,
    params:[prefix+task.key,task.title,task.details,task.kind,task.order,actorId,classroom.id,actorId]});
  statements.push({sql:`INSERT INTO audit_logs(id,actor_user_id,school_id,class_id,action,entity_type,entity_id,details_json)
    SELECT ?,?,?,?,'STARTER_TASK_CREATED','class_task',?,'{"seed_version":1}' WHERE changes()>0`,
    params:[prefix+task.key+'-audit',actorId,classroom.school_id,classroom.id,prefix+task.key]});
}
if(statements.length>50)throw new Error('Vượt giới hạn transaction gateway.');
if(!apply) {
  console.log(JSON.stringify({dry_run:true,public_posts:posts.filter(p=>p.visibility==='PUBLIC').length,private_discovery:posts.filter(p=>p.visibility==='PRIVATE').length,daily_tasks:tasks.length,events_created:0}));
} else {
  const result=await request(statements);
  console.log(JSON.stringify({new_posts:result.slice(0,posts.length*2).filter((_,i)=>i%2===0).reduce((n,r)=>n+r.meta.changes,0),new_tasks:result.slice(posts.length*2).filter((_,i)=>i%2===0).reduce((n,r)=>n+r.meta.changes,0),events_created:0}));
}
