import "server-only";
import { batch, type D1Statement } from "@/lib/d1";
import { decodeLesson, lessonSummary } from "@/lib/lessons";
import { lessonClassActive, lessonStaffAccess } from "@/lib/lesson-access";

export async function saveLearningPost(actorId: string, input: { id?: string; class_id: string; title: string; document: string; kind?: "NEWS" | "ANNOUNCEMENT" | "ACTIVITY"; status: "DRAFT" | "PUBLISHED" }) {
  const blocks = decodeLesson(input.document);
  if (!blocks) return false;
  const document = JSON.stringify(blocks);
  if (document.length > 48000) return false;
  const id = input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const body = lessonSummary(blocks);
  const assetGuard = `AND NOT EXISTS (
    SELECT 1 FROM json_each(?) block
    WHERE json_extract(block.value, '$.assetId') IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM lesson_assets a WHERE a.id = json_extract(block.value, '$.assetId')
      AND a.class_id = c.id AND a.ready = 1 AND (
        a.post_id = ? OR (a.post_id IS NULL AND a.uploaded_by = ?))
      AND a.mime = CASE json_extract(block.value, '$.type') WHEN 'image' THEN 'image/webp' ELSE 'application/pdf' END
    )
  )`;
  const authParams = [input.class_id, actorId, document, id, actorId];
  const guard = `c.id = ? AND ${lessonClassActive} AND ${lessonStaffAccess} ${assetGuard}`;
  const post: D1Statement = input.id ? {
    sql: `UPDATE posts SET title = ?, body = ?, lesson_content = ?, kind = COALESCE(?, kind), status = ?,
      published_at = CASE WHEN ? = 'PUBLISHED' THEN COALESCE(published_at, ?) ELSE NULL END, updated_at = ?
      WHERE id = ? AND class_id = ? AND category = 'DISCOVERY' AND visibility = 'PRIVATE' AND status <> 'ARCHIVED'
        AND EXISTS (SELECT 1 FROM classes c JOIN schools school ON school.id = c.school_id WHERE ${guard})`,
    params: [input.title, body, document, input.kind ?? null, input.status, input.status, now, now, id, input.class_id, ...authParams],
  } : {
    sql: `INSERT INTO posts (id, class_id, author_id, title, body, lesson_content, kind, category, visibility,
      status, published_at, created_at, updated_at)
      SELECT ?, c.id, ?, ?, ?, ?, ?, 'DISCOVERY', 'PRIVATE', ?, ?, ?, ?
      FROM classes c JOIN schools school ON school.id = c.school_id WHERE ${guard}`,
    params: [id, actorId, input.title, body, document, input.kind ?? "NEWS", input.status, input.status === "PUBLISHED" ? now : null, now, now, ...authParams],
  };
  const results = await batch([
    post,
    { sql: `INSERT INTO audit_logs (id, actor_user_id, school_id, class_id, action, entity_type, entity_id, details_json)
      SELECT ?, ?, c.school_id, c.id, ?, 'post', ?, ? FROM classes c
      WHERE c.id = ? AND changes() > 0`,
      params: [crypto.randomUUID(), actorId, input.id ? "POST_UPDATED" : "POST_CREATED", id,
        JSON.stringify({ category: "DISCOVERY", status: input.status, visibility: "PRIVATE" }), input.class_id] },
    { sql: `UPDATE lesson_assets SET post_id = ?
      WHERE changes() > 0 AND class_id = ? AND ready = 1 AND post_id IS NULL AND uploaded_by = ?
      AND id IN (SELECT json_extract(value, '$.assetId') FROM json_each(?))`, params: [id, input.class_id, actorId, document] },
  ]);
  return !!results[0]?.meta.changes;
}
