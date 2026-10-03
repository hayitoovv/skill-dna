import { useState } from "react";
import { Icon } from "../common/Icons";
import { initialModeratorFlags } from "../../data/ontology";
import type { IntegrityFlag } from "../../types";

export default function ModeratorQueue() {
  const [flags, setFlags] = useState<IntegrityFlag[]>(initialModeratorFlags);
  const [activeFlag, setActiveFlag] = useState<IntegrityFlag | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleResolve = (flagId: string, actionText: string) => {
    setFlags((prev) =>
      prev.map((f) => (f.id === flagId ? { ...f, status: "resolved" } : f))
    );
    setActiveFlag(null);
    setToastMessage(`Qaror qabul qilindi: ${actionText}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="page">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">INTEGRITY & HALOLLIK TIZIMI · MODERATSIYA NAVBATI</p>
          <h1>Fake Skill va Nomuvofiqliklar nazorati</h1>
          <p className="subtitle">
            AI detektorga emas, 5 qatlamli kross-tahlil va baholovchilar kelishmovchiligiga asoslangan insoniy qarorlar (Human-in-the-loop).
          </p>
        </div>
        <div className="national-badge" style={{ padding: "8px 14px", fontSize: "12px" }}>
          <Icon name="shield" size={15} /> Avtomatik jazo yo‘q · Barcha holatlarda yakuniy qaror insonda
        </div>
      </section>

      {/* Stats Overview */}
      <div className="task-overview" style={{ marginBottom: "26px" }}>
        <div className="card overview-stat">
          <div className="stat-icon amber">
            <Icon name="alert" />
          </div>
          <div>
            <span>Ochiq bayroqlar soni</span>
            <strong>{flags.filter((f) => f.status === "open").length} ta holat</strong>
          </div>
        </div>
        <div className="card overview-stat">
          <div className="stat-icon emerald">
            <Icon name="check" />
          </div>
          <div>
            <span>Hal qilingan holatlar</span>
            <strong>{flags.filter((f) => f.status === "resolved").length} ta</strong>
          </div>
        </div>
        <div className="card overview-stat">
          <div className="stat-icon violet">
            <Icon name="users" />
          </div>
          <div>
            <span>Kross-qatlam nomuvofiqliklari</span>
            <strong>2 ta (≥ 35 ball farq)</strong>
          </div>
        </div>
        <div className="card overview-stat">
          <div className="stat-icon blue">
            <Icon name="file" />
          </div>
          <div>
            <span>Baholovchilar ixtilofi</span>
            <strong>1 ta (&gt; 20 ball farq)</strong>
          </div>
        </div>
      </div>

      {/* Flags List */}
      <section className="card" style={{ padding: "26px", marginBottom: "26px" }}>
        <div className="card-heading" style={{ marginBottom: "18px" }}>
          <div>
            <p className="card-kicker">MODERATOR ISH STOLI</p>
            <h2>Tekshiruv talab qilinadigan holatlar ro‘yxati</h2>
          </div>
          <span className="level-badge">Prioritet bo‘yicha tartiblangan</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {flags.map((flag) => (
            <div
              key={flag.id}
              style={{
                padding: "20px",
                borderRadius: "12px",
                border: "1px solid var(--border)",
                background: flag.status === "resolved" ? "#f8fafc" : "white",
                opacity: flag.status === "resolved" ? 0.65 : 1,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "10px",
                        fontWeight: 800,
                        background:
                          flag.severity === "high"
                            ? "#fee2e2"
                            : flag.severity === "medium"
                            ? "#fef3c7"
                            : "#f1f5f9",
                        color:
                          flag.severity === "high"
                            ? "#dc2626"
                            : flag.severity === "medium"
                            ? "#b45309"
                            : "#475569",
                      }}
                    >
                      {flag.type} · {flag.severity.toUpperCase()}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>{flag.timestamp}</span>
                  </div>
                  <h3 style={{ margin: "2px 0", fontSize: "16px", color: "var(--navy)" }}>
                    {flag.studentName} — <span style={{ fontWeight: 500 }}>{flag.skillName}</span>
                  </h3>
                </div>

                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: "20px",
                    fontSize: "11px",
                    fontWeight: 700,
                    background: flag.status === "resolved" ? "#ecfdf5" : "#fff7ed",
                    color: flag.status === "resolved" ? "#059669" : "#c2410c",
                  }}
                >
                  {flag.status === "resolved" ? "Hal qilingan" : "Kutilmoqda"}
                </span>
              </div>

              <p style={{ margin: "10px 0 16px", fontSize: "13px", color: "#334155", lineHeight: "1.5" }}>
                {flag.reason}
              </p>

              {flag.status === "open" && (
                <div style={{ display: "flex", gap: "10px", borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
                  <button
                    className="primary-button"
                    style={{ fontSize: "12px", padding: "8px 14px" }}
                    onClick={() => setActiveFlag(flag)}
                  >
                    Holatni ko‘rib chiqish & Viva transkripti
                  </button>
                  <button
                    className="dark-outline"
                    style={{ fontSize: "12px", padding: "8px 14px" }}
                    onClick={() => handleResolve(flag.id, "Asossiz deb topildi va yopildi")}
                  >
                    Asossiz (Oqlash)
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Review Dialog Modal */}
      {activeFlag && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setActiveFlag(null)}>
          <div
            className="modal"
            style={{ maxWidth: "640px" }}
            role="dialog"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setActiveFlag(null)}>
              <Icon name="close" />
            </button>
            <div className="modal-symbol">
              <Icon name="shield" size={30} />
            </div>
            <p className="eyebrow">MODERATSIYA EKSPERTIZASI</p>
            <h2>{activeFlag.studentName} · Holat tahlili</h2>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "16px" }}>
              Ko‘nikma: <strong>{activeFlag.skillName}</strong> · Turi: <strong>{activeFlag.type}</strong>
            </p>

            <div
              style={{
                textAlign: "left",
                padding: "16px",
                borderRadius: "10px",
                background: "#f8fafc",
                border: "1px solid var(--border)",
                fontSize: "12px",
                marginBottom: "20px",
                maxHeight: "200px",
                overflowY: "auto",
              }}
            >
              <strong>AI Viva Transkript parchalari:</strong>
              <div style={{ marginTop: "8px", color: "#475569" }}>
                <p>
                  <strong>Savol #1 (AI Examiner):</strong> Nega rate limit algoritmini taqsimlangan keshda token bucket o‘rniga sliding window bilan qildingiz?
                </p>
                <p>
                  <strong>Javob (Talaba):</strong> Bilmadim, kod shunday yozilgan edi...
                </p>
                <p style={{ color: "#dc2626" }}>
                  <strong>Xulosa:</strong> Talaba topshirilgan yechimning muhim parametrlarini tushuntirib bera olmadi.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                className="primary-button full"
                onClick={() => handleResolve(activeFlag.id, "Qayta og‘zaki Viva tayinlandi (Daraja to‘xtatildi)")}
              >
                Qayta Insoniy Viva tayinlash
              </button>
              <button
                className="dark-outline"
                style={{ width: "100%", padding: "10px" }}
                onClick={() => handleResolve(activeFlag.id, "Talaba javobi qoniqarli deb topildi")}
              >
                Qoniqarli deb hisoblash (Bayroqni yopish)
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="toast">
          <Icon name="check" /> {toastMessage}
          <button onClick={() => setToastMessage(null)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
