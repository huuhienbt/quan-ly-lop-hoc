"use client";

import { useEffect, useRef, useState } from "react";
import { createProverbRound, type ProverbQuestion } from "@/lib/proverb-quiz";
import "./proverb-quiz.css";

type PracticeKind = "all" | ProverbQuestion["kind"];
type Answer = { selectedIndex: number; correct: boolean };

const title = "Đố vui ca dao, tục ngữ Việt Nam";
const roundSize = 5;
const practiceKinds: { value: PracticeKind; label: string; icon: string }[] = [
  { value: "all", label: "Tổng hợp", icon: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" },
  { value: "missing", label: "Điền từ", icon: "M5 5h8m-4 0v9m-4 0h8m2-2 5-5 2 2-5 5-3 1zM4 19h16" },
  { value: "meaning", label: "Hiểu ý nghĩa", icon: "M10 18h4m-3 3h2m-4-6c0-2-3-3-3-6a6 6 0 1 1 12 0c0 3-3 4-3 6z" },
  { value: "situation", label: "Vận dụng", icon: "M12 3v18M5 6h12l3 3-3 3H5zM12 15H7l-3 3 3 3h5" },
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
  const missed = phase === "result" ? round.flatMap((item, index) => {
    const answer = answers[index];
    return answer && !answer.correct ? [{ item, index, answer }] : [];
  }) : [];

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
    setRound(createProverbRound({ kind, size: roundSize }));
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
    <section className="proverb-quiz-game" aria-labelledby="proverb-page-title">
      {phase !== "start" && <h2 className="sr-only" id="proverb-page-title">{title}</h2>}
      {phase === "start" && (
        <div className="proverb-quiz-start">
          <div className="proverb-quiz-intro">
            <div>
              <h2 className="proverb-quiz-title" id="proverb-page-title" ref={startHeading} tabIndex={-1}>{title}</h2>
              <p>Tiếng Việt lớp 4 · {roundSize} câu mỗi lượt · Không tính giờ</p>
            </div>
            <svg className="proverb-quiz-book" viewBox="0 0 80 80" aria-hidden="true" fill="none">
              <rect x="1" y="1" width="78" height="78" rx="23" fill="#e1f0e8" />
              <path d="M15 25c9-4 18-2 25 3 7-5 16-7 25-3v31c-9-3-18-1-25 4-7-5-16-7-25-4z" fill="#fffdf5" stroke="#236957" strokeWidth="2.5" strokeLinejoin="round" />
              <path d="M40 29v30m-17-23c4-1 8 0 11 2m-11 7c4-1 8 0 11 2m12-9c3-2 7-3 11-2m-11 11c3-2 7-3 11-2" stroke="#408576" strokeWidth="2" strokeLinecap="round" />
              <path d="m59 9 2.2 5.8L67 17l-5.8 2.2L59 25l-2.2-5.8L51 17l5.8-2.2z" fill="#eebd42" />
            </svg>
          </div>
          <fieldset className="proverb-quiz-kinds">
            <legend>Chọn cách chơi</legend>
            {practiceKinds.map((item) => (
              <label key={item.value} className={`proverb-quiz-kind${kind === item.value ? " is-selected" : ""}`}>
                <input className="sr-only" type="radio" name="practice-kind" value={item.value} checked={kind === item.value} onChange={() => setKind(item.value)} />
                <svg className="proverb-quiz-kind-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon} /></svg>
                <span>{item.label}</span>
                <span className="proverb-quiz-kind-check" aria-hidden="true">{kind === item.value ? "✓" : ""}</span>
              </label>
            ))}
          </fieldset>
          <div className="proverb-quiz-actions">
            <button className="proverb-quiz-primary" type="button" onClick={startRound}>Bắt đầu chơi <span aria-hidden="true">→</span></button>
          </div>
        </div>
      )}

      {phase === "playing" && question && (
        <div className="proverb-quiz-round">
          <div className="proverb-quiz-progress-heading">
            <p role="status">Câu {questionIndex + 1}/{round.length}</p>
            <span>{practiceKinds.find((item) => item.value === question.kind)?.label}</span>
          </div>
          <progress className="proverb-quiz-progress" value={answers.length} max={round.length} aria-label={`Đã trả lời ${answers.length} trên ${round.length} câu`} />
          <div className="proverb-quiz-question-heading">
            <span className="proverb-quiz-topic">{question.topic}</span>
            <h2 id="proverb-current-question" ref={questionHeading} tabIndex={-1}>{question.prompt}</h2>
            {!checked && <p id="proverb-answer-help">Chọn một đáp án rồi bấm Kiểm tra.</p>}
          </div>
          <fieldset className="proverb-quiz-options" disabled={checked} aria-labelledby="proverb-current-question" aria-describedby={checked ? undefined : "proverb-answer-help"}>
            <legend className="sr-only">Đáp án của em</legend>
            {question.options.map((option, index) => {
              const isCorrect = checked && index === question.correctIndex;
              const isWrong = checked && index === selectedIndex && !isCorrect;
              return (
                <label key={`${question.id}-${index}`} className={`proverb-quiz-option${selectedIndex === index ? " is-selected" : ""}${isCorrect ? " is-correct" : ""}${isWrong ? " is-wrong" : ""}`}>
                  <input className="sr-only" type="radio" name={`answer-${question.id}`} value={index} checked={selectedIndex === index} onChange={() => setSelectedIndex(index)} />
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
              <h3>{answers[questionIndex].correct ? "Chính xác!" : "Cùng xem lời giải nhé!"}</h3>
              {!answers[questionIndex].correct && <p><strong>Đáp án đúng:</strong> {question.options[question.correctIndex]}</p>}
              <blockquote>{question.saying}</blockquote>
              <p>{question.explanation}</p>
            </div>
          )}
          <div className="proverb-quiz-actions">
            {checked ? <button className="proverb-quiz-primary" type="button" onClick={nextQuestion}>{questionIndex === round.length - 1 ? "Xem kết quả" : "Câu tiếp theo"} <span aria-hidden="true">→</span></button> : <button className="proverb-quiz-primary" type="button" disabled={selectedIndex === null} onClick={checkAnswer}>Kiểm tra</button>}
          </div>
        </div>
      )}

      {phase === "result" && (
        <div className="proverb-quiz-result">
          <div className="proverb-quiz-result-header">
            <span className="proverb-quiz-result-icon" aria-hidden="true">★</span>
            <h2 ref={resultHeading} tabIndex={-1}>Em trả lời đúng <strong>{score}/{round.length}</strong> câu</h2>
            <p>{missed.length ? "Đọc lại lời giải để nhớ câu ca dao, tục ngữ lâu hơn nhé." : "Em đã trả lời đúng tất cả các câu. Giỏi lắm!"}</p>
          </div>
          <div className="proverb-quiz-result-actions">
            <button className="proverb-quiz-primary" type="button" onClick={startRound}>Chơi lượt mới <span aria-hidden="true">↻</span></button>
            <button className="proverb-quiz-quiet" type="button" onClick={() => setPhase("start")}>Chọn cách chơi khác</button>
          </div>
          {missed.length > 0 && <details className="proverb-quiz-review">
            <summary>Xem lại câu chưa đúng <span>{missed.length} câu</span></summary>
            <ol>
              {missed.map(({ item, index, answer }) => (
                <li key={item.id}>
                  <p className="proverb-quiz-review-label">Câu {index + 1}</p>
                  <h3>{item.prompt}</h3>
                  <p><strong>Em chọn:</strong> {item.options[answer.selectedIndex]}</p>
                  <p><strong>Đáp án đúng:</strong> {item.options[item.correctIndex]}</p>
                  <blockquote>{item.saying}</blockquote>
                  <p>{item.explanation}</p>
                </li>
              ))}
            </ol>
          </details>}
        </div>
      )}
      <noscript><p className="proverb-quiz-noscript">Em hãy bật JavaScript trong trình duyệt để chọn đáp án và chơi nhé.</p></noscript>
    </section>
  );
}
