import { useState } from "react";
import { Icon } from "../common/Icons";
import { employerCandidates } from "../../data/ontology";
import type { EmployerCandidate, DirectionCode } from "../../types";

export default function EmployerPortal() {
  const [selectedDirection, setSelectedDirection] = useState<DirectionCode | "all">("all");
  const [minScore, setMinScore] = useState(75);
  const [minConfidence, setMinConfidence] = useState(70);
  const [selectedCandidate, setSelectedCandidate] = useState<EmployerCandidate | null>(null);
  const [invitedId, setInvitedId] = useState<string | null>(null);

  const filteredCandidates = employerCandidates.filter((cand) => {
    if (selectedDirection !== "all" && cand.direction !== selectedDirection) return false;
    if (cand.overallScore < minScore) return false;
    if (cand.confidence < minConfidence) return false;
    return true;
  });

  const handleInvite = (cand: EmployerCandidate) => {
    setInvitedId(cand.id);
    setTimeout(() => {
      setInvitedId(null);
    }, 2500);
  };

  return (
    <div className="page">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">ISH BERUVCHI PANELI · TALENT SEARCH</p>
          <h1>Tasdiqlangan iqtidorlarni qidirish</h1>
          <p className="subtitle">
            Rezyumega emas, 5 qatlamli tekshirilgan dalillar (Evidence Graph)ga asoslangan saralash.
          </p>
        </div>
        <div className="national-badge" style={{ padding: "8px 14px", fontSize: "12px" }}>
          <Icon name="check" size={15} /> Faqat rozilik (Consent) berilgan profillar
        </div>
      </section>

      {/* Filter Card */}
      <section className="card" style={{ padding: "24px", marginBottom: "26px" }}>
        <p className="card-kicker">TALABLAR VA MEZONLAR FILTRI</p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "20px",
            marginTop: "14px",
          }}
        >
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "6px" }}>
              YO‘NALISH
            </label>
            <select
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "white",
                fontSize: "13px",
              }}
              value={selectedDirection}
              onChange={(e) => setSelectedDirection(e.target.value as DirectionCode | "all")}
            >
              <option value="all">Barcha yo‘nalishlar</option>
              <option value="software">Dasturiy injiniring</option>
              <option value="computer">Kompyuter injiniringi</option>
              <option value="ai">Sun’iy intellekt</option>
            </select>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)" }}>MINIMAL SKILL SCORE</label>
              <strong style={{ fontSize: "12px", color: "var(--royal)" }}>{minScore} / 100</strong>
            </div>
            <input
              type="range"
              min="50"
              max="90"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)" }}>MINIMAL CONFIDENCE (ISHONCHLILIK)</label>
              <strong style={{ fontSize: "12px", color: "var(--emerald)" }}>{minConfidence}%</strong>
            </div>
            <input
              type="range"
              min="50"
              max="90"
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>
        </div>
      </section>

      {/* Candidates List */}
      <div className="section-heading">
        <div>
          <h2>Mos nomzodlar ({filteredCandidates.length})</h2>
          <p>Kompaniyangiz talablariga mos kelgan tasdiqlangan mutaxassislar</p>
        </div>
      </div>

      {filteredCandidates.length === 0 ? (
        <div className="card" style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
          <p>Ushbu mezonlarga mos nomzod topilmadi. Qidiruv filtrlarini biroz yumshatib ko‘ring.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: "20px" }}>
          {filteredCandidates.map((cand) => (
            <article key={cand.id} className="card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="avatar" style={{ width: "44px", height: "44px", fontSize: "14px" }}>
                    {cand.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "17px", color: "var(--navy)" }}>{cand.name}</h3>
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--muted)" }}>
                      {cand.directionName} · <span className="level-badge">{cand.level}</span>
                    </p>
                  </div>
                </div>

                <div style={{ textAlign: "right", minWidth: "125px" }}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "6px 12px",
                      borderRadius: "20px",
                      background: "#ecfdf5",
                      color: "#059669",
                      fontWeight: 800,
                      fontSize: "13px",
                    }}
                  >
                    <Icon name="check" size={14} /> {cand.matchScore}% moslik
                  </div>
                  <div className="progress-track" style={{ height: "6px", margin: "6px 0 0", background: "#d1fae5" }}>
                    <div
                      style={{
                        width: `${cand.matchScore}%`,
                        height: "100%",
                        borderRadius: "10px",
                        background: "linear-gradient(90deg, #059669, #10b981)",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Match rationale */}
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "9px",
                  background: "#f8fafc",
                  borderLeft: "3px solid var(--royal)",
                  marginBottom: "16px",
                  fontSize: "12px",
                  color: "#334155",
                  lineHeight: "1.5",
                }}
              >
                <strong style={{ display: "block", color: "var(--navy)", fontSize: "11px", marginBottom: "2px" }}>
                  NIMA UCHUN MOS? (WHY MATCH?):
                </strong>
                {cand.matchReason}
              </div>

              {/* Skills breakdown */}
              <div style={{ marginBottom: "18px" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.08em" }}>
                  ASOSIY KO‘NIKMALAR:
                </span>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                  {cand.topSkills.map((sk) => (
                    <span
                      key={sk.name}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "8px",
                        background: "#eff6ff",
                        color: "var(--navy)",
                        fontSize: "11px",
                        fontWeight: 600,
                        border: "1px solid #bfdbfe",
                      }}
                    >
                      {sk.name}: <strong>{sk.score}</strong>
                    </span>
                  ))}
                  <span
                    style={{
                      padding: "5px 10px",
                      borderRadius: "8px",
                      background: "#fef3c7",
                      color: "#92400e",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    {cand.verifiedBadges} ta OB 3.0 sertifikat
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "center",
                  paddingTop: "14px",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <button
                  className="dark-outline"
                  style={{ flex: 1, padding: "9px 12px", fontSize: "12px" }}
                  onClick={() => setSelectedCandidate(cand)}
                >
                  Dalillarni ko‘rish (Evidence)
                </button>
                <button
                  className="primary-button"
                  style={{ flex: 1, padding: "9px 12px", fontSize: "12px" }}
                  onClick={() => handleInvite(cand)}
                >
                  {invitedId === cand.id ? (
                    <>
                      <Icon name="check" size={15} /> Taklif yuborildi!
                    </>
                  ) : (
                    <>
                      <Icon name="briefcase" size={15} /> Suhbatga taklif qilish
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
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelectedCandidate(null)}>
          <div
            className="modal"
            style={{ maxWidth: "600px" }}
            role="dialog"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setSelectedCandidate(null)}>
              <Icon name="close" />
            </button>
            <div className="modal-symbol">
              <Icon name="dna" size={30} />
            </div>
            <p className="eyebrow">VERIFIED CANDIDATE EVIDENCE</p>
            <h2>{selectedCandidate.name} · Dalillar zanjiri</h2>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "16px" }}>
              Nomzod bergan rozilik asosida ochiqlangan tekshirilgan ko‘nikmalar dalillari.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", textAlign: "left", marginBottom: "20px" }}>
              <div style={{ padding: "12px", borderRadius: "8px", background: "#f8fafc", border: "1px solid var(--border)" }}>
                <strong>Umumiy Skill Score:</strong> {selectedCandidate.overallScore}/100 · <strong>Confidence:</strong> {selectedCandidate.confidence}%
              </div>
              <div style={{ padding: "12px", borderRadius: "8px", background: "#f8fafc", border: "1px solid var(--border)" }}>
                <strong>Malaka darajasi:</strong> {selectedCandidate.level} (KNOW, DO, ADAPT, DEFEND to‘liq tasdiqlangan)
              </div>
              <div style={{ padding: "12px", borderRadius: "8px", background: "#f8fafc", border: "1px solid var(--border)" }}>
                <strong>AI Viva:</strong> Transkript tekshiruvdan o‘tgan, hech qanday Integrity bayrog‘i yo‘q.
              </div>
            </div>

            <button className="primary-button full" onClick={() => { handleInvite(selectedCandidate); setSelectedCandidate(null); }}>
              Nomzod bilan bog‘lanish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
