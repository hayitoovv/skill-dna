import { useState } from "react";
import { Icon } from "../common/Icons";
import { employerCandidates } from "../../data/ontology";
import type { EmployerCandidate, DirectionCode } from "../../types";

export default function EmployerPortal() {
  const [selectedDirection, setSelectedDirection] = useState<DirectionCode | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [minScore, setMinScore] = useState(75);
  const [minConfidence, setMinConfidence] = useState(70);
  const [selectedCandidate, setSelectedCandidate] = useState<EmployerCandidate | null>(null);
  const [invitedId, setInvitedId] = useState<string | null>(null);

  const filteredCandidates = employerCandidates.filter((cand) => {
    if (selectedDirection !== "all" && cand.direction !== selectedDirection) return false;
    if (cand.overallScore < minScore) return false;
    if (cand.confidence < minConfidence) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = cand.name.toLowerCase().includes(q);
      const matchDir = cand.directionName.toLowerCase().includes(q);
      const matchSkills = cand.topSkills.some((s) => s.name.toLowerCase().includes(q));
      if (!matchName && !matchDir && !matchSkills) return false;
    }
    return true;
  });

  const handleInvite = (cand: EmployerCandidate) => {
    setInvitedId(cand.id);
    setTimeout(() => {
      setInvitedId(null);
    }, 3000);
  };

  const directionOptions: { key: DirectionCode | "all"; label: string; icon: any } = [
    { key: "all", label: "Barcha yo‘nalishlar", icon: "grid" },
    { key: "software", label: "Dasturiy injiniring", icon: "code" },
    { key: "computer", label: "Kompyuter injiniringi", icon: "cpu" },
    { key: "ai", label: "Sun’iy intellekt", icon: "sparkles" },
  ] as const;

  return (
    <div className="page">
      {/* Top Welcome & Header */}
      <section className="welcome-row">
        <div>
          <p className="eyebrow">ISH BERUVCHI PANELI · TALENT SEARCH</p>
          <h1>Tasdiqlangan iqtidorlarni qidirish</h1>
          <p className="subtitle">
            Rezyumega emas, 5 qatlamli tekshirilgan dalillar (Evidence Graph)ga asoslangan ishonchli saralash.
          </p>
        </div>
      </section>

      {/* Quick Summary Stats Bar */}
      <section className="employer-stats-row">
        <div className="employer-stat-pill">
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "#eff6ff",
              color: "#2563eb",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="users" size={20} />
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
              Mos nomzodlar
            </div>
            <strong style={{ fontSize: "19px", color: "var(--navy)" }}>{filteredCandidates.length} ta mutaxassis</strong>
          </div>
        </div>

        <div className="employer-stat-pill">
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "#ecfdf5",
              color: "#059669",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="award" size={20} />
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
              O‘rtacha moslik
            </div>
            <strong style={{ fontSize: "19px", color: "#059669" }}>
              {filteredCandidates.length > 0
                ? `${Math.round(filteredCandidates.reduce((acc, c) => acc + c.matchScore, 0) / filteredCandidates.length)}%`
                : "0%"}
            </strong>
          </div>
        </div>

        <div className="employer-stat-pill">
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "#fef3c7",
              color: "#d97706",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="shieldCheck" size={20} />
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
              Ishonchlilik kafolati
            </div>
            <strong style={{ fontSize: "19px", color: "var(--navy)" }}>5 Qatlamli Viva</strong>
          </div>
        </div>

        <div className="employer-stat-pill">
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "#f5f3ff",
              color: "#7c3aed",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="workflow" size={20} />
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
              Raqamli sertifikat
            </div>
            <strong style={{ fontSize: "19px", color: "var(--navy)" }}>Open Badges 3.0</strong>
          </div>
        </div>
      </section>

      {/* Advanced Filter Card */}
      <section className="employer-filter-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
          <div>
            <p className="card-kicker" style={{ margin: 0 }}>TALABLAR VA MEZONLAR FILTRI</p>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>Vakansiyangiz talablariga mos ko‘rsatkichlarni belgilang</span>
          </div>

          {/* Search box */}
          <div style={{ position: "relative", minWidth: "260px" }}>
            <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }}>
              <Icon name="search" size={16} />
            </span>
            <input
              type="text"
              placeholder="Ism yoki ko‘nikma bo‘yicha qidirish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px 9px 36px",
                borderRadius: "10px",
                border: "1.5px solid var(--border)",
                fontSize: "13px",
                outline: "none",
                background: "#f8fafc",
                transition: "border-color 0.2s, background 0.2s",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--royal)";
                e.target.style.background = "#ffffff";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--border)";
                e.target.style.background = "#f8fafc";
              }}
            />
          </div>
        </div>

        {/* Direction Chips */}
        <div style={{ marginBottom: "18px" }}>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "8px", letterSpacing: "0.05em" }}>
            MUTAXASSISLIK YO‘NALISHI:
          </label>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {directionOptions.map((dir) => {
              const active = selectedDirection === dir.key;
              return (
                <button
                  key={dir.key}
                  type="button"
                  onClick={() => setSelectedDirection(dir.key)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "10px",
                    border: active ? "1.5px solid var(--navy)" : "1.5px solid #e2e8f0",
                    background: active ? "var(--navy)" : "#ffffff",
                    color: active ? "#ffffff" : "var(--navy)",
                    fontSize: "12.5px",
                    fontWeight: active ? 700 : 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    transition: "all 0.15s ease",
                    boxShadow: active ? "0 4px 12px rgba(15, 39, 68, 0.15)" : "none",
                  }}
                >
                  <Icon name={dir.icon} size={14} />
                  <span>{dir.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dual Sliders */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "24px",
            paddingTop: "14px",
            borderTop: "1px solid #f1f5f9",
          }}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.05em" }}>
                MINIMAL SKILL SCORE:
              </label>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "var(--royal)",
                  background: "#eff6ff",
                  padding: "3px 9px",
                  borderRadius: "6px",
                  border: "1px solid #bfdbfe",
                }}
              >
                {minScore} / 100 ball
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="90"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--royal)", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
              <span>50 ball</span>
              <span>70 (Standart)</span>
              <span>90 (Senior)</span>
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.05em" }}>
                MINIMAL CONFIDENCE (ISHONCHLILIK):
              </label>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#059669",
                  background: "#ecfdf5",
                  padding: "3px 9px",
                  borderRadius: "6px",
                  border: "1px solid #a7f3d0",
                }}
              >
                {minConfidence}% dalillar bilan
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="90"
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#059669", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
              <span>50%</span>
              <span>70% (Tavsiya)</span>
              <span>90% (Isbotlangan)</span>
            </div>
          </div>
        </div>
      </section>

      {/* Candidates List Heading */}
      <div className="section-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "18px" }}>
        <div>
          <h2>Mos nomzodlar ({filteredCandidates.length})</h2>
          <p>Kompaniyangiz talablariga mos kelgan 5 qatlamli tekshiruvdan o‘tgan mutaxassislar</p>
        </div>
        {(selectedDirection !== "all" || searchQuery || minScore > 75 || minConfidence > 70) && (
          <button
            type="button"
            onClick={() => {
              setSelectedDirection("all");
              setSearchQuery("");
              setMinScore(75);
              setMinConfidence(70);
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--royal)",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <Icon name="refresh" size={14} /> Filtrlarni tiklash
          </button>
        )}
      </div>

      {filteredCandidates.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>
          <div style={{ width: "54px", height: "54px", borderRadius: "50%", background: "#f1f5f9", color: "var(--muted)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Icon name="search" size={24} />
          </div>
          <h3 style={{ margin: "0 0 6px", color: "var(--navy)", fontSize: "17px" }}>Mos nomzod topilmadi</h3>
          <p style={{ margin: 0, fontSize: "13.5px", maxWidth: "420px", marginLeft: "auto", marginRight: "auto" }}>
            Qidiruv mezonlarini yoki ball chegaralarini biroz pasaytirib ko‘ring.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "22px" }}>
          {filteredCandidates.map((cand) => (
            <article key={cand.id} className="candidate-card">
              {/* Card Top: Candidate Info & Match Score */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      minWidth: "48px",
                      borderRadius: "14px",
                      background: "linear-gradient(135deg, #0f2744, #1e3a5f)",
                      color: "#ffffff",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 800,
                      fontSize: "16px",
                      boxShadow: "0 4px 14px rgba(15, 39, 68, 0.22)",
                      border: "1.5px solid rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    {cand.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "17.5px", fontWeight: 700, color: "var(--navy)" }}>{cand.name}</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", marginTop: "3px" }}>
                      <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 500 }}>{cand.directionName}</span>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "6px",
                          background: "#eff6ff",
                          color: "var(--royal)",
                          fontSize: "11px",
                          fontWeight: 700,
                          border: "1px solid #bfdbfe",
                        }}
                      >
                        {cand.level}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Match Score Badge */}
                <div style={{ textAlign: "right", minWidth: "120px", flexShrink: 0 }}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "7px",
                      padding: "6px 13px",
                      borderRadius: "20px",
                      background: "#ecfdf5",
                      color: "#059669",
                      fontWeight: 800,
                      fontSize: "13px",
                      border: "1px solid #a7f3d0",
                      boxShadow: "0 2px 6px rgba(5, 150, 105, 0.1)",
                    }}
                  >
                    <span className="live-pulse-indicator" />
                    <span>{cand.matchScore}% moslik</span>
                  </div>
                  <div className="progress-track" style={{ height: "6px", margin: "7px 0 0", background: "#e2e8f0", borderRadius: "10px" }}>
                    <div
                      style={{
                        width: `${cand.matchScore}%`,
                        height: "100%",
                        borderRadius: "10px",
                        background: "linear-gradient(90deg, #059669, #10b981)",
                        transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Match Rationale Box */}
              <div
                style={{
                  padding: "13px 15px",
                  borderRadius: "12px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderLeft: "3.5px solid var(--royal)",
                  marginBottom: "16px",
                  fontSize: "12.5px",
                  color: "#334155",
                  lineHeight: "1.55",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--navy)", fontSize: "11px", fontWeight: 800, marginBottom: "4px", letterSpacing: "0.03em" }}>
                  <Icon name="sparkles" size={13} />
                  <span>NIMA UCHUN MOS? (WHY MATCH?)</span>
                </div>
                {cand.matchReason}
              </div>

              {/* Skills Breakdown */}
              <div style={{ marginBottom: "18px" }}>
                <span style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.07em" }}>
                  ASOSIY KO‘NIKMALAR:
                </span>
                <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", marginTop: "7px" }}>
                  {cand.topSkills.map((sk) => (
                    <span
                      key={sk.name}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "8px",
                        background: "#f1f5f9",
                        color: "var(--navy)",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        border: "1px solid #e2e8f0",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      {sk.name}: <strong style={{ color: "var(--royal)" }}>{sk.score}</strong>
                    </span>
                  ))}
                  <span
                    style={{
                      padding: "5px 10px",
                      borderRadius: "8px",
                      background: "#fef3c7",
                      color: "#92400e",
                      fontSize: "11.5px",
                      fontWeight: 700,
                      border: "1px solid #fde68a",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <Icon name="award" size={13} />
                    {cand.verifiedBadges} ta OB 3.0 sertifikat
                  </span>
                </div>
              </div>

              {/* Actions Row (Both buttons perfectly aligned on the same row with equal height) */}
              <div className="candidate-actions-row">
                <button
                  type="button"
                  className="candidate-evidence-btn"
                  onClick={() => setSelectedCandidate(cand)}
                >
                  <Icon name="shieldCheck" size={16} />
                  <span>Dalillarni ko‘rish</span>
                </button>
                <button
                  type="button"
                  className={`candidate-invite-btn ${invitedId === cand.id ? "is-invited" : ""}`}
                  onClick={() => handleInvite(cand)}
                >
                  {invitedId === cand.id ? (
                    <>
                      <Icon name="checkCircle" size={16} />
                      <span>Taklif yuborildi!</span>
                    </>
                  ) : (
                    <>
                      <Icon name="briefcase" size={16} />
                      <span>Suhbatga taklif qilish</span>
                    </>
                  )}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal for viewing Candidate Evidence Graph */}
      {selectedCandidate && (
        <div className="modal-backdrop employer-modal-backdrop" role="presentation" onMouseDown={() => setSelectedCandidate(null)}>
          <div
            className="modal employer-modal"
            style={{ maxWidth: "620px", borderRadius: "20px", padding: "28px" }}
            role="dialog"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setSelectedCandidate(null)}>
              <Icon name="close" />
            </button>
            <div className="modal-symbol" style={{ background: "linear-gradient(135deg, #0f2744, #1e3a5f)", color: "white" }}>
              <Icon name="shieldCheck" size={30} />
            </div>
            <p className="eyebrow" style={{ color: "var(--royal)" }}>VERIFIED CANDIDATE EVIDENCE · OB 3.0</p>
            <h2 style={{ fontSize: "22px", margin: "4px 0" }}>{selectedCandidate.name} · Dalillar zanjiri</h2>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "18px" }}>
              Nomzod tomonidan berilgan rasmiy rozilik (Consent) asosida ochiqlangan tekshirilgan ko‘nikmalar dalillari.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", textAlign: "left", marginBottom: "22px" }}>
              <div style={{ padding: "14px 16px", borderRadius: "12px", background: "#f8fafc", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: "13.5px", color: "var(--navy)" }}>Umumiy Skill Score:</strong>
                  <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>5 qatlamli tekshirilgan indeks</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "18px", fontWeight: 800, color: "var(--royal)" }}>{selectedCandidate.overallScore}/100</span>
                  <div style={{ fontSize: "11.5px", color: "#059669", fontWeight: 700 }}>{selectedCandidate.confidence}% Ishonchlilik</div>
                </div>
              </div>

              <div style={{ padding: "14px 16px", borderRadius: "12px", background: "#f8fafc", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <strong style={{ fontSize: "13.5px", color: "var(--navy)" }}>Qatlamlar bo‘yicha tekshiruv:</strong>
                  <span style={{ padding: "3px 8px", borderRadius: "6px", background: "#eff6ff", color: "var(--royal)", fontSize: "11px", fontWeight: 800 }}>
                    {selectedCandidate.level} MUTAXASSIS
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px", textAlign: "center" }}>
                  <div style={{ padding: "6px 4px", borderRadius: "8px", background: "#ffffff", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "10px", color: "var(--muted)", fontWeight: 700 }}>KNOW</div>
                    <strong style={{ fontSize: "13px", color: "#2563eb" }}>88%</strong>
                  </div>
                  <div style={{ padding: "6px 4px", borderRadius: "8px", background: "#ffffff", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "10px", color: "var(--muted)", fontWeight: 700 }}>DO</div>
                    <strong style={{ fontSize: "13px", color: "#059669" }}>85%</strong>
                  </div>
                  <div style={{ padding: "6px 4px", borderRadius: "8px", background: "#ffffff", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "10px", color: "var(--muted)", fontWeight: 700 }}>ADAPT</div>
                    <strong style={{ fontSize: "13px", color: "#7c3aed" }}>78%</strong>
                  </div>
                  <div style={{ padding: "6px 4px", borderRadius: "8px", background: "#ffffff", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "10px", color: "var(--muted)", fontWeight: 700 }}>DEFEND</div>
                    <strong style={{ fontSize: "13px", color: "#d97706" }}>82%</strong>
                  </div>
                  <div style={{ padding: "6px 4px", borderRadius: "8px", background: "#ffffff", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "10px", color: "var(--muted)", fontWeight: 700 }}>PROVE</div>
                    <strong style={{ fontSize: "13px", color: "#e11d48" }}>80%</strong>
                  </div>
                </div>
              </div>

              <div style={{ padding: "13px 15px", borderRadius: "12px", background: "#ecfdf5", border: "1px solid #a7f3d0", fontSize: "12.5px", color: "#065f46", display: "flex", alignItems: "center", gap: "10px" }}>
                <Icon name="checkCircle" size={18} />
                <span>
                  <strong>AI Integrity tekshiruvi:</strong> Viva transkripti, GitHub kodi va autotestlar to‘liq tasdiqlangan. Shubhali yoki plagiat dalillar mavjud emas.
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="candidate-evidence-btn"
                style={{ flex: 1 }}
                onClick={() => setSelectedCandidate(null)}
              >
                Yopish
              </button>
              <button
                type="button"
                className="candidate-invite-btn"
                style={{ flex: 1.5 }}
                onClick={() => {
                  handleInvite(selectedCandidate);
                  setSelectedCandidate(null);
                }}
              >
                <Icon name="briefcase" size={16} />
                <span>Suhbatga taklif qilish</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
