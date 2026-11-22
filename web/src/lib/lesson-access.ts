export const lessonClassActive = "c.archived_at IS NULL AND school.archived_at IS NULL";
export const lessonStaffAccess = `EXISTS (
  SELECT 1 FROM users actor WHERE actor.id = ? AND actor.status = 'ACTIVE'
    AND actor.email_verified_at IS NOT NULL
    AND (actor.role = 'SUPER_ADMIN' OR (actor.role = 'TEACHER' AND EXISTS (
      SELECT 1 FROM class_teachers assignment WHERE assignment.class_id = c.id
        AND assignment.user_id = actor.id AND assignment.ended_at IS NULL
    )))
)`;
export const lessonStudentAccess = `EXISTS (
  SELECT 1 FROM student_accounts login
  JOIN student_account_students link ON link.account_id = login.id
  JOIN students pupil ON pupil.id = link.student_id AND pupil.archived_at IS NULL
  JOIN student_enrollments enrollment ON enrollment.student_id = pupil.id
    AND enrollment.school_id = pupil.school_id AND enrollment.status = 'ACTIVE'
  WHERE login.id = ? AND login.session_version = ? AND login.status = 'ACTIVE'
    AND login.must_change_password = 0 AND enrollment.class_id = c.id
    AND enrollment.school_id = c.school_id AND enrollment.academic_year_id = c.academic_year_id
)`;
