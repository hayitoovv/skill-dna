import { useEffect, useState } from "react";
import { Icon } from "../common/Icons";
import { api, ApiError } from "../../services/api";

interface CareerCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetRole?: string | null;
  matchPct?: number | null;
  careerId?: string;
  /** true when targetRole/matchPct come from the live backend */
  live?: boolean;
}

type ChatMessage = {
  role: "coach" | "user";
  content: string;
  time: string;
  action?: string;
  demo?: boolean;
};

const nowTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function CareerCoachModal({
  isOpen,
  onClose,
  targetRole,
  matchPct,
  careerId,
  live = false,
}: CareerCoachModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Reset the conversation when the coached role changes
  useEffect(() => {
    setMessages([]);
  }, [careerId]);

  if (!isOpen) return null;

  const matchText = matchPct == null ? null : `${Math.round(matchPct * 10) / 10}%`;
  const greeting: ChatMessage = {
    role: "coach",
    time: "Hozir",
    demo: !live,
    content: targetRole
      ? matchText
        ? `Assalomu alaykum! Men sizning AI Karyera Murabbiyingizman. Siz hozir “${targetRole}” roliga ${matchText} mos kelasiz. Qaysi bo‘shliqdan boshlash bo‘yicha maslahat kerak?`
        : `Assalomu alaykum! Men sizning AI Karyera Murabbiyingizman. “${targetRole}” roli uchun majburiy ko‘nikmalardan biri hali yetishmaydi, shuning uchun moslik foizi hisoblanmagan. Qayerdan boshlashni birga aniqlaymiz.`
      : "Assalomu alaykum! Men sizning AI Karyera Murabbiyingizman. Karyera maqsadingiz bo‘yicha savolingizni yozing.",
  };
  const shown = [greeting, ...messages];

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userText, time: nowTime() }]);
    setLoading(true);

    try {
      const res = await api.chatWithCoach(userText, careerId);
      setMessages((prev) => [
        ...prev,
        {
          role: "coach",
          content: res?.reply || "Javob olinmadi.",
          action: res?.recommended_action || undefined,
          time: nowTime(),
        },
      ]);
    } catch (err) {
      // Only a network failure is "no connection"; server errors show their real reason
      const content = err instanceof ApiError
        ? err.status === 401
          ? "Sessiya muddati tugagan. Iltimos, qaytadan tizimga kiring."
          : `Murabbiy javob bera olmadi: ${err.message}`
        : "Server bilan aloqa yo‘q. Namuna javob: avval eng katta bo‘shliqqa ega ko‘nikma bo‘yicha KNOW testini, so‘ng DO amaliy topshirig‘ini yakunlashni tavsiya qilaman.";
      setMessages((prev) => [
        ...prev,
        { role: "coach", demo: !(err instanceof ApiError), content, time: nowTime() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: "600px", width: "95%" }}
      >
        <button className="modal-close" aria-label="Yopish" onClick={onClose}>
          <Icon name="close" />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "linear-gradient(135deg, var(--accent), var(--accent-hover))", display: "grid", placeItems: "center", color: "#fff" }}>
            <Icon name="briefcase" size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: "20px", margin: 0 }}>AI Career Coach</h2>
            <span style={{ fontSize: "13px", color: "var(--muted)" }}>
              {targetRole ? `${targetRole} · ${matchText ? `${matchText} moslik tahlili` : "moslik hisoblanmagan"}` : "Karyera maslahati"}
            </span>
            <span
              style={{
                marginLeft: "8px",
                fontSize: "11px",
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: "999px",
                background: live ? "var(--success-soft)" : "var(--warning-soft)",
                color: live ? "var(--success-fg)" : "var(--warning-fg)",
              }}
            >
              {live ? "Jonli ma’lumot" : "Demo ma’lumot"}
            </span>
          </div>
        </div>

        {/* Chat Stream */}
        <div
          style={{
            maxHeight: "340px",
            height: "300px",
            overflowY: "auto",
            background: "var(--surface-2)",
            padding: "16px",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            marginBottom: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {shown.map((m, idx) => (
            <div
              key={idx}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                background: m.role === "user" ? "var(--royal)" : "#ffffff",
                color: m.role === "user" ? "#ffffff" : "var(--ink-2)",
                padding: "10px 14px",
                borderRadius: "10px",
                fontSize: "14px",
                lineHeight: 1.5,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                border: m.role === "coach" ? "1px solid var(--border)" : "none",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "12px", opacity: 0.7, marginBottom: "3px" }}>
                <strong>{m.role === "coach" ? "AI Murabbiy" : "Siz"}</strong>
                <span>{m.time}</span>
              </div>
              <div style={{ whiteSpace: "pre-line" }}>{m.content}</div>
              {m.action && (
                <div
                  style={{
                    marginTop: "8px",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    background: "var(--success-soft)",
                    color: "var(--success-fg)",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  Tavsiya etilgan qadam: {m.action}
                </div>
              )}
              {m.demo && m.role === "coach" && idx > 0 && (
                <div style={{ marginTop: "6px", fontSize: "11px", fontWeight: 700, color: "var(--warning-fg)" }}>Demo javob</div>
              )}
            </div>
          ))}
          {loading && (
            <div style={{ alignSelf: "flex-start", background: "#ffffff", padding: "8px 14px", borderRadius: "10px", fontSize: "13px", color: "var(--muted)" }}>
              AI murabbiy javob yozmoqda...
            </div>
          )}
        </div>

        {/* Quick Suggestion Pills */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "12px", overflowX: "auto", paddingBottom: "4px" }}>
          {[
            "Qayerdan boshlay?",
            "Vivadagi savollarga qanday tayyorlanay?",
            "Qaysi kompaniyalar mos keladi?",
          ].map((pill) => (
            <button
              key={pill}
              type="button"
              onClick={() => setInput(pill)}
              style={{
                padding: "6px 12px",
                background: "var(--surface-3)",
                border: "1px solid var(--border)",
                borderRadius: "14px",
                fontSize: "12.5px",
                color: "var(--text-3)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {pill}
            </button>
          ))}
        </div>

        {/* Message Input */}
        <form onSubmit={handleSend} style={{ display: "flex", gap: "10px" }}>
          <input
            type="text"
            placeholder="Karyera bo‘yicha savolingizni yozing..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "14px" }}
            disabled={loading}
          />
          <button type="submit" className="primary-button" style={{ width: "auto" }} disabled={loading || !input.trim()}>
            Yuborish
          </button>
        </form>
      </div>
    </div>
  );
}
