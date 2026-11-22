"use client";
import dynamic from "next/dynamic";

const ClassChat = dynamic(() => import("@/components/class-chat").then(module => module.ClassChat), {
  loading: () => <p role="status">Đang mở trò chuyện…</p>,
});

export function TeacherHomeChat({ classId }: { classId: string }) {
  return <ClassChat key={classId} classId={classId} mode="teacher" />;
}
