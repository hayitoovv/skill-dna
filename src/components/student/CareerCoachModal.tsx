import { useState } from "react";
import { Icon } from "../common/Icons";
import { api } from "../../services/api";

interface CareerCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetRole?: string;
  matchPct?: number;
}

export default function CareerCoachModal({
  isOpen,
  onClose,
  targetRole = "Senior Python Backend Injinir",
  matchPct = 85,
}: CareerCoachModalProps) {
  const [messages, setMessages] = useState<
    { role: "coach" | "user"; content: string; time: string }[]
  >([
    {
      role: "coach",
      content: `Assalomu alaykum! Men sizning AI Karyera Murabbiyingizman. Siz hozir '${targetRole}' roliga ${matchPct}% mos kelasiz. Keyingi darajaga (L4 CREATE) chiqish bo‘yicha qanday maslahat kerak?`,
      time: "Hozir",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userText, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    ]);
    setLoading(true);

    try {
      const res = await api.chatWithCoach(userText, targetRole);
      setMessages((prev) => [
        ...prev,
        {
          role: "coach",
          content: res.reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "coach",
          content: "Hozirgi profilingiz tahliliga ko‘ra, sizda eng katta o‘sish nuqtasi — DevOps va CI/CD (61/100). Birinchi navbatda Docker multi-stage build va GitHub Actions bo‘yicha amaliy topshiriqlarni yakunlashni tavsiya qilaman.",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
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
          <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "linear-gradient(135deg, #2563eb, #1d4ed8)", display: "grid", placeItems: "center", color: "#fff" }}>
            <Icon name="briefcase" size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: "20px", margin: 0 }}>AI Career Coach</h2>
            <span style={{ fontSize: "13px", color: "var(--muted)" }}>
              {targetRole} · {matchPct}% Moslik tahlili
            </span>
          </div>
        </div>

        {/* Chat Stream */}
        <div
          style={{
            maxHeight: "340px",
            height: "300px",
            overflowY: "auto",
            background: "#f8fafc",
            padding: "16px",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            marginBottom: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {messages.map((m, idx) => (
            <div
              key={idx}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                background: m.role === "user" ? "var(--royal)" : "#ffffff",
                color: m.role === "user" ? "#ffffff" : "#1e293b",
                padding: "10px 14px",
                borderRadius: "10px",
                fontSize: "14px",
                lineHeight: 1.5,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                border: m.role === "coach" ? "1px solid #e2e8f0" : "none",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "12px", opacity: 0.7, marginBottom: "3px" }}>
                <strong>{m.role === "coach" ? "AI Murabbiy" : "Siz"}</strong>
                <span>{m.time}</span>
              </div>
              <div style={{ whiteSpace: "pre-line" }}>{m.content}</div>
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
                background: "#f1f5f9",
                border: "1px solid var(--border)",
                borderRadius: "14px",
                fontSize: "12.5px",
                color: "#475569",
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
