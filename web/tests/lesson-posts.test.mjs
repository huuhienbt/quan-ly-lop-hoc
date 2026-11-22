import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword } from "../src/lib/password.ts";
import { createD1Fixture, insertUser } from "./d1-fixture.mjs";
import { decodeLesson, lessonDateLabel, lessonInline, lessonSummary, resolveLessonMedia } from "../src/lib/lessons.ts";
import { editableRuns, runLength, snapshotText, splitRich } from "../src/lib/lesson-editing.ts";
import { readLessonAsset, stageLessonAsset } from "../src/lib/lesson-assets.ts";
import { saveLearningPost } from "../src/lib/lesson-posts.ts";
import { archiveContent, getPublicPost, getPublicPosts, getStudentClassContent, getTeacherContentOverview, savePost } from "../src/lib/class-content.ts";
import { publicationValues } from "../src/lib/post-dates.ts";

test("posting dates follow Vietnam time and never act as a schedule", () => {
  const vnMidnight = new Date("2026-11-21T17:00:00.000Z");
  assert.deepEqual(publicationValues("PUBLISHED", "2026-11-22", vnMidnight),
    { date: "2026-11-22", published: "2026-11-21T17:00:00.000Z" });
  assert.deepEqual(publicationValues("PUBLISHED", "2026-11-19", vnMidnight),
    { date: "2026-11-19", published: "2026-11-19T05:00:00.000Z" });
  assert.deepEqual(publicationValues("DRAFT", "2026-11-19", vnMidnight), { date: "2026-11-19", published: null });
  assert.equal(publicationValues("PUBLISHED", "2026-11-23", vnMidnight), null);
  assert.equal(publicationValues("DRAFT", "2026-02-30", vnMidnight), null);
});

test("lesson documents accept configured media and safe text without injecting raw markup", () => {
  const text = "**Toán** *luyện tập* __câu 1__ [[frac:3|4]] <b>ví dụ</b>";
  assert.deepEqual(lessonInline(text).filter(item => item.kind !== "plain").map(item => item.kind), ["bold","italic","underline","fraction"]);
  const blocks = [{ type: "text", text, align: "right" }];
  assert.equal(lessonSummary(blocks), "Toán luyện tập câu 1 3/4 <b>ví dụ</b>");
  assert.deepEqual(decodeLesson(JSON.stringify(blocks)), blocks);
  for (const url of ["javascript:alert(1)", "https://teacher:secret@example.com/a", "http://example.com/a"]) {
    assert.equal(decodeLesson(JSON.stringify([{ type: "link", label: "Mở tài liệu", url }])), null);
  }
  assert.equal(resolveLessonMedia("video","https://youtu.be/abcdefghijk").src, "https://www.youtube-nocookie.com/embed/abcdefghijk");
  assert.equal(resolveLessonMedia("audio", "https://drive.google.com/file/d/example/view").src, "https://drive.google.com/file/d/example/preview");
  assert.equal(resolveLessonMedia("audio", "https://github.com/classroom/example/blob/main/lesson.mp3").src, "https://raw.githubusercontent.com/classroom/example/main/lesson.mp3");
  assert.equal(resolveLessonMedia("video", "https://youtube.com.evil.example/watch?v=abcdefghijk"), null);
  assert.equal(decodeLesson(JSON.stringify([{ type:"image", width:"200", label:"", url:"https://example.com/a.jpg" }])), null);
});

test("a rich lesson preserves old marks and keeps a fraction or blank intact when splitting at the cursor", () => {
  const old = { type: "text", text: "**Toán** [[frac:3|4]]", align: "center" };
  const rich = [...editableRuns(old), { kind: "blank" }, { kind: "text", value: "  Tiếp theo", marks: { color: "#9b2625", underline: true } }];
  const [left,right] = splitRich(rich,7);
  assert.equal(left.at(-1).kind,"blank");
  assert.equal(right[0].marks.underline,true);
  assert.equal(runLength(left),7);
  const saved = snapshotText(old,rich);
  assert.equal(saved.text,"Toán 3/4________  Tiếp theo");
  assert.deepEqual(decodeLesson(JSON.stringify([saved])),[saved]);
  assert.equal(decodeLesson(JSON.stringify([{ ...saved, text:"mismatch" }])),null);
  rich.at(-1).marks.color = "url(https://example.com)";
  assert.equal(decodeLesson(JSON.stringify([saved])),null);
  assert.equal(lessonDateLabel("2027-01-01"),"Ngày 01/01/2027 · Tuần 53");
});

