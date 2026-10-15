"use client";

import { useActionState, useId, useRef } from "react";
import { updateStudentTask, type StudentTaskState } from "@/app/hoc-sinh/content-actions";

export interface StudentTaskItem {
  id: string;
  title: string;
  details: string;
  completed: boolean;
}

function StudentTaskRow({ task, enrollmentId }: { task: StudentTaskItem; enrollmentId: string }) {
  const inputId = useId();
  const form = useRef<HTMLFormElement>(null);
  const initial: StudentTaskState = { success: false, message: "", completed: task.completed };
  const [state, action, pending] = useActionState(updateStudentTask, initial);

  // React resets successful action forms; keep the checkbox at its confirmed server state.
  return <li className={`student-task-row${state.completed ? " is-complete" : ""}`}>
    <form ref={form} action={action} className="student-task-form" aria-busy={pending}
      onReset={(event) => event.preventDefault()}>
      <input type="hidden" name="task_id" value={task.id} />
      <input type="hidden" name="enrollment_id" value={enrollmentId} />
      <input type="hidden" name="completed" value={String(!state.completed)} />
      <input id={inputId} className="student-task-checkbox" type="checkbox" checked={state.completed}
        disabled={pending} onChange={() => form.current?.requestSubmit()}
        aria-describedby={`${inputId}-status${state.message ? ` ${inputId}-feedback` : ""}`} />
      <label className="student-task-label" htmlFor={inputId}>
        <span className="student-task-title">{task.title}</span>
        {task.details && <span className="student-task-details">{task.details}</span>}
        <span className="student-task-status" id={`${inputId}-status`}>{pending ? "Đang lưu…" : state.completed ? "Em đã làm xong" : "Đánh dấu khi em làm xong"}</span>
      </label>
    </form>
    {state.message && <p id={`${inputId}-feedback`} className="student-task-feedback" role={state.success ? "status" : "alert"}>{state.message}</p>}
  </li>;
}

export function StudentTaskList({ tasks, enrollmentId, today }: { tasks: StudentTaskItem[]; enrollmentId: string; today: string }) {
  return <ul className="student-task-list">{tasks.map((task) => <StudentTaskRow key={`${today}-${task.id}`} task={task} enrollmentId={enrollmentId} />)}</ul>;
}
