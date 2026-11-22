import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { ProverbQuiz } from "@/components/proverb-quiz";
import "./quiz.css";

export const metadata: Metadata = {
  title: "Đố vui ca dao, tục ngữ Việt Nam",
  description: "Vui học ca dao, tục ngữ Việt Nam qua câu hỏi điền từ, tìm ý nghĩa và tình huống gần gũi dành cho học sinh tiểu học.",
};

export default function ProverbQuizPage() {
  return (
    <div className="proverb-quiz-page">
      <header className="proverb-quiz-header">
        <Brand compact />
        <nav aria-label="Điều hướng trò chơi">
          <Link href="/"><span aria-hidden="true">←</span> Trang chủ</Link>
        </nav>
      </header>
      <main id="noi-dung" className="proverb-quiz-main">
        <ProverbQuiz />
      </main>
      <footer className="proverb-quiz-footer">
        <span>Bốn 12 · Trường Tiểu học Bến Tre</span>
        <Link href="/hoc-sinh">Góc học sinh <span aria-hidden="true">↗</span></Link>
      </footer>
    </div>
  );
}
