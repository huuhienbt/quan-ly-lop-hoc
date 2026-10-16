"use client";

import { useActionState, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { hideChatMessageAction, sendChatMessageAction } from "@/app/chat-actions";
import type { ChatMessage, ChatSnapshot, ChatStudent } from "@/lib/chat-schemas";
import "./class-chat.css";

type ChatProps = {
  mode: "student" | "teacher";
  classId: string;
  enrollmentId?: string;
  students?: ChatStudent[];
};
type Draft = { body: string; request: { body: string; id: string } | null };
type SendState = Awaited<ReturnType<typeof sendChatMessageAction>>;
type HideState = Awaited<ReturnType<typeof hideChatMessageAction>>;
type RoomContext = { mode: ChatProps["mode"]; classId: string; enrollmentId?: string; threadEnrollmentId: string };
type RoomData = ChatSnapshot & { loaded: boolean };
const emptyDraft: Draft = { body: "", request: null };

function chatDate(value: string) {
  const utc = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value) ? `${value.replace(" ", "T")}Z` : value;
  const date = new Date(utc);
  return Number.isNaN(date.getTime()) ? null : date;
}

function messageTime(value: string, includeDate = false) {
  const date = chatDate(value);
  return date ? new Intl.DateTimeFormat("vi-VN", { ...(includeDate ? { day: "2-digit", month: "2-digit" } as const : {}), hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(date) : "";
}

function messageDay(value: string) {
  const date = chatDate(value);
  return date ? new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(date) : "";
}

function ChatIcon({ privateRoom = false }: { privateRoom?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{privateRoom ? <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></> : <><path d="M21 11a8 8 0 0 1-8 8H7l-5 3 1.5-6A8 8 0 1 1 21 11Z" /><path d="M7 10h.01M12 10h.01M17 10h.01" /></>}</svg>;
}

export function ClassChat(props: ChatProps) {
  return <ClassChatWorkspace key={`${props.mode}-${props.classId}-${props.enrollmentId ?? "teacher"}`} {...props} />;
}

function ClassChatWorkspace({ mode, classId, enrollmentId, students = [] }: ChatProps) {
  const prefix = useId();
  const [privateRoom, setPrivateRoom] = useState(false);
  const [roster, setRoster] = useState(students);
  const [rosterReady, setRosterReady] = useState(students.length > 0);
  const [selectedStudent, setSelectedStudent] = useState(students[0]?.enrollment_id ?? "");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const selected = roster.find((student) => student.enrollment_id === selectedStudent) ?? roster[0];
  const threadEnrollmentId = privateRoom ? mode === "student" ? enrollmentId ?? "" : selected?.enrollment_id ?? "" : "";
  const roomKey = threadEnrollmentId || "common";
  const updateDraft = useCallback((key: string, update: (draft: Draft) => Draft) => {
    setDrafts((current) => ({ ...current, [key]: update(current[key] ?? emptyDraft) }));
  }, []);
  const updateRoster = useCallback((next: ChatStudent[]) => {
    setRoster(next);
    setRosterReady(true);
    setSelectedStudent((current) => next.some((student) => student.enrollment_id === current) ? current : next[0]?.enrollment_id ?? "");
  }, []);

  return <div className="class-chat" data-class-chat={mode}>
    <div className="class-chat-tabs" role="group" aria-label="Chọn nơi trò chuyện">
      <button type="button" className={!privateRoom ? "is-active" : ""} aria-pressed={!privateRoom} onClick={() => setPrivateRoom(false)}><ChatIcon /><span>Cả lớp</span></button>
      <button type="button" className={privateRoom ? "is-active" : ""} aria-pressed={privateRoom} disabled={mode === "teacher" && !rosterReady} onClick={() => setPrivateRoom(true)}><ChatIcon privateRoom /><span>{mode === "student" ? "Nhắn riêng với thầy cô" : "Nhắn riêng với học sinh"}</span></button>
    </div>
    {privateRoom && mode === "teacher" && <div className="class-chat-student-picker"><label htmlFor={`${prefix}-student`}>Chọn học sinh để trò chuyện riêng</label><select id={`${prefix}-student`} value={selected?.enrollment_id ?? ""} disabled={!roster.length} onChange={(event) => setSelectedStudent(event.target.value)}>{!roster.length && <option value="">Lớp chưa có học sinh</option>}{roster.map((student) => <option key={student.enrollment_id} value={student.enrollment_id}>{student.student_name}{student.last_message_at ? ` · ${messageTime(student.last_message_at, true)}` : ""}</option>)}</select><p>Các cuộc trò chuyện có tin gần đây được đưa lên đầu danh sách.</p></div>}
    <div className={`class-chat-room-heading${privateRoom ? " is-private" : ""}`}><span className="class-chat-room-icon"><ChatIcon privateRoom={privateRoom} /></span><div><h3>{privateRoom ? mode === "teacher" ? `Trò chuyện với ${selected?.student_name ?? "học sinh"}` : "Góc trò chuyện riêng với thầy cô" : "Phòng chung của lớp"}</h3><p>{privateRoom ? mode === "student" ? "Chỉ em và thầy cô được phân quyền của lớp xem được cuộc trò chuyện này. Các bạn khác không xem được." : "Chỉ học sinh được chọn và thầy cô được phân quyền của lớp xem được cuộc trò chuyện này." : "Cùng hỏi bài, chia sẻ điều hay và gửi lời chào đến thầy cô, các bạn."}</p></div></div>
    {privateRoom && mode === "teacher" && !selected ? <p className="class-chat-unavailable">Khi lớp có học sinh, thầy cô có thể chọn tên để gửi tin nhắn riêng tại đây.</p> : mode === "student" && !enrollmentId ? <p className="class-chat-unavailable">Em đăng nhập và chọn lớp để bắt đầu trò chuyện nhé.</p> : <ChatRoom key={roomKey} mode={mode} classId={classId} enrollmentId={enrollmentId} threadEnrollmentId={threadEnrollmentId} roomKey={roomKey} draft={drafts[roomKey] ?? emptyDraft} updateDraft={updateDraft} updateRoster={updateRoster} />}
  </div>;
}

function ChatContextFields({ mode, classId, enrollmentId, threadEnrollmentId }: RoomContext) {
  return <><input type="hidden" name="mode" value={mode} /><input type="hidden" name="class_id" value={classId} />{enrollmentId && <input type="hidden" name="enrollment_id" value={enrollmentId} />}{threadEnrollmentId && <input type="hidden" name="thread_enrollment_id" value={threadEnrollmentId} />}</>;
}

function HideMessage({ message, context, onHidden }: { message: ChatMessage; context: RoomContext; onHidden: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(async (previous: HideState, formData: FormData): Promise<HideState> => {
    try {
      const result = await hideChatMessageAction(previous, formData);
      if (result.success) { setConfirming(false); onHidden(); }
      return result;
    } catch {
      return { success: false, message: "Chưa ẩn được tin nhắn. Thầy cô thử lại nhé." };
    }
  }, { success: false, message: "" });

  return <div className="class-chat-moderation">{!confirming ? <button type="button" className="class-chat-hide-button" onClick={() => setConfirming(true)} aria-label={`Ẩn tin nhắn của ${message.sender_name}`}>Ẩn tin nhắn</button> : <form action={action} onReset={(event) => event.preventDefault()}><ChatContextFields {...context} /><input type="hidden" name="message_id" value={message.id} /><p>Ẩn nội dung tin nhắn này khỏi cuộc trò chuyện?</p><div><button type="button" disabled={pending} onClick={() => setConfirming(false)}>Giữ lại</button><button type="submit" disabled={pending} className="class-chat-confirm-hide">{pending ? "Đang ẩn…" : "Đồng ý ẩn"}</button></div></form>}{state.message && !state.success && <p className="class-chat-feedback is-error" role="alert">{state.message}</p>}</div>;
}

function mergeMessages(previous: ChatMessage[], incoming: ChatMessage[]) {
  const messages = new Map(previous.map((message) => [message.id, message]));
  for (const message of incoming) messages.set(message.id, message);
  return [...messages.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

function ChatRoom({ mode, classId, enrollmentId, threadEnrollmentId, roomKey, draft, updateDraft, updateRoster }: RoomContext & { roomKey: string; draft: Draft; updateDraft: (key: string, update: (draft: Draft) => Draft) => void; updateRoster: (students: ChatStudent[]) => void }) {
  const prefix = useId();
  const section = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const request = useRef<{ sequence: number; controller: AbortController | null }>({ sequence: 0, controller: null });
  const mounted = useRef(false);
  const currentData = useRef<RoomData>({ messages: [], has_more: false, loaded: false });
  const pendingLatest = useRef<ChatSnapshot | null>(null);
  const expandedHistory = useRef(false);
  const nearBottom = useRef(true);
  const scrollAdjustment = useRef<{ bottom: true } | { height: number; top: number } | null>(null);
  const [data, setData] = useState<RoomData>({ messages: [], has_more: false, loaded: false });
  const [fetching, setFetching] = useState(false);
  const [readError, setReadError] = useState("");
  const [notice, setNotice] = useState("");
  const [newCount, setNewCount] = useState(0);
  const [accessBlocked, setAccessBlocked] = useState(false);
  const context: RoomContext = { mode, classId, enrollmentId, threadEnrollmentId };

  const loadMessages = useCallback(async (kind: "latest" | "older" = "latest", automatic = false) => {
    if (!mounted.current) return;
    if (automatic && request.current.controller) return;
    if (kind === "older" && (request.current.controller || !currentData.current.messages.length)) return;
    request.current.controller?.abort();
    const controller = new AbortController();
    const sequence = ++request.current.sequence;
    request.current.controller = controller;
    setFetching(true);
    if (!automatic) setReadError("");
    const query = new URLSearchParams({ mode, class_id: classId });
    if (enrollmentId) query.set("enrollment_id", enrollmentId);
    if (threadEnrollmentId) query.set("thread_enrollment_id", threadEnrollmentId);
    if (kind === "older") query.set("before_id", currentData.current.messages[0].id);
    let failureMessage = "Kết nối đang gián đoạn. Vui lòng thử cập nhật lại tin nhắn.";
    try {
      const fetchSnapshot = async (parameters: URLSearchParams) => {
        const response = await fetch(`/api/class-chat?${parameters}`, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        const result = await response.json() as ChatSnapshot & { message?: string };
        if (!response.ok) {
          failureMessage = typeof result.message === "string" ? result.message.slice(0, 500) : "Chưa tải được tin nhắn. Vui lòng thử lại.";
          if ((response.status === 401 || response.status === 403) && !controller.signal.aborted && sequence === request.current.sequence) {
            const cleared = { messages: [], has_more: false, loaded: true };
            currentData.current = cleared;
            pendingLatest.current = null;
            expandedHistory.current = false;
            setData(cleared);
            setNewCount(0);
            setAccessBlocked(true);
          }
          throw new Error("chat-read-failed");
        }
        return result;
      };
      const result = await fetchSnapshot(query);
      if (controller.signal.aborted || sequence !== request.current.sequence) return;
      const previous = currentData.current;
      let visibleHistory: ChatMessage[] = [];
      // Refresh the older messages actually on screen without polling every loaded page.
      if (kind === "latest" && previous.messages.length > 0 && viewport.current) {
        const bounds = viewport.current.getBoundingClientRect();
        const visibleIds = Array.from(viewport.current.querySelectorAll<HTMLElement>("[data-chat-message]")).filter((element) => {
          const rectangle = element.getBoundingClientRect();
          return rectangle.bottom > bounds.top && rectangle.top < bounds.bottom;
        }).map((element) => element.dataset.chatMessage);
        const latestIds = new Set(result.messages.map((message) => message.id));
        if (visibleIds.some((id) => id && !latestIds.has(id))) {
          const lastVisibleId = visibleIds[visibleIds.length - 1];
          if (lastVisibleId) {
            const olderQuery = new URLSearchParams(query);
            olderQuery.set("through_id", lastVisibleId);
            visibleHistory = (await fetchSnapshot(olderQuery)).messages;
          }
        }
      }
      if (controller.signal.aborted || sequence !== request.current.sequence) return;
      const hasGap = kind === "latest" && previous.messages.length > 0 && result.messages.length > 0 && !result.messages.some((message) => previous.messages.some((item) => item.id === message.id));
      const newMessages = result.messages.filter((message) => !previous.messages.some((item) => item.id === message.id));
      if (kind === "older") {
        expandedHistory.current = true;
        if (viewport.current) scrollAdjustment.current = { height: viewport.current.scrollHeight, top: viewport.current.scrollTop };
      } else if (hasGap) {
        pendingLatest.current = result;
        setNewCount(result.messages.length);
      } else if (!previous.loaded || nearBottom.current) {
        pendingLatest.current = null;
        scrollAdjustment.current = { bottom: true };
        setNewCount(0);
      } else if (newMessages.length) {
        setNewCount((count) => count + newMessages.length);
      }
      const next = { messages: mergeMessages(previous.messages, hasGap ? visibleHistory : [...result.messages, ...visibleHistory]), has_more: hasGap ? previous.has_more : kind === "older" || !expandedHistory.current ? result.has_more : previous.has_more, loaded: true };
      currentData.current = next;
      setData(next);
      setReadError("");
      setAccessBlocked(false);
      if (mode === "teacher" && result.students) updateRoster(result.students);
      if (!automatic) setNotice(kind === "older" ? newMessages.length ? "Đã tải thêm tin nhắn trước." : "Đã xem hết tin nhắn trước." : "Đã cập nhật tin nhắn.");
    } catch {
      if (controller.signal.aborted || sequence !== request.current.sequence) return;
      setReadError(failureMessage);
    } finally {
      if (sequence === request.current.sequence) { request.current.controller = null; setFetching(false); }
    }
  }, [mode, classId, enrollmentId, threadEnrollmentId, updateRoster]);

  useEffect(() => {
    mounted.current = true;
    const activeRequest = request.current;
    let onscreen = false;
    const refreshIfVisible = () => { if (!document.hidden && onscreen) void loadMessages("latest", true); };
    const observer = new IntersectionObserver((entries) => {
      const wasOnscreen = onscreen;
      onscreen = entries.some((entry) => entry.isIntersecting);
      if (onscreen && !wasOnscreen) refreshIfVisible();
    }, { threshold: 0 });
    if (section.current) observer.observe(section.current);
    document.addEventListener("visibilitychange", refreshIfVisible);
    const timer = window.setInterval(refreshIfVisible, 10_000);
    return () => {
      mounted.current = false;
      observer.disconnect();
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.clearInterval(timer);
      activeRequest.sequence++;
      activeRequest.controller?.abort();
      activeRequest.controller = null;
    };
  }, [loadMessages]);

  useLayoutEffect(() => {
    const adjustment = scrollAdjustment.current;
    const element = viewport.current;
    if (!element || !adjustment) return;
    element.scrollTop = "bottom" in adjustment ? element.scrollHeight : adjustment.top + element.scrollHeight - adjustment.height;
    scrollAdjustment.current = null;
  }, [data.messages]);

  const [sendState, sendAction, sending] = useActionState(async (previous: SendState, formData: FormData): Promise<SendState> => {
    const submittedBody = String(formData.get("body") ?? "");
    if (!submittedBody.trim()) return { success: false, message: "Em viết nội dung trước khi gửi nhé." };
    const clientId = draft.request?.body === submittedBody ? draft.request.id : crypto.randomUUID();
    formData.set("client_message_id", clientId);
    updateDraft(roomKey, (current) => current.body === submittedBody ? { ...current, request: { body: submittedBody, id: clientId } } : current);
    try {
      const result = await sendChatMessageAction(previous, formData);
      if (result.success) {
        updateDraft(roomKey, (current) => current.body === submittedBody ? emptyDraft : current);
        void loadMessages();
      }
      return result;
    } catch {
      return { success: false, message: "Chưa xác nhận được tin nhắn đã gửi. Nội dung vẫn được giữ lại; hãy thử gửi lại khi kết nối ổn định." };
    }
  }, { success: false, message: "" });

  function jumpToLatest() {
    const latest = pendingLatest.current;
    if (latest) {
      const next = { ...latest, loaded: true };
      request.current.sequence++;
      request.current.controller?.abort();
      request.current.controller = null;
      setFetching(false);
      pendingLatest.current = null;
      expandedHistory.current = false;
      currentData.current = next;
      scrollAdjustment.current = { bottom: true };
      setData(next);
      setNotice("Đã mở tin mới nhất. Chọn Xem tin nhắn trước để xem lại các tin cũ.");
    } else if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
    nearBottom.current = true;
    setNewCount(0);
  }

  return <div ref={section} className="class-chat-room" data-chat-room={threadEnrollmentId ? "private" : "common"}>
    <div className="class-chat-toolbar"><span><span className="class-chat-status-dot" aria-hidden="true" />Tin mới tự cập nhật khi mở mục này</span><button type="button" disabled={fetching} onClick={() => void loadMessages()} aria-label="Cập nhật tin nhắn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 18 17" /></svg><span>{fetching ? "Đang tải…" : "Cập nhật"}</span></button></div>
    <div ref={viewport} className="class-chat-messages" role="region" aria-label={threadEnrollmentId ? "Tin nhắn riêng" : "Tin nhắn cả lớp"} tabIndex={0} onScroll={() => {
      const element = viewport.current;
      if (!element) return;
      nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 64;
      if (nearBottom.current && !pendingLatest.current) setNewCount(0);
    }}>
      {data.has_more && <div className="class-chat-older"><button type="button" disabled={fetching} onClick={() => void loadMessages("older")}>Xem tin nhắn trước</button></div>}
      {!data.loaded && <p className="class-chat-loading">{readError ? "Tin nhắn sẽ hiện khi kết nối trở lại." : "Đang mở cuộc trò chuyện…"}</p>}
      {data.loaded && !data.messages.length && <div className="class-chat-empty"><span aria-hidden="true"><ChatIcon privateRoom={!!threadEnrollmentId} /></span><strong>{accessBlocked ? "Cuộc trò chuyện đang tạm đóng" : threadEnrollmentId ? "Một lời nhắn, thêm gần nhau" : "Lớp mình cùng bắt đầu nhé!"}</strong><p>{accessBlocked ? "Vui lòng kiểm tra tài khoản hoặc đăng nhập lại để tiếp tục." : threadEnrollmentId ? mode === "student" ? "Em có câu hỏi hoặc điều muốn chia sẻ? Viết lời nhắn cho thầy cô bên dưới nhé." : "Thầy cô có thể gửi lời hỏi thăm hoặc hỗ trợ riêng cho học sinh tại đây." : "Gửi một lời chào, hỏi điều em chưa hiểu hoặc chia sẻ một việc tốt hôm nay."}</p></div>}
      <ol className="class-chat-message-list">{data.messages.map((message, index) => {
        const day = messageDay(message.created_at);
        return <li className={`class-chat-message-row${message.is_own ? " is-own" : ""}${message.is_hidden ? " is-hidden" : ""}`} key={message.id} data-chat-message={message.id}>
          {(index === 0 || day !== messageDay(data.messages[index - 1].created_at)) && <div className="class-chat-date"><span>{day}</span></div>}
          <article className="class-chat-message"><span className={`class-chat-avatar${message.sender_kind === "TEACHER" ? " is-teacher" : ""}`} aria-hidden="true">{Array.from(message.sender_name.trim())[0] ?? "•"}</span><div className="class-chat-message-content"><div className="class-chat-message-meta"><strong>{message.sender_name}</strong>{message.sender_kind === "TEACHER" && <span className="class-chat-role">Thầy cô</span>}{message.is_own && <span className="class-chat-own-label">{mode === "student" ? "Em" : "Tôi"}</span>}<time dateTime={chatDate(message.created_at)?.toISOString()} title={messageTime(message.created_at, true)}>{messageTime(message.created_at)}</time></div><p className="class-chat-message-body">{message.is_hidden ? "Tin nhắn đã được thầy cô ẩn." : message.body}</p>{mode === "teacher" && !message.is_hidden && <HideMessage message={message} context={context} onHidden={() => {
            // Acknowledge moderation immediately, including rows beyond the latest page.
            request.current.sequence++;
            request.current.controller?.abort();
            request.current.controller = null;
            if (pendingLatest.current) pendingLatest.current = { ...pendingLatest.current, messages: pendingLatest.current.messages.map((item) => item.id === message.id ? { ...item, is_hidden: true, body: "" } : item) };
            const next = { ...currentData.current, messages: currentData.current.messages.map((item) => item.id === message.id ? { ...item, is_hidden: true, body: "" } : item) };
            currentData.current = next;
            setData(next);
            void loadMessages();
          }} />}</div></article>
        </li>;
      })}</ol>
    </div>
    {newCount > 0 && <div className="class-chat-new-messages"><button type="button" onClick={jumpToLatest}>Có tin mới · Xem tin mới nhất<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14m-6-6 6 6 6-6" /></svg></button></div>}
    {readError && <p className="class-chat-feedback is-error" role="alert">{readError}</p>}
    <form ref={form} action={sendAction} onReset={(event) => event.preventDefault()} className="class-chat-compose" aria-busy={sending}>
      <ChatContextFields {...context} />
      <label htmlFor={`${prefix}-body`}>{threadEnrollmentId ? mode === "student" ? "Lời nhắn của em gửi thầy cô" : "Lời nhắn gửi học sinh" : mode === "student" ? "Em muốn chia sẻ điều gì?" : "Lời nhắn gửi cả lớp"}</label>
      <textarea id={`${prefix}-body`} name="body" value={draft.body} readOnly={accessBlocked} required maxLength={2000} rows={3} placeholder={threadEnrollmentId ? "Viết lời nhắn riêng tại đây…" : "Gửi một lời chào, câu hỏi hay điều em muốn chia sẻ…"} aria-describedby={`${prefix}-help ${prefix}-count`} onChange={(event) => {
        const body = event.target.value;
        updateDraft(roomKey, (current) => ({ body, request: current.request?.body === body ? current.request : null }));
      }} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !sending && !accessBlocked && draft.body.trim()) { event.preventDefault(); form.current?.requestSubmit(); } }} />
      <div className="class-chat-compose-footer"><p id={`${prefix}-help`}>Nói lời tử tế, lắng nghe và tôn trọng nhau nhé.</p><span id={`${prefix}-count`} className="class-chat-character-count">{draft.body.length}/2.000</span><button type="submit" disabled={sending || accessBlocked || !draft.body.trim()} className="class-chat-send">{sending ? "Đang gửi…" : "Gửi tin nhắn"}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg></button></div>
      {sendState.message && <p className={`class-chat-feedback${sendState.success ? " is-success" : " is-error"}`} role={sendState.success ? "status" : "alert"}>{sendState.message}</p>}
    </form>
    <p className="class-chat-announcement sr-only" aria-live="polite" aria-atomic="true">{notice}</p>
  </div>;
}
