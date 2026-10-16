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
        <Brand />
        <nav aria-label="Điều hướng trò chơi">
          <Link href="/">Trang chủ</Link>
          <Link href="/hoc-sinh" className="proverb-quiz-student-link">Góc học sinh <span aria-hidden="true">→</span></Link>
        </nav>
      </header>
      <main id="noi-dung" className="proverb-quiz-main">
        <section className="proverb-quiz-intro" aria-labelledby="proverb-page-title">
          <div>
            <p className="proverb-quiz-kicker">VUI HỌC MỖI NGÀY · TIẾNG VIỆT LỚP 4</p>
            <h1 id="proverb-page-title">Đố vui ca dao,<br /><span>tục ngữ Việt Nam</span></h1>
            <p>Lời hay ông bà để lại, em mang theo mỗi ngày. Cùng tìm hiểu về lòng biết ơn, tình yêu thương và sự chăm chỉ nhé!</p>
          </div>
          <div className="proverb-quiz-intro-art" aria-hidden="true"><span>🌿</span><span>📖</span><span>✨</span></div>
        </section>
        <ProverbQuiz />
        <aside className="proverb-quiz-family-note"><span aria-hidden="true">💛</span><p><strong>Học cùng nhau vui hơn.</strong> Sau lượt chơi, em hãy chọn một câu yêu thích để kể cho ba mẹ hoặc thầy cô nghe nhé!</p></aside>
      </main>
      <footer className="proverb-quiz-footer"><p>Lớp học hạnh phúc · Trường Tiểu học Bến Tre</p><Link href="/">Về trang chủ <span aria-hidden="true">↗</span></Link></footer>
    </div>
  );
}
