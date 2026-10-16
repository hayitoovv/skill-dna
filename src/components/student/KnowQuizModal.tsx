import { useEffect, useRef, useState } from "react";
import { Icon } from "../common/Icons";
import { api } from "../../services/api";

type QuizQuestion = { id: string; text: string; options: string[] };
type QuizResult = {
  total_score: number;
  details: { name: string; passed: boolean }[];
  skill: { score: number; confidence: number; level: string | number } | null;
};
type Step = "intro" | "quiz" | "result";

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function KnowQuizModal({
  task,
  skillName,
  onClose,
  onFinished,
}: {
  task: { id: string; title: string; duration_minutes?: number };
  skillName?: string;
  onClose: () => void;
  onFinished?: () => void;
}) {
  const [step, setStep] = useState<Step>("intro");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [title, setTitle] = useState(task.title);
  const [duration, setDuration] = useState<number | undefined>(task.duration_minutes);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLHeadingElement>(null);

  const finish = () => {
    onFinished?.();
    onClose();
  };

  const requestClose = () => {
    if (step === "quiz") {
      setConfirmExit(true);
      return;
    }
    if (step === "result") finish();
    else onClose();
  };

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    if (step === "quiz") questionRef.current?.focus();
  }, [step, index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (confirmExit) setConfirmExit(false);
      else requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.startAttempt(task.id);
      const qs: QuizQuestion[] = Array.isArray(res?.spec?.questions) ? res.spec.questions : [];
      if (qs.length === 0) throw new Error("Bu test uchun savollar topilmadi.");
      setAttemptId(String(res.attempt_id));
      if (res.title) setTitle(res.title);
      if (res.duration_minutes) setDuration(res.duration_minutes);
      setQuestions(qs);
      setAnswers({});
      setIndex(0);
      setStep("quiz");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!attemptId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.submitAttempt(attemptId, { answers });
      setResult({
        total_score: Math.round(Number(res?.total_score ?? 0)),
        details: Array.isArray(res?.details) ? res.details : [],
        skill: res?.skill ?? null,
      });
      setConfirmExit(false);
      setStep("result");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  };

  const total = questions.length;
  const current = questions[index];
  const unanswered = questions.filter((q) => answers[q.id] === undefined).length;
  const isLast = index === total - 1;
  const correct = result ? result.details.filter((d) => d.passed).length : 0;
  const questionText = (id: string) => questions.find((q) => q.id === id)?.text ?? id;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (step !== "quiz" && !loading) requestClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="know-quiz-title"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: "640px", width: "95%", maxHeight: "90vh", overflowY: "auto", outline: "none" }}
      >
        <button className="modal-close" aria-label="Yopish" onClick={requestClose}>
          <Icon name="close" />
        </button>

        <p className="eyebrow" style={{ margin: 0 }}>
          KNOW · Nazariy test{skillName ? ` · ${skillName}` : ""}
        </p>
        <h2 id="know-quiz-title" style={{ fontSize: "19px", margin: "2px 0 12px", paddingRight: "36px" }}>
          {title}
        </h2>

        {confirmExit && step === "quiz" && (
          <div
            role="alertdialog"
            aria-label="Testdan chiqish"
            style={{
              border: "1px solid var(--warning-ring)",
              background: "var(--warning-soft)",
              color: "var(--warning-strong)",
              borderRadius: "10px",
              padding: "12px 14px",
              marginBottom: "14px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <span style={{ flex: "1 1 200px", fontSize: "14px", fontWeight: 600 }}>Test yakunlanmagan. Chiqasizmi?</span>
            <button className="secondary-button" onClick={() => setConfirmExit(false)} autoFocus>
              Davom etish
            </button>
            <button className="primary-button" onClick={onClose}>
              Ha, chiqish
            </button>
          </div>
        )}

        {step === "intro" && (
          <>
            <p style={{ fontSize: "13.5px", color: "var(--muted)", margin: "0 0 10px" }}>
              ≈10 ta savol · ≈ {duration ?? 10} daqiqa
            </p>
            <p style={{ fontSize: "14px", lineHeight: 1.6, margin: "0 0 16px" }}>
              Har bir urinishda savollar va javoblar tartibi boshqacha bo‘ladi.
            </p>
            {error && (
              <p role="alert" style={{ color: "var(--danger-fg)", fontSize: "13.5px", margin: "0 0 12px" }}>
                {error}
              </p>
            )}
            <button className="primary-button full" onClick={start} disabled={loading} aria-busy={loading}>
              {loading ? "Yuklanmoqda…" : "Testni boshlash"}
            </button>
          </>
        )}

        {step === "quiz" && current && (
          <>
            <div
              style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--muted)", marginBottom: "6px" }}
            >
              <span aria-live="polite">
                {index + 1} / {total}
              </span>
              <span>{total - unanswered} ta javob berildi</span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={index + 1}
              aria-label="Test jarayoni"
              style={{ height: "4px", borderRadius: "999px", background: "var(--border)", overflow: "hidden", marginBottom: "16px" }}
            >
              <div
                style={{
                  width: `${((index + 1) / total) * 100}%`,
                  height: "100%",
                  background: "var(--accent)",
                  transition: "width 0.2s ease",
                }}
              />
            </div>

            <fieldset style={{ border: 0, padding: 0, margin: "0 0 16px" }}>
              <legend style={{ padding: 0, width: "100%" }}>
                <h3
                  ref={questionRef}
                  tabIndex={-1}
                  style={{ fontSize: "16px", lineHeight: 1.5, margin: "0 0 12px", outline: "none" }}
                >
                  {current.text}
                </h3>
              </legend>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {current.options.map((opt, i) => {
                  const checked = answers[current.id] === i;
                  return (
                    <label
                      key={`${current.id}-${i}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        minHeight: "48px",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: `1px solid ${checked ? "var(--accent)" : "var(--border)"}`,
                        background: checked ? "var(--accent-soft)" : "var(--surface)",
                        cursor: "pointer",
                        fontSize: "14px",
                        lineHeight: 1.5,
                      }}
                    >
                      <input
                        type="radio"
                        name={`q-${current.id}`}
                        value={i}
                        checked={checked}
                        onChange={() => setAnswers((prev) => ({ ...prev, [current.id]: i }))}
                        style={{ width: "18px", height: "18px", flexShrink: 0, accentColor: "var(--accent)" }}
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {isLast && unanswered > 0 && (
              <p role="status" style={{ color: "var(--warning-fg)", fontSize: "13.5px", margin: "0 0 12px" }}>
                {unanswered} ta savolga javob berilmagan
              </p>
            )}
            {error && (
              <p role="alert" style={{ color: "var(--danger-fg)", fontSize: "13.5px", margin: "0 0 12px" }}>
                {error}
              </p>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "space-between" }}>
              <button
                className="secondary-button"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0 || loading}
                style={{ minHeight: "44px" }}
              >
                Orqaga
              </button>
              {isLast ? (
                <button
                  className="primary-button"
                  onClick={submit}
                  disabled={unanswered > 0 || loading}
                  aria-busy={loading}
                  style={{ minHeight: "44px" }}
                >
                  {loading ? "Tekshirilmoqda…" : "Yakunlash"}
                </button>
              ) : (
                <button
                  className="primary-button"
                  onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
                  style={{ minHeight: "44px" }}
                >
                  Keyingi
                </button>
              )}
            </div>
          </>
        )}

        {step === "result" && result && (
          <>
            <div style={{ textAlign: "center", margin: "4px 0 16px" }}>
              <div
                style={{
                  fontSize: "44px",
                  fontWeight: 800,
                  lineHeight: 1.1,
                  color: result.total_score >= 60 ? "var(--success-fg)" : "var(--danger-fg)",
                }}
              >
                {result.total_score}%
              </div>
              <p style={{ fontSize: "14px", color: "var(--muted)", margin: "4px 0 0" }}>
                {correct}/{result.details.length || total} to‘g‘ri
              </p>
            </div>

            {result.skill && (
              <p
                style={{
                  fontSize: "13.5px",
                  background: "var(--accent-soft)",
                  border: "1px solid var(--accent-ring)",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  margin: "0 0 14px",
                  textAlign: "center",
                }}
              >
                Ko‘nikma bali: {Math.round(Number(result.skill.score))} · Ishonchlilik:{" "}
                {Math.round(Number(result.skill.confidence))}% · Daraja: {result.skill.level}
              </p>
            )}

            {result.details.length > 0 && (
              <ol style={{ listStyle: "none", margin: "0 0 16px", padding: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                {result.details.map((d, i) => (
                  <li
                    key={d.name}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: `1px solid ${d.passed ? "var(--success-ring)" : "var(--danger-ring)"}`,
                      background: d.passed ? "var(--success-soft)" : "var(--danger-soft)",
                      fontSize: "13.5px",
                      lineHeight: 1.5,
                    }}
                  >
                    <span
                      style={{ color: d.passed ? "var(--success-fg)" : "var(--danger-fg)", flexShrink: 0, marginTop: "1px" }}
                      aria-label={d.passed ? "To‘g‘ri" : "Noto‘g‘ri"}
                      role="img"
                    >
                      <Icon name={d.passed ? "check" : "close"} size={18} />
                    </span>
                    <span>
                      {i + 1}. {questionText(d.name)}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            <button className="primary-button full" onClick={finish}>
              Yopish
            </button>
          </>
        )}
      </div>
    </div>
  );
}
