import { useEffect, useRef, useState } from "react";
import { Icon } from "../common/Icons";
import { api } from "../../services/api";
import AssistantPanel from "./AssistantPanel";
import { useI18n } from "../../i18n";

interface AssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  direction: string;
  userId?: string;
  onAssessmentCompleted?: (newScore: number) => void;
}

type Step = "intro" | "sandbox" | "result" | "viva" | "complete";

// Pilot (★) DO task per direction (architecture document section 9)
const PILOT_DO_SKILL: Record<string, string> = {
  software: "SE-BACKEND",
  computer: "CE-NET",
  ai: "AI-EVAL",
};

export default function AssessmentModal({ isOpen, onClose, direction, onAssessmentCompleted }: AssessmentModalProps) {
  const { lang } = useI18n();
  const [step, setStep] = useState<Step>("intro");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<any>(null);
  const [attemptId, setAttemptId] = useState("");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<any>(null);
  const [contribution, setContribution] = useState(100);
  // AI-free telemetry: supporting signals only, never a verdict on their own (section 7.1)
  const [telemetry, setTelemetry] = useState({ paste_events: 0, max_paste_chars: 0, tab_switches: 0 });

  const [vivaSessionId, setVivaSessionId] = useState("");
  const [vivaTurns, setVivaTurns] = useState<{ role: string; content: string }[]>([]);
  const [vivaInput, setVivaInput] = useState("");
  const [vivaProgress, setVivaProgress] = useState<{ index: number; total: number } | null>(null);
  const [vivaFinal, setVivaFinal] = useState<any>(null);
  // Live viva transport: WebSocket when available, REST otherwise
  const socketRef = useRef<{ answer: (text: string) => void; close: () => void } | null>(null);
  // Ref, not state: the socket handler is created once and must see the current session id
  const sessionRef = useRef("");

  useEffect(() => {
    if (!isOpen) return;
    setStep("intro");
    setError(null);
    setResult(null);
    setVivaTurns([]);
    setVivaInput("");
    setVivaFinal(null);
    setVivaProgress(null);
    api
      .getTasks("DO", PILOT_DO_SKILL[direction] || "SE-BACKEND")
      .then((tasks) => setTask(tasks[0] ?? null))
      .catch((e: Error) => setError(e.message));
  }, [isOpen, direction]);

  useEffect(() => {
    if (step !== "sandbox" || task?.ai_mode !== "AI-free") return;
    const onVisibility = () => {
      if (document.hidden) setTelemetry((t) => ({ ...t, tab_switches: t.tab_switches + 1 }));
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [step, task]);

  useEffect(() => () => socketRef.current?.close(), []);

  const handleVivaEvent = (ev: any) => {
    if (ev.type === "thinking") return;
    if (ev.type === "closed") {
      socketRef.current = null;
      return;
    }
    setLoading(false);
    if (ev.type === "error") {
      setError(ev.detail);
      return;
    }
    if (ev.reply) setVivaTurns((prev) => [...prev, { role: "examiner", content: ev.reply }]);
    if (ev.questions_total) setVivaProgress({ index: ev.question_index, total: ev.questions_total });
    if (ev.type === "completed") {
      if (ev.grading) {
        setLoading(true);
        awaitVivaResult(sessionRef.current).catch(fail).finally(() => setLoading(false));
        return;
      }
      setVivaFinal(ev);
      if (ev.skill && onAssessmentCompleted) onAssessmentCompleted(ev.skill.score);
      setTimeout(() => setStep("complete"), 900);
    }
  };

  if (!isOpen) return null;

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Code runs in the sandbox worker; poll until it leaves the queue (~2 min ceiling)
  const pollResult = async (id: string) => {
    for (let i = 0; i < 80; i++) {
      const r = await api.getAttemptResult(id);
      if (r.status !== "queued") return r;
      await sleep(1500);
    }
    throw new Error("Tekshiruv odatdagidan uzoq davom etmoqda — natija keyinroq profilingizda paydo bo‘ladi.");
  };

  // The viva grader panel runs in the worker; poll the transcript until the result is posted
  const awaitVivaResult = async (sessionId: string) => {
    for (let i = 0; i < 80; i++) {
      const t = await api.getVivaTranscript(sessionId);
      if (t.status === "completed" && t.result) {
        const closing = t.turns[t.turns.length - 1];
        if (closing?.role === "examiner") setVivaTurns((prev) => [...prev, { role: "examiner", content: closing.content }]);
        const final = { ...t.result, skill: t.result.skill };
        setVivaFinal(final);
        if (final.skill && onAssessmentCompleted) onAssessmentCompleted(final.skill.score);
        setTimeout(() => setStep("complete"), 900);
        return;
      }
      await sleep(1500);
    }
    throw new Error("Baholash odatdagidan uzoq davom etmoqda — natija profilingizda paydo bo‘ladi.");
  };

  const handleStart = async () => {
    if (!task) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.startAttempt(task.id);
      setAttemptId(res.attempt_id);
      setCode(res.spec?.initial_code ?? "");
      setStep("sandbox");
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const assisted = task?.ai_mode === "AI-assisted";
      let res = await api.submitAttempt(attemptId, {
        code_content: code,
        ...(assisted ? { self_declared_contribution: contribution / 100 } : { telemetry }),
      });
      if (res.status === "queued") {
        setResult(res);
        setStep("result");
        res = await pollResult(attemptId);
      }
      setResult(res);
      setStep("result");
      if (res.status === "evaluated" && res.skill && onAssessmentCompleted) onAssessmentCompleted(res.skill.score);
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStartViva = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.startVivaSession(attemptId, lang);
      setVivaSessionId(res.session_id);
      sessionRef.current = res.session_id;
      setVivaTurns(res.turns ?? []);
      setVivaProgress({ index: 0, total: res.questions_total ?? 7 });
      setStep("viva");
      socketRef.current = await api.openVivaSocket(res.session_id, handleVivaEvent).catch(() => null);
    } catch (e) {
      // A 403 here means the viva_record consent is missing; the message says where to grant it
      fail(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendViva = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = vivaInput.trim();
    if (!text) return;
    setVivaTurns((prev) => [...prev, { role: "student", content: text }]);
    setVivaInput("");
    setLoading(true);
    setError(null);
    if (socketRef.current) {
      // The reply arrives through handleVivaEvent
      socketRef.current.answer(text);
      return;
    }
    try {
      const res = await api.sendVivaMessage(vivaSessionId, text);
      if (res.reply) setVivaTurns((prev) => [...prev, { role: "examiner", content: res.reply }]);
      if (res.questions_total) setVivaProgress({ index: res.question_index, total: res.questions_total });
      if (res.is_completed && res.grading) {
        await awaitVivaResult(vivaSessionId);
      } else if (res.is_completed) {
        setVivaFinal(res);
        if (res.skill && onAssessmentCompleted) onAssessmentCompleted(res.skill.score);
        setTimeout(() => setStep("complete"), 900);
      }
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  };

  const passed = result?.details?.filter((d: any) => d.passed).length ?? 0;
  const total = result?.details?.length ?? task?.spec?.tests_total ?? 0;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal assessment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assessment-title"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: step === "sandbox" ? "880px" : "640px", width: "95%" }}
      >
        <button className="modal-close" aria-label="Yopish" onClick={onClose}>
          <Icon name="close" />
        </button>

        {error && (
          <div role="alert" style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 12, background: "var(--danger-soft)", color: "var(--danger-fg)", fontSize: 13 }}>
            {error}
          </div>
        )}

        {step === "intro" && (
          <div>
            <div className="modal-symbol">
              <Icon name="code" size={28} />
            </div>
            <p className="eyebrow">{direction.toUpperCase()} · DO & DEFEND QATLAMI</p>
            <h2 id="assessment-title">{task ? task.title.replace(/^DO:\s*/, "") : "Topshiriq yuklanmoqda..."}</h2>
            <p>{task?.spec?.description ?? "Amaliy topshiriq izolyatsiyalangan sandbox’da avtotestlar bilan tekshiriladi, so‘ng AI Viva’da himoya qilinadi."}</p>
            {task && (
              <div className="modal-facts">
                <span><Icon name="clock" /> {task.duration_minutes} daqiqa</span>
                <span><Icon name="check" /> {task.spec?.tests_total ?? 0} ta avtotest</span>
                <span><Icon name="sparkles" /> {task.ai_mode}</span>
              </div>
            )}
            <button className="primary-button full" onClick={handleStart} disabled={loading || !task}>
              <Icon name="play" size={18} /> {loading ? "Yuklanmoqda..." : "Topshiriqni boshlash"}
            </button>
            <button className="cancel-button" onClick={onClose}>Hozir emas</button>
          </div>
        )}

        {step === "sandbox" && task && (
          <div>
            <div style={{ marginBottom: 14 }}>
              <p className="eyebrow" style={{ margin: 0 }}>DO QATLAMI · PYTHON SANDBOX · {task.ai_mode}</p>
              <h2 id="assessment-title" style={{ fontSize: 18, margin: "4px 0 6px" }}>{task.title.replace(/^DO:\s*/, "")}</h2>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>{task.spec?.description}</p>
              {task.spec?.visible_tests?.length > 0 && (
                <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                  Ochiq testlar: {task.spec.visible_tests.join(", ")} · yashirin testlar ham bor
                </p>
              )}
            </div>
            <div style={{ background: "var(--ink)", borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--subtle)", fontSize: 11, marginBottom: 8 }}>
                <span>solution.py</span>
                <span>Python 3.12 · tarmoqsiz izolyatsiyalangan konteyner</span>
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onPaste={(e) => {
                  const n = e.clipboardData.getData("text").length;
                  setTelemetry((t) => ({ ...t, paste_events: t.paste_events + 1, max_paste_chars: Math.max(t.max_paste_chars, n) }));
                }}
                spellCheck={false}
                aria-label="Yechim kodi"
                style={{ width: "100%", height: 240, background: "var(--ink)", color: "var(--success-ring)", fontFamily: "Geist Mono, monospace", fontSize: 13, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: 12, resize: "vertical", outline: "none" }}
              />
            </div>
            {task.ai_mode === "AI-assisted" && (
              <div style={{ marginBottom: 16 }}>
                <AssistantPanel attemptId={attemptId} code={code} onInsert={(snippet) => setCode((c) => `${c.trimEnd()}

${snippet}`)} />
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--text-3)", marginTop: 10 }}>
                  Yechimdagi o‘z hissangiz: <strong style={{ color: "var(--navy)" }}>{contribution}%</strong>
                  <input type="range" min={0} max={100} step={5} value={contribution} onChange={(e) => setContribution(Number(e.target.value))} style={{ flex: 1 }} aria-label="O‘z hissangiz foizda" />
                </label>
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="secondary-button" onClick={() => setStep("intro")}>Ortga</button>
              <button className="primary-button" onClick={handleSubmit} disabled={loading || !code.trim()}>
                <Icon name="check" size={16} /> {loading ? "Testlar bajarilmoqda..." : "Topshirish va testlarni ishga tushirish"}
              </button>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div>
            <p className="eyebrow">AVTOTEST NATIJASI</p>
            {result.status === "queued" ? (
              <>
                <h2 id="assessment-title">Avtotestlar bajarilmoqda...</h2>
                <p>{result.message}</p>
              </>
            ) : result.status === "awaiting_sandbox" ? (
              <>
                <h2 id="assessment-title">Yechim saqlandi</h2>
                <p>{result.message}</p>
                <button className="primary-button full" onClick={onClose}>Yopish</button>
              </>
            ) : (
              <>
                <h2 id="assessment-title">{passed}/{total} test o‘tdi · {result.total_score} ball</h2>
                <ul style={{ listStyle: "none", padding: 0, margin: "14px 0", display: "grid", gap: 6 }}>
                  {result.details.map((d: any) => (
                    <li key={d.name} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 12px", borderRadius: 10, background: d.passed ? "var(--success-soft)" : "var(--danger-soft)", fontSize: 12.5 }}>
                      <span>{d.passed ? "✓" : "✗"} {d.name}</span>
                      <span style={{ color: "var(--muted)" }}>{d.passed ? "" : d.error ?? (d.got != null ? `natija: ${d.got}` : "noto‘g‘ri")}</span>
                    </li>
                  ))}
                </ul>
                {result.flags?.length > 0 && (
                  <p style={{ fontSize: 12, color: "var(--warning-fg)" }}>
                    Qo‘shimcha tekshiruv belgilandi ({result.flags.join(", ")}). Bu jazo emas — moderator ko‘rib chiqadi.
                  </p>
                )}
                <button className="primary-button full" onClick={handleStartViva} disabled={loading}>
                  <Icon name="dna" size={16} /> {loading ? "Viva tayyorlanmoqda..." : "AI Viva’da yechimni himoya qilish"}
                </button>
                <button className="cancel-button" onClick={onClose}>Keyinroq</button>
              </>
            )}
          </div>
        )}

        {step === "viva" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--accent-gradient)", display: "grid", placeItems: "center", color: "#fff" }}>
                <Icon name="dna" size={22} />
              </div>
              <div>
                <h2 id="assessment-title" style={{ fontSize: 18, margin: 0 }}>AI Viva himoyasi (DEFEND)</h2>
                <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  Savollar sizning kodingizdan tuzilgan
                  {vivaProgress ? ` · ${Math.min(vivaProgress.index + 1, vivaProgress.total)}/${vivaProgress.total}` : ""}
                </span>
              </div>
            </div>
            <div style={{ maxHeight: 300, overflowY: "auto", background: "var(--surface-2)", padding: 14, borderRadius: 12, border: "1px solid var(--border)", marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }} aria-live="polite">
              {vivaTurns.map((turn, idx) => (
                <div key={idx} style={{ alignSelf: turn.role === "student" ? "flex-end" : "flex-start", maxWidth: "85%", background: turn.role === "student" ? "var(--accent)" : "#fff", color: turn.role === "student" ? "#fff" : "var(--ink-2)", padding: "10px 14px", borderRadius: 12, fontSize: 12.5, lineHeight: 1.5, border: turn.role === "student" ? "none" : "1px solid var(--border)" }}>
                  <strong style={{ display: "block", fontSize: 10, opacity: 0.8, marginBottom: 3 }}>{turn.role === "student" ? "Siz" : "AI imtihonchi"}</strong>
                  {turn.content}
                </div>
              ))}
              {loading && <div style={{ alignSelf: "flex-start", fontSize: 11.5, color: "var(--muted)" }}>Javob tahlil qilinmoqda...</div>}
            </div>
            <form onSubmit={handleSendViva} style={{ display: "flex", gap: 10 }}>
              <input
                type="text"
                placeholder="Qaroringizni kodingizdagi aniq joy bilan asoslang..."
                value={vivaInput}
                onChange={(e) => setVivaInput(e.target.value)}
                aria-label="Viva javobi"
                style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 13 }}
                disabled={loading || !!vivaFinal}
              />
              <button type="submit" className="primary-button" disabled={loading || !vivaInput.trim() || !!vivaFinal}>Yuborish</button>
            </form>
          </div>
        )}

        {step === "complete" && vivaFinal && (
          <div style={{ textAlign: "center", padding: "16px 8px" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--success-soft)", color: "var(--success)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
              <Icon name="check" size={32} />
            </div>
            <p className="eyebrow">VIVA YAKUNLANDI</p>
            <h2 id="assessment-title" style={{ fontSize: 22, margin: "6px 0 10px" }}>Dalil Evidence Graph’ga qo‘shildi</h2>
            {vivaFinal.review_reason && (
              <p style={{ color: "var(--muted)", fontSize: 12.5 }}>Natija inson tomonidan ko‘rib chiqiladi: {vivaFinal.review_reason}.</p>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, margin: "18px 0 22px" }}>
              <div className="card" style={{ padding: 14 }}>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>Avtotestlar</span>
                <strong style={{ display: "block", fontSize: 20, color: "var(--navy)", marginTop: 4 }}>{result?.total_score ?? "—"}</strong>
              </div>
              <div className="card" style={{ padding: 14 }}>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>Viva bahosi</span>
                <strong style={{ display: "block", fontSize: 20, color: "var(--success)", marginTop: 4 }}>{vivaFinal.score}/100</strong>
              </div>
              <div className="card" style={{ padding: 14 }}>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>Skill Score · daraja</span>
                <strong style={{ display: "block", fontSize: 20, color: "var(--accent)", marginTop: 4 }}>
                  {vivaFinal.skill ? `${Math.round(vivaFinal.skill.score)} · ${vivaFinal.skill.level.split(" ")[0]}` : "—"}
                </strong>
              </div>
            </div>
            <button className="primary-button full" onClick={onClose}>Natijani profilimda ko‘rish</button>
          </div>
        )}
      </div>
    </div>
  );
}
