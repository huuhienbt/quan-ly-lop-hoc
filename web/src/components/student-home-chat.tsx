"use client";

import dynamic from "next/dynamic";

const Chat = dynamic(() => import("./class-chat").then((module) => module.ClassChat), {
  loading: () => <p role="status">Đang mở trò chuyện…</p>,
});

export function StudentHomeChat({ classId, enrollmentId }: { classId: string; enrollmentId: string }) {
  return <Chat mode="student" classId={classId} enrollmentId={enrollmentId} />;
}
