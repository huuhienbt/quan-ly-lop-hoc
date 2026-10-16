import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import "./learning-game-card.css";

function StorybookIcon() {
  return (
    <svg viewBox="0 0 112 112" fill="none" aria-hidden="true" focusable="false">
      <ellipse cx="55" cy="98" rx="39" ry="6" fill="#bddfce" />
      <path d="M13 35c16-7 30-4 42 3 13-7 28-10 44-3v51c-16-6-31-3-44 4-13-7-26-10-42-4V35Z" fill="#fffdf4" stroke="#237c6e" strokeWidth="3" strokeLinejoin="round" />
      <path d="M20 43c12-4 23-1 30 3v34c-10-5-20-6-30-3V43Z" fill="#fce4a1" />
      <path d="M60 46c10-5 20-7 32-3v34c-12-3-22-1-32 3V46Z" fill="#d8f0e3" />
      <path d="M55 40v49M26 57l17 3M26 65l17 3M67 61l17-3M67 69l17-3" stroke="#237c6e" strokeWidth="3" strokeLinecap="round" />
      <path d="m35 15 2.2 5.4 5.8.5-4.4 3.9 1.4 5.7-5-3-5 3 1.4-5.7-4.4-3.9 5.8-.5L35 15Z" fill="#e5ad25" />
      <circle cx="88" cy="26" r="18" fill="#f7b7cf" stroke="#fffdf4" strokeWidth="4" />
      <path d="M84 22a4 4 0 0 1 8 0c0 3-4 3-4 6M88 33v.2" stroke="#7d3c60" strokeWidth="3" strokeLinecap="round" />
      <path d="M10 19v8M6 23h8M103 63v8M99 67h8" stroke="#e5ad25" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function LearningGameCard({ compact = false }: { compact?: boolean } = {}) {
  return (
    <section className={`learning-game-card${compact ? " learning-game-card-compact" : ""}`} aria-label="Vui học mỗi ngày">
      <div className="learning-game-card-art"><StorybookIcon /></div>
      <div className="learning-game-card-copy">
        <p className="learning-game-card-label"><span aria-hidden="true">✦</span> Vui học mỗi ngày</p>
        <h2 className="learning-game-card-title">Đố vui ca dao, tục ngữ Việt Nam</h2>
        <p className="learning-game-card-description">Điền từ, hiểu ý nghĩa và chọn cách ứng xử qua 5 câu hỏi mỗi lượt.</p>
        {!compact && <div className="learning-game-card-topics" aria-label="Nội dung trò chơi"><span>Điền từ</span><span>Hiểu ý nghĩa</span><span>Ứng xử đẹp</span></div>}
      </div>
      <Link className="learning-game-card-button" href="/tro-choi/ca-dao-tuc-ngu">Chơi đố vui <ArrowIcon /></Link>
    </section>
  );
}
