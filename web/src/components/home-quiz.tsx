"use client";

import dynamic from "next/dynamic";

const Quiz = dynamic(() => import("./proverb-quiz").then((module) => module.ProverbQuiz), {
  loading: () => <p role="status">Đang mở đố vui…</p>,
});

export function HomeQuiz() {
  return <div className="proverb-quiz-page"><Quiz /></div>;
}
