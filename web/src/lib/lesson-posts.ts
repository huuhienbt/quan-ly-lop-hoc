import "server-only";
import { batch, type D1Statement } from "@/lib/d1";
import { decodeLesson, lessonSummary } from "@/lib/lessons";
import { lessonClassActive, lessonStaffAccess } from "@/lib/lesson-access";
import { attachPostAssets, postAssetGuard } from "@/lib/post-attachments";
import { postDateUpdate, postDateUpdateParams, publicationValues } from "@/lib/post-dates";

export async function saveLearningPost(actorId: string, input: { id?: string; class_id: string; title: string; document: string; kind?: "NEWS" | "ANNOUNCEMENT" | "ACTIVITY"; status: "DRAFT" | "PUBLISHED"; post_date?: string }) {
  const blocks = decodeLesson(input.document);
  if (!blocks) return false;
  const document = JSON.stringify(blocks);
  if (document.length > 48000) return false;
  const id = input.id ?? crypto.randomUUID();
  const current = new Date();
  const now = current.toISOString();
  const publication = publicationValues(input.status, input.post_date, current);
  if (!publication) return false;
  const body = lessonSummary(blocks);
  const authParams = [input.class_id, actorId, document, id, actorId];
  const guard = `c.id = ? AND ${lessonClassActive} AND ${lessonStaffAccess} ${postAssetGuard}`;
  const post: D1Statement = input.id ? {
    sql: `UPDATE posts SET title = ?, body = ?, lesson_content = ?, kind = COALESCE(?, kind), status = ?,
      ${postDateUpdate}, updated_at = ?
      WHERE id = ? AND class_id = ? AND category = 'DISCOVERY' AND visibility = 'PRIVATE' AND status <> 'ARCHIVED'
        AND EXISTS (SELECT 1 FROM classes c JOIN schools school ON school.id = c.school_id WHERE ${guard})`,
    params: [input.title, body, document, input.kind ?? null, input.status, ...postDateUpdateParams(publication), now, id, input.class_id, ...authParams],
  } : {
    sql: `INSERT INTO posts (id, class_id, author_id, title, body, lesson_content, kind, category, visibility,
      status, published_at, post_date, created_at, updated_at)
      SELECT ?, c.id, ?, ?, ?, ?, ?, 'DISCOVERY', 'PRIVATE', ?, ?, ?, ?, ?
      FROM classes c JOIN schools school ON school.id = c.school_id WHERE ${guard}`,
    params: [id, actorId, input.title, body, document, input.kind ?? "NEWS", input.status, publication.published, publication.date, now, now, ...authParams],
  };
  const results = await batch([
    post,
    { sql: `INSERT INTO audit_logs (id, actor_user_id, school_id, class_id, action, entity_type, entity_id, details_json)
      SELECT ?, ?, c.school_id, c.id, ?, 'post', ?, ? FROM classes c
      WHERE c.id = ? AND changes() > 0`,
      params: [crypto.randomUUID(), actorId, input.id ? "POST_UPDATED" : "POST_CREATED", id,
        JSON.stringify({ category: "DISCOVERY", status: input.status, visibility: "PRIVATE", post_date: publication.date }), input.class_id] },
    attachPostAssets(id, input.class_id, actorId, document),
  ]);
  return !!results[0]?.meta.changes;
}
