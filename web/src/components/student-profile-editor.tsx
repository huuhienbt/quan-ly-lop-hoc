"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { updateStudentProfile } from "@/app/hoc-sinh/thong-tin/actions";
import { AVATAR_FILE_TYPES, AVATAR_SIZE, MAX_AVATAR_SOURCE_BYTES, MAX_AVATAR_UPLOAD_BYTES,
  genderLabels, studentGenders, type StudentEditableProfile } from "@/lib/student-profile-options";

export function StudentProfileAvatar({ name, src }: { name: string; src: string | null }) {
  const [failed, setFailed] = useState("");
  return <span className="student-profile-avatar student-profile-avatar-large">
    {src && src !== failed
      ? <Image src={src} alt="Ảnh đại diện" width={88} height={88} unoptimized onError={() => setFailed(src)} />
      : <span aria-hidden="true">{Array.from(name.trim())[0]?.toLocaleUpperCase("vi") ?? "H"}</span>}
  </span>;
}

async function prepareAvatar(file: File): Promise<File> {
  if (!file.size || file.size > MAX_AVATAR_SOURCE_BYTES) throw new Error("Em hãy chọn ảnh có dung lượng không quá 2 MB.");
  if (!AVATAR_FILE_TYPES.some(type => type === file.type.toLowerCase())) {
    throw new Error("Em hãy chọn ảnh JPG, PNG hoặc WebP. Ảnh HEIC cần đổi sang JPG trước.");
  }
  let picture: { source: CanvasImageSource; width: number; height: number; close: () => void };
  try {
    const bitmap = typeof createImageBitmap === "function" ? await createImageBitmap(file).catch(() => null) : null;
    if (bitmap) picture = { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    else {
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      try {
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error());
          img.src = url;
        });
        picture = { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
      } catch {
        URL.revokeObjectURL(url);
        throw new Error();
      }
    }
  } catch {
    throw new Error("Không đọc được ảnh này. Em hãy chọn ảnh khác.");
  }
  try {
    if (!picture.width || !picture.height || picture.width * picture.height > 25_000_000) {
      throw new Error("Kích thước ảnh quá lớn. Em hãy chọn ảnh khác.");
    }
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Trình duyệt chưa xử lý được ảnh.");
    const edge = Math.min(picture.width, picture.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    context.drawImage(picture.source, (picture.width - edge) / 2, (picture.height - edge) / 2, edge, edge, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    for (const quality of [0.86, 0.7, 0.55]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.type === "image/jpeg" && blob.size <= MAX_AVATAR_UPLOAD_BYTES) {
        return new File([blob], "avatar.jpg", { type: "image/jpeg" });
      }
    }
    throw new Error("Chưa thu nhỏ được ảnh. Em hãy chọn ảnh khác.");
  } finally {
    picture.close();
  }
}

