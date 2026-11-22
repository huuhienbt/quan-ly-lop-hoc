export const postAssetGuard = `AND NOT EXISTS (
    SELECT 1 FROM json_each(?) block
    WHERE json_extract(block.value, '$.assetId') IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM lesson_assets a WHERE a.id = json_extract(block.value, '$.assetId')
      AND a.class_id = c.id AND a.ready = 1 AND (
        a.post_id = ? OR (a.post_id IS NULL AND a.uploaded_by = ?))
      AND a.mime = CASE json_extract(block.value, '$.type') WHEN 'image' THEN 'image/webp' ELSE 'application/pdf' END
    )
  )`;

// Call immediately after the audit write, in the same atomic batch as the post.
export function attachPostAssets(id: string, classId: string, actorId: string, document: string) {
  return {
    sql: `UPDATE lesson_assets SET post_id = ?
      WHERE changes() > 0 AND class_id = ? AND ready = 1 AND post_id IS NULL AND uploaded_by = ?
      AND id IN (SELECT json_extract(value, '$.assetId') FROM json_each(?))`,
    params: [id, classId, actorId, document],
  };
}
