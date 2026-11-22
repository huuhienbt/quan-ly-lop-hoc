import { postDateSchema, vietnamToday } from "@/lib/content-schemas";

export function publicationValues(status: "DRAFT" | "PUBLISHED", date: string | undefined, current = new Date()) {
  const today = vietnamToday(current);
  if (date !== undefined && (!postDateSchema.safeParse(date).success || date > today)) return null;
  const time = date && date !== today ? new Date(`${date}T12:00:00+07:00`).toISOString() : current.toISOString();
  return {
    date: date ?? null,
    published: status === "PUBLISHED" ? time : null,
  };
}

// Preserve the original instant if editing on the same displayed calendar day.
export const postDateUpdate = `published_at = CASE WHEN ? IS NULL THEN NULL
  WHEN ? IS NULL OR date(published_at, '+07:00') = ? THEN COALESCE(published_at, ?)
  ELSE ? END, post_date = COALESCE(?, post_date)`;

export function postDateUpdateParams(fields: NonNullable<ReturnType<typeof publicationValues>>) {
  return [fields.published, fields.date, fields.date, fields.published, fields.published, fields.date];
}
