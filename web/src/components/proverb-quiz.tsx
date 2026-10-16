"use client";

import { useEffect, useRef, useState } from "react";
import { createProverbRound, proverbQuestions, type ProverbQuestion } from "@/lib/proverb-quiz";

type PracticeKind = "all" | ProverbQuestion["kind"];
type Answer = { selectedIndex: number; correct: boolean };

const practiceKinds: { value: PracticeKind; icon: string; label: string; description: string }[] = [
  { value: "all", icon: "🌈", label: "Thử sức tổng hợp", description: "Kết hợp cả ba kiểu câu hỏi" },
  { value: "missing", icon: "🧩", label: "Điền từ còn thiếu", description: "Tìm mảnh ghép cho câu nói" },
  { value: "meaning", icon: "📖", label: "Hiểu lời ông bà", description: "Khám phá ý nghĩa câu ca" },
  { value: "situation", icon: "🌱", label: "Em chọn câu nào?", description: "Vận dụng vào chuyện hằng ngày" },
];

export function ProverbQuiz() {
  const [kind, setKind] = useState<PracticeKind>("all");
  const [phase, setPhase] = useState<"start" | "playing" | "result">("start");
  const [round, setRound] = useState<ProverbQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const startHeading = useRef<HTMLHeadingElement>(null);
  const hasStarted = useRef(false);

  const question = round[questionIndex];
  const checked = answers.length > questionIndex;
  const score = answers.filter((answer) => answer.correct).length;

  useEffect(() => {
    if (phase === "playing") {
      if (checked) feedback.current?.focus();
      else questionHeading.current?.focus();
    } else if (phase === "result") {
      resultHeading.current?.focus();
    } else if (hasStarted.current) {
      startHeading.current?.focus();
    }
  }, [phase, questionIndex, checked]);

  function startRound() {
    // Randomness begins with a click, so the server and first client render agree.
    setRound(createProverbRound({ kind, size: 5 }));
    setAnswers([]);
    setSelectedIndex(null);
    setQuestionIndex(0);
    hasStarted.current = true;
    setPhase("playing");
  }

  function checkAnswer() {
    if (!question || checked || selectedIndex === null) return;
    setAnswers((previous) => {
      // Keep one answer per question, including repeated clicks before a repaint.
      if (previous.length !== questionIndex) return previous;
      return [...previous, { selectedIndex, correct: selectedIndex === question.correctIndex }];
    });
  }

  function nextQuestion() {
    if (!checked) return;
    if (questionIndex === round.length - 1) {
      setPhase("result");
    } else {
      setSelectedIndex(null);
      setQuestionIndex(questionIndex + 1);
    }
  }

  return (
    <section className="proverb-quiz-game" aria-label="Trò chơi đố vui ca dao, tục ngữ">
      {phase === "start" && (
        <div className="proverb-quiz-start">
          <div className="proverb-quiz-section-heading">
            <span className="proverb-quiz-round-icon" aria-hidden="true">📚</span>
            <div>
              <p className="proverb-quiz-kicker">MỘT CHÚT VUI HỌC MỖI NGÀY</p>
              <h2 ref={startHeading} tabIndex={-1}>Em muốn khám phá theo cách nào?</h2>
              <p>Mỗi lượt có 5 câu hỏi. Chọn đáp án, đọc lời giải rồi cùng thử câu tiếp theo nhé!</p>
            </div>
          </div>
          <fieldset className="proverb-quiz-kinds">
            <legend>Chọn kiểu luyện tập</legend>
            {practiceKinds.map((item) => (
              <label key={item.value} className={`proverb-quiz-kind${kind === item.value ? " is-selected" : ""}`}>
                <input type="radio" name="practice-kind" value={item.value} checked={kind === item.value} onChange={() => setKind(item.value)} />
                <span className="proverb-quiz-kind-icon" aria-hidden="true">{item.icon}</span>
                <span><strong>{item.label}</strong><small>{item.description}</small></span>
              </label>
            ))}
          </fieldset>
          <div className="proverb-quiz-start-footer">
            <span><strong>{proverbQuestions.length} câu hỏi</strong> · 5 câu mỗi lượt · Không giới hạn thời gian</span>
            <button className="proverb-quiz-primary" type="button" onClick={startRound}>Bắt đầu chơi <span aria-hidden="true">→</span></button>
          </div>
        </div>
      )}

      {phase === "playing" && question && (
        <div className="proverb-quiz-round">
          <div className="proverb-quiz-progress-heading">
            <p role="status">Câu <strong>{questionIndex + 1}</strong> / {round.length}</p>
            <span>{practiceKinds.find((item) => item.value === question.kind)?.label}</span>
          </div>
          <progress className="proverb-quiz-progress" value={answers.length} max={round.length} aria-label={`Đã trả lời ${answers.length} trên ${round.length} câu`} />
          <div className="proverb-quiz-question-heading">
            <span className="proverb-quiz-topic">{question.topic}</span>
            <h2 id="proverb-current-question" ref={questionHeading} tabIndex={-1}>{question.prompt}</h2>
            <p id="proverb-answer-help">Chọn một đáp án, rồi bấm “Kiểm tra đáp án”.</p>
          </div>
          <fieldset className="proverb-quiz-options" disabled={checked} aria-labelledby="proverb-current-question" aria-describedby="proverb-answer-help">
            <legend className="proverb-quiz-sr-only">Đáp án của em</legend>
            {question.options.map((option, index) => {
              const isCorrect = checked && index === question.correctIndex;
              const isWrong = checked && index === selectedIndex && !isCorrect;
              return (
                <label key={`${question.id}-${index}`} className={`proverb-quiz-option${selectedIndex === index ? " is-selected" : ""}${isCorrect ? " is-correct" : ""}${isWrong ? " is-wrong" : ""}`}>
                  <input type="radio" name={`answer-${question.id}`} value={index} checked={selectedIndex === index} onChange={() => setSelectedIndex(index)} />
                  <span className="proverb-quiz-option-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
                  <span className="proverb-quiz-option-text">{option}</span>
                  {isCorrect && <span className="proverb-quiz-answer-mark"><span aria-hidden="true">✓ </span>Đáp án đúng</span>}
                  {isWrong && <span className="proverb-quiz-answer-mark"><span aria-hidden="true">↻ </span>Em đã chọn</span>}
                </label>
              );
            })}
          </fieldset>
          {checked && (
            <div ref={feedback} tabIndex={-1} className={`proverb-quiz-feedback${answers[questionIndex].correct ? " is-correct" : " is-learning"}`}>
              <h3>{answers[questionIndex].correct ? "✓ Đúng rồi, em giỏi lắm!" : "Cùng tìm hiểu thêm nhé!"}</h3>
              {!answers[questionIndex].correct && <p><strong>Đáp án đúng:</strong> {question.options[question.correctIndex]}</p>}
              <blockquote>{question.saying}</blockquote>
              <p>{question.explanation}</p>
            </div>
          )}
          <div className="proverb-quiz-round-footer">
            <span>{checked ? "Đọc lời giải để nhớ lâu hơn nhé." : "Em cứ suy nghĩ, không cần vội."}</span>
            {checked ? <button className="proverb-quiz-primary" type="button" onClick={nextQuestion}>{questionIndex === round.length - 1 ? "Xem kết quả" : "Câu tiếp theo"} <span aria-hidden="true">→</span></button> : <button className="proverb-quiz-primary" type="button" disabled={selectedIndex === null} onClick={checkAnswer}>Kiểm tra đáp án</button>}
          </div>
        </div>
      )}

      {phase === "result" && (
        <div className="proverb-quiz-result">
          <div className="proverb-quiz-result-header">
            <span className="proverb-quiz-result-icon" aria-hidden="true">{score === round.length ? "🌟" : "🌻"}</span>
            <p className="proverb-quiz-kicker">EM ĐÃ HOÀN THÀNH MỘT LƯỢT CHƠI</p>
            <h2 ref={resultHeading} tabIndex={-1}>{score === round.length ? "Tuyệt lắm, nhà khám phá nhỏ!" : "Mỗi câu ca, thêm một điều hay!"}</h2>
            <p className="proverb-quiz-score">Em trả lời đúng <strong>{score}/{round.length}</strong> câu</p>
            <p>{score === round.length ? "Em đã hiểu thêm những lời hay của ông bà. Cùng khám phá những câu mới nhé!" : "Em đã rất cố gắng! Cùng đọc lại lời giải để hiểu và nhớ lâu hơn nhé."}</p>
            <div className="proverb-quiz-result-actions">
              <button className="proverb-quiz-primary" type="button" onClick={startRound}>Chơi lượt mới <span aria-hidden="true">↻</span></button>
              <button className="proverb-quiz-secondary" type="button" onClick={() => setPhase("start")}>Chọn kiểu khác</button>
            </div>
          </div>
          <div className="proverb-quiz-review">
            <h3>Cùng ghi nhớ những lời hay</h3>
            <ol>
              {round.map((item, index) => (
                <li key={item.id}>
                  <div className="proverb-quiz-review-label"><strong>Câu {index + 1}</strong><span className={answers[index].correct ? "is-correct" : "is-learning"}>{answers[index].correct ? "✓ Em trả lời đúng" : "Cùng ôn lại"}</span></div>
                  <p className="proverb-quiz-review-prompt">{item.prompt}</p>
                  <p><strong>Em chọn:</strong> {item.options[answers[index].selectedIndex]}</p>
                  {!answers[index].correct && <p><strong>Đáp án đúng:</strong> {item.options[item.correctIndex]}</p>}
                  <blockquote>{item.saying}</blockquote>
                  <p>{item.explanation}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
      <noscript><p className="proverb-quiz-noscript">Em hãy bật JavaScript trong trình duyệt để chọn đáp án và chơi nhé.</p></noscript>
    </section>
  );
}
