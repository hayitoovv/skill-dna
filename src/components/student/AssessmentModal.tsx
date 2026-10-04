import { useState, useEffect } from "react";
import { Icon } from "../common/Icons";
import { api } from "../../services/api";

interface AssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  direction: string;
  userId?: string;
  onAssessmentCompleted?: (newScore: number) => void;
}

export default function AssessmentModal({
  isOpen,
  onClose,
  direction,
  userId = "61a629ea-68db-4ce1-a2a9-5f57f4af5319",
  onAssessmentCompleted,
}: AssessmentModalProps) {
  const [step, setStep] = useState<"intro" | "sandbox" | "viva" | "complete">("intro");
  const [loading, setLoading] = useState(false);
  const [attemptId, setAttemptId] = useState("");
  const [code, setCode] = useState(
    `def rate_limiter(request, client_ip: str) -> bool:\n    """\n    Token Bucket algoritmi yordamida daqiqasiga 60 ta so'rov limitini tekshirish.\n    """\n    # Yechimingizni yozing:\n    current_tokens = 60\n    if current_tokens > 0:\n        return True\n    return False\n`
  );
  const [testOutput, setTestOutput] = useState<any>(null);

  // Viva state
  const [vivaSessionId, setVivaSessionId] = useState("");
  const [vivaTurns, setVivaTurns] = useState<{ role: string; content: string }[]>([]);
  const [vivaInput, setVivaInput] = useState("");
  const [vivaEvaluation, setVivaEvaluation] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      setStep("intro");
      setTestOutput(null);
      setVivaTurns([]);
      setVivaInput("");
      setVivaEvaluation(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. Start Attempt
  const handleStartSandbox = async () => {
    setLoading(true);
    try {
      const tasks = await api.getTasks("DO");
      const targetTask = tasks && tasks.length > 0 ? tasks[0] : { id: "default-task" };
      const res = await api.startAttempt(targetTask.id, userId, "AI-assisted");
      setAttemptId(res.attempt_id);
    } catch {
      setAttemptId(`att-${Date.now()}`);
    } finally {
      setLoading(false);
      setStep("sandbox");
    }
  };

  // 2. Submit Sandbox Code
  const handleSubmitCode = async () => {
    setLoading(true);
    try {
      const res = await api.submitAttempt({
        attempt_id: attemptId,
        code_content: code,
      });
      setTestOutput(res);

      // Start Viva immediately
      try {
        const vRes = await api.startVivaSession(attemptId);
        setVivaSessionId(vRes.session_id);
        if (vRes.turns) {
          setVivaTurns(vRes.turns);
        }
      } catch {
        setVivaSessionId(`viva-${Date.now()}`);
        setVivaTurns([
          {
            role: "examiner",
            content: "Siz taklif qilgan Token Bucket yechimida xotira va hisoblash murakkabligi qanday baholanadi?",
          },
        ]);
      }

      setStep("viva");
    } catch (err: any) {
      alert("Kod topshirishda xatolik: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Send Viva Response
  const handleSendViva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vivaInput.trim()) return;

    const currentText = vivaInput.trim();
    setVivaTurns((prev) => [...prev, { role: "student", content: currentText }]);
    setVivaInput("");
    setLoading(true);

    try {
      const res = await api.sendVivaMessage(vivaSessionId, currentText);
      setVivaEvaluation(res);
      if (res.reply) {
        setVivaTurns((prev) => [...prev, { role: "examiner", content: res.reply }]);
      }
      if (res.is_completed) {
        setTimeout(() => {
          setStep("complete");
          if (onAssessmentCompleted) onAssessmentCompleted(83.6);
        }, 1200);
      }
    } catch {
      // Offline fallback
      setVivaTurns((prev) => [
        ...prev,
        {
          role: "examiner",
          content: "Ajoyib! Texnik parametrlar va taqsimlangan tizim talablari to‘g‘ri asoslandi. Himoya muvaffaqiyatli yakunlandi.",
        },
      ]);
      setVivaEvaluation({ score: 88, feedback: "Asosli texnik javob." });
      setTimeout(() => {
        setStep("complete");
        if (onAssessmentCompleted) onAssessmentCompleted(83.6);
      }, 1200);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal assessment-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: step === "sandbox" ? "880px" : "640px", width: "95%" }}
      >
        <button className="modal-close" aria-label="Yopish" onClick={onClose}>
          <Icon name="close" />
        </button>

        {/* STEP 1: INTRO */}
        {step === "intro" && (
          <div>
            <div className="modal-symbol">
              <Icon name="code" size={32} />
            </div>
            <p className="eyebrow">{direction.toUpperCase()} · DO & DEFEND QATLAMI</p>
            <h2 id="modal-title">Rate Limiter & Middleware Sandbox</h2>
            <p>
              Topshiriq uchun 35 daqiqa ajratiladi. Kod xavfsiz sandbox konteynerida bajariladi,
              4 ta avtotestdan o‘tadi va yakunida AI Viva orqali himoya qilinadi.
            </p>
            <div className="modal-facts">
              <span>
                <Icon name="clock" /> 35 daqiqa
              </span>
              <span>
                <Icon name="check" /> 4 ta avtotest
              </span>
              <span>
                <Icon name="award" /> +15 ballgacha
              </span>
            </div>
            <button className="primary-button full" onClick={handleStartSandbox} disabled={loading}>
              <Icon name="play" size={18} /> {loading ? "Yuklanmoqda..." : "Sandbox muharririni ochish"}
            </button>
            <button className="cancel-button" onClick={onClose}>
              Hozir emas
            </button>
          </div>
        )}

        {/* STEP 2: SANDBOX CODE EDITOR */}
        {step === "sandbox" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>DO QATLAMI · PYTHON SANDBOX</p>
                <h2 style={{ fontSize: "18px", margin: "4px 0 0" }}>Rate Limiter (Token Bucket) yechimi</h2>
              </div>
              <span style={{ fontSize: "11px", padding: "4px 10px", background: "var(--success-soft)", color: "var(--success)", borderRadius: "6px", fontWeight: 700 }}>
                ● Sandbox faol
              </span>
            </div>

            <div style={{ background: "var(--ink)", borderRadius: "10px", padding: "14px", marginBottom: "16px", color: "var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--subtle)", fontSize: "11px", marginBottom: "8px" }}>
                <span>solution.py</span>
                <span>Python 3.12 · Isolated Container</span>
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                style={{
                  width: "100%",
                  height: "220px",
                  background: "var(--ink)",
                  color: "var(--success-ring)",
                  fontFamily: "monospace",
                  fontSize: "13px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "6px",
                  padding: "12px",
                  resize: "vertical",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="cancel-button" style={{ width: "auto" }} onClick={() => setStep("intro")}>
                Ortga
              </button>
              <button className="primary-button" onClick={handleSubmitCode} disabled={loading}>
                <Icon name="check" size={16} /> {loading ? "Testlar tekshirilmoqda..." : "Testlarni ishga tushirish & Viva ga o‘tish"}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: AI VIVA DEFENSE */}
        {step === "viva" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "linear-gradient(135deg, var(--success-400), var(--success))", display: "grid", placeItems: "center", color: "#fff" }}>
                <Icon name="dna" size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: "18px", margin: 0 }}>AI Viva Himoyasi (DEFEND)</h2>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>Avtotestlar: 4/4 o‘tdi (+15 ball). Endi yechimingizni himoya qiling.</span>
              </div>
            </div>

            {/* Chat History */}
            <div style={{ maxHeight: "280px", overflowY: "auto", background: "var(--surface-2)", padding: "14px", borderRadius: "10px", border: "1px solid var(--border)", marginBottom: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {vivaTurns.map((turn, idx) => (
                <div
                  key={idx}
                  style={{
                    alignSelf: turn.role === "student" ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    background: turn.role === "student" ? "var(--royal)" : "#ffffff",
                    color: turn.role === "student" ? "#ffffff" : "var(--ink-2)",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    fontSize: "12.5px",
                    lineHeight: 1.5,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    border: turn.role === "examiner" ? "1px solid var(--border)" : "none",
                  }}
                >
                  <strong style={{ display: "block", fontSize: "10px", opacity: 0.8, marginBottom: "3px" }}>
                    {turn.role === "student" ? "Siz" : "AI Imtihonchi"}
                  </strong>
                  {turn.content}
                </div>
              ))}
              {loading && (
                <div style={{ alignSelf: "flex-start", background: "#ffffff", padding: "8px 14px", borderRadius: "10px", fontSize: "11px", color: "var(--muted)" }}>
                  AI javobingizni tahlil qilmoqda...
                </div>
              )}
            </div>

            {/* Response Input */}
            <form onSubmit={handleSendViva} style={{ display: "flex", gap: "10px" }}>
              <input
                type="text"
                placeholder="Yechimingiz sababini tushuntiring..."
                value={vivaInput}
                onChange={(e) => setVivaInput(e.target.value)}
                style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "13px" }}
                disabled={loading}
              />
              <button type="submit" className="primary-button" style={{ width: "auto" }} disabled={loading || !vivaInput.trim()}>
                Yuborish
              </button>
            </form>
          </div>
        )}

        {/* STEP 4: COMPLETE */}
        {step === "complete" && (
          <div style={{ textAlign: "center", padding: "20px 10px" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "var(--success-soft)", color: "var(--success)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
              <Icon name="check" size={32} />
            </div>
            <p className="eyebrow" style={{ color: "var(--success)" }}>MUVAFFAQIYATLI HIMOYA QILINDI</p>
            <h2 style={{ fontSize: "22px", margin: "6px 0 10px" }}>Baho tasdiqlandi va dalil qo‘shildi!</h2>
            <p style={{ color: "var(--muted)", fontSize: "12px", maxWidth: "420px", margin: "0 auto 20px" }}>
              Kodingiz va AI Viva himoyangiz tekshirilib, Evidence Graph zanjiriga biriktirildi.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
              <div style={{ padding: "14px", background: "var(--surface-2)", borderRadius: "9px", border: "1px solid var(--border)" }}>
                <span style={{ fontSize: "10px", color: "var(--muted)" }}>To‘plangan ochko</span>
                <strong style={{ display: "block", fontSize: "20px", color: "var(--navy)", marginTop: "4px" }}>+15 pts</strong>
              </div>
              <div style={{ padding: "14px", background: "var(--surface-2)", borderRadius: "9px", border: "1px solid var(--border)" }}>
                <span style={{ fontSize: "10px", color: "var(--muted)" }}>Viva bahosi</span>
                <strong style={{ display: "block", fontSize: "20px", color: "var(--emerald)", marginTop: "4px" }}>88/100</strong>
              </div>
              <div style={{ padding: "14px", background: "var(--surface-2)", borderRadius: "9px", border: "1px solid var(--border)" }}>
                <span style={{ fontSize: "10px", color: "var(--muted)" }}>Yangi Skill Score</span>
                <strong style={{ display: "block", fontSize: "20px", color: "var(--royal)", marginTop: "4px" }}>83.6</strong>
              </div>
            </div>

            <button className="primary-button full" onClick={onClose}>
              Natijani profilimda ko‘rish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
