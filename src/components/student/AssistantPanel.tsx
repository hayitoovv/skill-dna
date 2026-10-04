import { useEffect, useState } from "react";
import { Icon } from "../common/Icons";
import { api } from "../../services/api";

interface Turn {
  role: "student" | "assistant";
  content: string;
  suggestion?: string | null;
  suggestionId?: string | null;
  decision?: "accepted" | "rejected";
}

/**
 * In-platform AI assistant for AI-assisted tasks (architecture section 5.2). Every question and every
 * accepted/rejected suggestion is logged server-side; the student explains their AI use in the viva.
 */
export default function AssistantPanel({
  attemptId,
  code,
  onInsert,
}: {
  attemptId: string;
  code: string;
  onInsert: (snippet: string) => void;
}) {
  const [mode, setMode] = useState<"guarded" | "unguarded" | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);

  useEffect(() => {
    api
      .getAssistantState(attemptId)
      .then((s) => {
        setMode(s.mode);
        setUsage({ used: s.turns_used, limit: s.turns_limit });
      })
      .catch((e: Error) => setError(e.message));
  }, [attemptId]);

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    setTurns((t) => [...t, { role: "student", content: q }]);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const r = await api.askAssistant(attemptId, q, code);
      setTurns((t) => [...t, { role: "assistant", content: r.reply, suggestion: r.code_suggestion, suggestionId: r.suggestion_id }]);
      setUsage({ used: r.turns_used, limit: r.turns_limit });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const decide = async (idx: number, accepted: boolean) => {
    const turn = turns[idx];
    if (!turn.suggestionId || turn.decision) return;
    try {
      await api.decideSuggestion(attemptId, turn.suggestionId, accepted);
      setTurns((t) => t.map((x, i) => (i === idx ? { ...x, decision: accepted ? "accepted" : "rejected" } : x)));
      if (accepted && turn.suggestion) onInsert(turn.suggestion);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <aside
      aria-label="AI yordamchi"
      style={{ display: "flex", flexDirection: "column", minHeight: 0, borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 12 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <strong style={{ fontSize: 13, color: "var(--navy)", display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="sparkles" size={15} /> AI yordamchi
        </strong>
        {mode && (
          <span
            title={mode === "guarded" ? "Tushuncha va keyingi qadam bo‘yicha yordam; tayyor yechim berilmaydi" : "Erkin yordam; har bir taklifni o‘zingiz tekshirasiz"}
            style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: mode === "guarded" ? "var(--accent-soft)" : "var(--warning-soft)", color: mode === "guarded" ? "var(--accent)" : "var(--warning-fg)" }}
          >
            {mode === "guarded" ? "GUARDED" : "UNGUARDED"}
          </span>
        )}
      </div>
      <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 8px" }}>
        Barcha so‘rovlar qayd etiladi; vivada AI’dan qanday foydalanganingizni tushuntirasiz.
        {usage ? ` ${usage.used}/${usage.limit} so‘rov.` : ""}
      </p>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, minHeight: 160, maxHeight: 260 }} aria-live="polite">
        {turns.length === 0 && <p style={{ fontSize: 12, color: "var(--subtle)" }}>Masalan: “Chekka holatlarni qanday tekshiray?”</p>}
        {turns.map((t, i) => (
          <div key={i} style={{ alignSelf: t.role === "student" ? "flex-end" : "flex-start", maxWidth: "92%", padding: "8px 10px", borderRadius: 10, fontSize: 12, lineHeight: 1.45, background: t.role === "student" ? "var(--accent)" : "#fff", color: t.role === "student" ? "#fff" : "var(--ink-2)", border: t.role === "student" ? "none" : "1px solid var(--border)", whiteSpace: "pre-wrap" }}>
            {t.content}
            {t.suggestion && (
              <div style={{ marginTop: 6 }}>
                <pre style={{ margin: 0, padding: 8, borderRadius: 8, background: "var(--ink)", color: "var(--success-ring)", fontSize: 11, overflowX: "auto" }}>{t.suggestion}</pre>
                {t.decision ? (
                  <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{t.decision === "accepted" ? "Kodga qo‘shildi" : "Rad etildi"}</span>
                ) : (
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <button type="button" className="secondary-button" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => decide(i, true)}>Kodga qo‘shish</button>
                    <button type="button" className="secondary-button" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => decide(i, false)}>Rad etish</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {busy && <span style={{ fontSize: 11, color: "var(--muted)" }}>Javob tayyorlanmoqda...</span>}
      </div>
      {error && <p role="alert" style={{ fontSize: 11.5, color: "var(--danger-fg)", margin: "6px 0 0" }}>{error}</p>}
      <form onSubmit={ask} style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Savolingiz..."
          aria-label="AI yordamchiga savol"
          disabled={busy || !mode}
          style={{ flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 12.5 }}
        />
        <button type="submit" className="primary-button" style={{ padding: "8px 12px" }} disabled={busy || !input.trim() || !mode}>
          <Icon name="arrow" size={14} />
        </button>
      </form>
    </aside>
  );
}