function StudentProfileFields({ profile, onCancel, onSaved }: {
  profile: StudentEditableProfile; onCancel: () => void; onSaved: (message: string) => void;
}) {
  const id = useId();
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [intent, setIntent] = useState<"keep" | "replace" | "remove">("keep");
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const previewRef = useRef<string | null>(null);
  const selectionRef = useRef(0);

  useEffect(() => () => {
    selectionRef.current++;
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  function clearPhoto() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPhoto(null);
  }

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const source = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!source || saving || processing) return;
    const selection = ++selectionRef.current;
    clearPhoto();
    setIntent("keep");
    setError("");
    setProcessing(true);
    try {
      const file = await prepareAvatar(source);
      if (selection !== selectionRef.current) return;
      clearPhoto();
      const url = URL.createObjectURL(file);
      previewRef.current = url;
      setPhoto({ file, url });
      setIntent("replace");
    } catch (cause) {
      if (selection === selectionRef.current) setError(cause instanceof Error ? cause.message : "Không đọc được ảnh.");
    } finally {
      if (selection === selectionRef.current) setProcessing(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (processing || saving) return;
    const payload = new FormData(event.currentTarget);
    if (intent === "replace" && photo) payload.set("avatar", photo.file);
    setSaving(true);
    setError("");
    try {
      const result = await updateStudentProfile(payload);
      if (result.success) onSaved(result.message);
      else setError(result.message);
    } catch {
      setError("Chưa xác nhận được kết quả lưu. Em hãy tải lại trang rồi kiểm tra nhé.");
    } finally {
      setSaving(false);
    }
  }

  const avatar = intent === "remove" ? null : photo?.url ?? profile.avatarUrl;

  return <form className="student-profile-editor" onSubmit={event => void save(event)} aria-busy={processing || saving}>
    <input type="hidden" name="enrollment_id" value={profile.enrollmentId} />
    <input type="hidden" name="revision" value={profile.revision} />
    <input type="hidden" name="avatar_intent" value={intent} />
    <fieldset disabled={processing || saving} className="student-profile-fields">
      <legend className="sr-only">Chỉnh sửa thông tin và ảnh đại diện</legend>
      <div className="student-avatar-edit">
        <StudentProfileAvatar name={profile.fullName} src={avatar} />
        <div className="student-avatar-controls">
          <label htmlFor={`${id}-photo`} className="button button-outline button-small">Chọn ảnh đại diện</label>
          <input id={`${id}-photo`} className="student-avatar-input" type="file" accept="image/jpeg,image/png,image/webp"
            onChange={event => void choosePhoto(event)} aria-describedby={`${id}-limit`} />
          {avatar && <button className="button button-quiet button-small" type="button" onClick={() => {
            clearPhoto(); setIntent("remove"); setError("");
          }}>Bỏ ảnh</button>}
          <p id={`${id}-limit`}>JPG, PNG hoặc WebP · tối đa 2 MB.</p>
          {photo && <p>Ảnh đã được thu nhỏ, sẵn sàng để lưu.</p>}
        </div>
      </div>
      <label className="student-field"><span>Tên hiển thị</span>
        <input name="display_name" defaultValue={profile.displayName ?? ""} placeholder={profile.fullName} maxLength={60} autoComplete="off" />
      </label>
      <div className="student-profile-edit-row">
        <label className="student-field"><span>Ngày sinh</span>
          <input name="date_of_birth" type="date" defaultValue={profile.dateOfBirth ?? ""} min="1900-01-01" max={profile.maxBirthDate} />
        </label>
        <label className="student-field"><span>Giới tính</span>
          <select name="gender" defaultValue={profile.gender}>
            {(["UNSPECIFIED", ...studentGenders.filter(value => value !== "UNSPECIFIED")] as const).map(value =>
              <option value={value} key={value}>{genderLabels[value]}</option>)}
          </select>
        </label>
      </div>
      <p className="student-field-help">Tên hiển thị được dùng trong trang lớp và trò chuyện. Nếu bỏ trống, website dùng họ tên chính thức.</p>
      <div className="student-profile-edit-actions">
        <button type="button" className="button button-outline button-small" onClick={onCancel}>Hủy</button>
        <button type="submit" className="button button-primary button-small">{saving ? "Đang lưu…" : "Lưu thông tin"}</button>
      </div>
    </fieldset>
    {processing && <p className="student-field-help" role="status">Đang chuẩn bị ảnh…</p>}
    {error && <p className="form-message is-error" role="alert">{error}</p>}
  </form>;
}

export function StudentProfileEditor({ profile }: { profile: StudentEditableProfile }) {
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState("");
  return editing ? <StudentProfileFields profile={profile} onCancel={() => setEditing(false)}
    onSaved={message => { setFeedback(message); setEditing(false); }} />
    : <div className="student-profile-edit-footer">
      <button type="button" className="button button-outline button-small" onClick={() => { setFeedback(""); setEditing(true); }}>
        Chỉnh sửa thông tin
      </button>
      {feedback && <p className="form-message is-success" role="status">{feedback}</p>}
    </div>;
}