test("published lesson files are assembled, private to the right class, and revoked on archive", async () => {
  const passwordHash = await hashPassword("Only-For-Lesson-Fixtures-2026!");
  const fixture = createD1Fixture();
  try {
    const db = fixture.database;
    const admin = insertUser(db, { role: "SUPER_ADMIN" });
    const teacher = insertUser(db, { role: "TEACHER" });
    const other = insertUser(db, { role: "TEACHER" });
    db.prepare("UPDATE users SET email_verified_at = '2026-11-22' WHERE id IN (?, ?, ?)").run(admin.id, teacher.id, other.id);
    db.exec("INSERT INTO academic_years (id,school_id,name,starts_on,ends_on) VALUES ('lesson-year','school-ben-tre','Fixture','2026-08-01','2027-06-01')");
    for (const [classId, actor, account, phone] of [["lesson-a",teacher,"family-a","0910000001"],["lesson-b",other,"family-b","0910000002"]]) {
      db.prepare(`INSERT INTO classes (id,school_id,academic_year_id,name,slug,grade,created_by)
        VALUES (?,'school-ben-tre','lesson-year',?,?,4,?)`).run(classId,classId,classId,admin.id);
      db.prepare("INSERT INTO class_teachers (class_id,user_id,assigned_by) VALUES (?,?,?)").run(classId,actor.id,admin.id);
      db.prepare("INSERT INTO students (id,school_id,full_name) VALUES (?,'school-ben-tre','Học sinh giả lập')").run(classId);
      db.prepare("INSERT INTO student_accounts (id,phone,password_hash,must_change_password) VALUES (?,?,?,0)").run(account,phone,passwordHash);
      db.prepare("INSERT INTO student_account_students (account_id,student_id) VALUES (?,?)").run(account,classId);
      db.prepare(`INSERT INTO student_enrollments (id,student_id,class_id,school_id,academic_year_id,enrolled_on)
        VALUES (?,?,?,'school-ben-tre','lesson-year','2026-09-01')`).run(classId,classId,classId);
    }
    const sample = Buffer.concat([Buffer.from("%PDF-1.7\n"),Buffer.alloc(510000,32),Buffer.from("\n%%EOF\n")]);
    const file = new File([sample], "fixture.pdf", { type:"application/pdf" });
    const wrongFile = new File(["not a PDF"], "bad.pdf", { type:"application/pdf" });
    await assert.rejects(stageLessonAsset(teacher.id, "lesson-a", "pdf", wrongFile));
    await assert.rejects(stageLessonAsset(other.id, "lesson-a", "pdf", file));
    const { id } = await stageLessonAsset(teacher.id, "lesson-a", "pdf", file);
    assert.equal(db.prepare("SELECT count(*) AS count FROM lesson_asset_parts WHERE asset_id=?").get(id).count,2);
    const blocks = [snapshotText({ type:"text",text:"",align:"center" }, [
      { kind:"text",value:"Bài tập ",marks:{bold:true,color:"#164e9f"} }, { kind:"fraction",numerator:"2",denominator:"3" }, { kind:"blank" },
    ]), { type:"pdf",label:"Phiếu",assetId:id }];
    const input = { title:"Toán 4", class_id:"lesson-a", document:JSON.stringify(blocks), status:"DRAFT",kind:"ACTIVITY", post_date:"2024-10-14" };
    assert.equal(await saveLearningPost(other.id, input), false);
    assert.equal(await saveLearningPost(other.id, { ...input,class_id:"lesson-b" }), false);
    assert.equal(await readLessonAsset(id,{studentId:"family-a",version:1}), null);
    assert.deepEqual((await readLessonAsset(id,{staffId:teacher.id})).bytes, sample);
    assert.equal(await saveLearningPost(teacher.id,input), true);
    const post = (await getTeacherContentOverview(teacher.id, {includeLegacy:false})).posts[0];
    assert.deepEqual(decodeLesson(post.lesson_content), blocks);
    assert.equal(post.kind,"ACTIVITY");
    assert.equal(post.post_date,"2024-10-14");
    assert.equal(post.published_at,null);
    assert.equal(await readLessonAsset(id,{studentId:"family-a",version:1}), null);
    assert.equal(await saveLearningPost(teacher.id,{...input,id:post.id,status:"PUBLISHED",kind:"ANNOUNCEMENT"}),true);
    assert.deepEqual(await getPublicPosts(), []);
    const studentPost = (await getStudentClassContent("family-a",1)).students[0].posts[0];
    assert.equal(studentPost.id, post.id);
    assert.equal(studentPost.kind,"ANNOUNCEMENT");
    assert.equal(studentPost.published_at,"2024-10-14T05:00:00.000Z");
    assert.deepEqual(decodeLesson(studentPost.lesson_content),blocks);
    assert.deepEqual((await readLessonAsset(id,{studentId:"family-a",version:1})).bytes, sample);
    for (const viewer of [{},{studentId:"family-b",version:1},{studentId:"family-a",version:2},{staffId:other.id}]) {
      assert.equal(await readLessonAsset(id,viewer),null);
    }
    assert.equal(await saveLearningPost(teacher.id,{...input,status:"PUBLISHED"}),false); // A file cannot be attached to a second post.
    await archiveContent(teacher.id,{type:"post",id:post.id});
    assert.equal(await readLessonAsset(id,{studentId:"family-a",version:1}),null);

    const bullet = { class_id:"lesson-a", title:"Hoạt động giả lập", body:"Bản tin",
      kind:"ACTIVITY", category:"CLASS_STORY", status:"DRAFT", visibility:"PUBLIC", is_pinned:false, post_date:"2024-10-13" };
    const privateLessonDocument = JSON.stringify(blocks);
    await assert.rejects(savePost(teacher.id,{...bullet,bulletin_content:privateLessonDocument}));
    const { id: pdfId } = await stageLessonAsset(teacher.id,"lesson-a","pdf",file);
    const bulletinBlocks = [blocks[0],{...blocks[1],assetId:pdfId}];
    const document = JSON.stringify(bulletinBlocks);
    const draft = await savePost(teacher.id,{...bullet,bulletin_content:document});
    assert.equal(await getPublicPost(draft),null);
    assert.equal(await readLessonAsset(pdfId,{}),null);
    const recent = await savePost(teacher.id,{...bullet,title:"Bản tin cũ không định dạng",status:"PUBLISHED",post_date:"2024-10-14"});
    await savePost(teacher.id,{...bullet,id:draft,status:"PUBLISHED",bulletin_content:document});
    assert.deepEqual((await getPublicPosts()).map(p=>p.id),[recent,draft]);
    assert.deepEqual(decodeLesson((await getPublicPost(draft)).bulletin_content),bulletinBlocks);
    assert.deepEqual((await readLessonAsset(pdfId,{})).bytes,sample);
    await savePost(teacher.id,{...bullet,id:draft,status:"PUBLISHED",bulletin_content:document,post_date:"2024-10-15"});
    assert.deepEqual((await getPublicPosts()).map(p=>p.id),[draft,recent]);
    assert.equal((await getPublicPost(draft)).published_at,"2024-10-15T05:00:00.000Z");
    await assert.rejects(savePost(teacher.id,{...bullet,id:draft,status:"PUBLISHED",bulletin_content:document,post_date:"2999-10-15"}));
    await savePost(teacher.id,{...bullet,id:draft,status:"PUBLISHED",bulletin_content:document,visibility:"PRIVATE"});
    assert.equal(await getPublicPost(draft),null);
    assert.equal(await readLessonAsset(pdfId,{}),null);
    assert.deepEqual((await readLessonAsset(pdfId,{studentId:"family-a",version:1})).bytes,sample);
    assert.equal(await readLessonAsset(pdfId,{studentId:"family-b",version:1}),null);
  } finally { fixture.restore(); }
});
