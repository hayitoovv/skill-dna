import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "../common/Icons";
import type { IconName } from "../common/Icons";
import { employerCandidates } from "../../data/ontology";
import type { EmployerCandidate, DirectionCode } from "../../types";
import { api, ApiError, hasSession } from "../../services/api";

type DataMode = "loading" | "live" | "demo";

interface LiveStrength {
  skill: string;
  name: string;
  current: number;
  needed: number;
  score?: number;
  confidence?: number;
}

interface LiveMatch {
  id: string;
  name: string;
  direction: string | null;
  course: string | null;
  matchPct: number;
  explanation?: { strongest?: string[]; main_gaps?: string[]; missing_must?: string[] };
  gaps?: { skill: string; name: string }[];
  strengths?: LiveStrength[];
}

interface LiveProfileSkill {
  code: string;
  name: string;
  score: number | null;
  confidence: number | null;
  level: string | null;
  layers: Record<string, number | null>;
  evidence: { layer: string; title: string; verified_by: string; human_verified: boolean; date: string }[];
}

interface LiveProfile {
  id: string;
  name: string;
  direction: string | null;
  course: string | null;
  skills: LiveProfileSkill[];
  notice?: string;
}

/** One card's worth of data, built either from demo data or from a live match. */
interface CardView {
  id: string;
  name: string;
  directionName: string;
  levelLabel: string | null;
  matchScore: number;
  matchReason: ReactNode;
  topSkills: { name: string; score: number }[];
  verifiedBadges: number | null;
  demo: EmployerCandidate | null;
}

const DIRECTIONS: DirectionCode[] = ["software", "computer", "ai"];
// Preferred pilot skill per direction; falls back to the first pilot skill the ontology returns.
const PREFERRED_SKILL: Record<DirectionCode, string> = {
  software: "SE-BACKEND",
  computer: "CE-NET",
  ai: "AI-ML",
};
const LAYER_COLORS: Record<string, string> = {
  KNOW: "var(--accent)",
  DO: "var(--success)",
  ADAPT: "var(--violet)",
  DEFEND: "var(--warning)",
  PROVE: "var(--rose)",
};
const LAYERS = ["KNOW", "DO", "ADAPT", "DEFEND", "PROVE"];

const fmt = (v: number | null | undefined) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : String(Math.round(v));

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 3) || "?";

export default function EmployerPortal() {
  const [selectedDirection, setSelectedDirection] = useState<DirectionCode | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [minScore, setMinScore] = useState(75);
  const [minConfidence, setMinConfidence] = useState(70);
  const [selectedCandidate, setSelectedCandidate] = useState<CardView | null>(null);
  const [invitedId, setInvitedId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<{ id: string; message: string } | null>(null);

  const [mode, setMode] = useState<DataMode>(() => (hasSession() ? "loading" : "demo"));
  const [searching, setSearching] = useState(false);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [profile, setProfile] = useState<LiveProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const skillCache = useRef<Partial<Record<DirectionCode, string>>>({});
  const requestSeq = useRef(0);
  const liveFailed = useRef(!hasSession());

  const pilotSkill = async (dir: DirectionCode): Promise<string> => {
    const cached = skillCache.current[dir];
    if (cached) return cached;
    const skills = await api.getSkills(dir);
    const preferred = skills.find((s) => s.code === PREFERRED_SKILL[dir]);
    const code: string = preferred?.code ?? skills.find((s) => s.pilot)?.code ?? skills[0]?.code ?? PREFERRED_SKILL[dir];
    skillCache.current[dir] = code;
    return code;
  };

  // Live search: criteria from the direction's pilot skill + slider thresholds, then consenting matches (debounced).
  useEffect(() => {
    if (liveFailed.current) return;
    const seq = ++requestSeq.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const dirs = selectedDirection === "all" ? DIRECTIONS : [selectedDirection];
        const perDirection = await Promise.all(
          dirs.map(async (dir) => {
            const code = await pilotSkill(dir);
            const crit = await api.createCriteria({
              job_title: `Talent search · ${dir} · ${code}`,
              min_confidence: minConfidence,
              skills: [{ skill_code: code, min_score: minScore, importance: 1, must: true }],
            });
            return (await api.getCriteriaMatches(crit.id)) as LiveMatch[];
          })
        );
        if (seq !== requestSeq.current) return;
        const byId = new Map<string, LiveMatch>();
        for (const m of perDirection.flat()) {
          const prev = byId.get(m.id);
          if (!prev || m.matchPct > prev.matchPct) byId.set(m.id, m);
        }
        setLiveMatches([...byId.values()].sort((a, b) => b.matchPct - a.matchPct));
        setMode("live");
      } catch (err) {
        if (seq !== requestSeq.current) return;
        // 401/403 (e.g. non-employer via role switcher) or network failure: demo data for the rest of the session.
        liveFailed.current = true;
        setMode("demo");
        if (!(err instanceof ApiError)) console.warn("Employer live search failed:", err);
      } finally {
        if (seq === requestSeq.current) setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDirection, minScore, minConfidence]);

  const isLive = mode === "live";
  const q = searchQuery.trim().toLowerCase();

  const filteredCandidates: CardView[] = useMemo(() => {
    if (mode === "live") {
      return liveMatches
        .filter((m) => {
          if (!q) return true;
          return (
            m.name.toLowerCase().includes(q) ||
            (m.direction ?? "").toLowerCase().includes(q) ||
            (m.strengths ?? []).some((s) => s.name.toLowerCase().includes(q))
          );
        })
        .map((m) => {
          const strongest = m.explanation?.strongest ?? [];
          const gaps = m.explanation?.main_gaps ?? [];
          const missing = m.explanation?.missing_must ?? [];
          return {
            id: m.id,
            name: m.name,
            directionName: m.direction ?? "—",
            levelLabel: m.course,
            matchScore: Math.round(m.matchPct),
            matchReason: (
              <>
                <div>Kuchli tomonlar: {strongest.length > 0 ? strongest.join("; ") : "—"}</div>
                {gaps.length > 0 && <div>Asosiy bo‘shliqlar: {gaps.join("; ")}</div>}
                {missing.length > 0 && <div>Majburiy, lekin yetishmaydi: {missing.join(", ")}</div>}
              </>
            ),
            topSkills: (m.strengths ?? []).map((s) => ({ name: s.name, score: Math.round(s.score ?? s.current) })),
            verifiedBadges: null,
            demo: null,
          };
        });
    }
    return employerCandidates
      .filter((cand) => {
        if (selectedDirection !== "all" && cand.direction !== selectedDirection) return false;
        if (cand.overallScore < minScore) return false;
        if (cand.confidence < minConfidence) return false;
        if (q) {
          const matchName = cand.name.toLowerCase().includes(q);
          const matchDir = cand.directionName.toLowerCase().includes(q);
          const matchSkills = cand.topSkills.some((s) => s.name.toLowerCase().includes(q));
          if (!matchName && !matchDir && !matchSkills) return false;
        }
        return true;
      })
      .map((cand) => ({
        id: cand.id,
        name: cand.name,
        directionName: cand.directionName,
        levelLabel: cand.level,
        matchScore: cand.matchScore,
        matchReason: cand.matchReason,
        topSkills: cand.topSkills,
        verifiedBadges: cand.verifiedBadges,
        demo: cand,
      }));
  }, [mode, liveMatches, q, selectedDirection, minScore, minConfidence]);

  const openEvidence = async (cand: CardView) => {
    setSelectedCandidate(cand);
    setProfile(null);
    setProfileError(null);
    if (cand.demo) return;
    setProfileLoading(true);
    try {
      setProfile((await api.getCandidate(cand.id)) as LiveProfile);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Dalillarni yuklab bo‘lmadi");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleInvite = async (cand: CardView) => {
    setInviteError(null);
    if (!cand.demo) {
      try {
        await api.inviteCandidate(cand.id);
      } catch (err) {
        setInviteError({ id: cand.id, message: err instanceof Error ? err.message : "Taklif yuborilmadi" });
        setTimeout(() => setInviteError(null), 4000);
        return;
      }
    }
    setInvitedId(cand.id);
    setTimeout(() => {
      setInvitedId(null);
    }, 3000);
  };

  const directionOptions: { key: DirectionCode | "all"; label: string; icon: IconName }[] = [
    { key: "all", label: "Barcha yo‘nalishlar", icon: "grid" },
    { key: "software", label: "Dasturiy injiniring", icon: "code" },
    { key: "computer", label: "Kompyuter injiniringi", icon: "cpu" },
    { key: "ai", label: "Sun’iy intellekt", icon: "sparkles" },
  ];

  const humanVerifiedCount = profile
    ? profile.skills.reduce((acc, sk) => acc + sk.evidence.filter((e) => e.human_verified).length, 0)
    : 0;

  return (
    <div className="page">
      {/* Top Welcome & Header */}
      <section className="welcome-row">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <p className="eyebrow" style={{ margin: 0 }}>ISH BERUVCHI PANELI · TALENT SEARCH</p>
            <span
              title={
                isLive
                  ? "Natijalar backenddan: faqat profilini ulashishga rozilik bergan talabalar"
                  : mode === "loading"
                    ? "Backendga ulanilmoqda"
                    : "Backend mavjud emas yoki ish beruvchi sifatida kirilmagan — namunaviy ma’lumot"
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "3px 9px",
                borderRadius: "20px",
                fontSize: "11px",
                fontWeight: 700,
                background: isLive ? "var(--success-soft)" : "var(--surface-3)",
                color: isLive ? "var(--success)" : "var(--muted)",
                border: isLive ? "1px solid var(--success-ring)" : "1px solid var(--border)",
              }}
            >
              {isLive && <span className="live-pulse-indicator" />}
              {mode === "loading" ? "Yuklanmoqda…" : isLive ? "Jonli ma’lumot" : "Demo ma’lumot"}
              {isLive && searching && <span style={{ fontWeight: 500 }}>· yangilanmoqda</span>}
            </span>
          </div>
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
              background: "var(--accent-soft)",
              color: "var(--accent)",
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
              background: "var(--success-soft)",
              color: "var(--success)",
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
            <strong style={{ fontSize: "19px", color: "var(--success)" }}>
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
              background: "var(--warning-soft)",
              color: "var(--warning)",
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
              background: "var(--violet-soft)",
              color: "var(--violet)",
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
                background: "var(--surface-2)",
                transition: "border-color 0.2s, background 0.2s",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--royal)";
                e.target.style.background = "#ffffff";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--border)";
                e.target.style.background = "var(--surface-2)";
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
                    border: active ? "1.5px solid var(--navy)" : "1.5px solid var(--border)",
                    background: active ? "var(--navy)" : "#ffffff",
                    color: active ? "#ffffff" : "var(--navy)",
                    fontSize: "12.5px",
                    fontWeight: active ? 700 : 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    transition: "all 0.15s ease",
                    boxShadow: active ? "0 4px 12px rgba(9, 9, 11, 0.15)" : "none",
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
            borderTop: "1px solid var(--surface-3)",
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
                  background: "var(--accent-soft)",
                  padding: "3px 9px",
                  borderRadius: "6px",
                  border: "1px solid var(--accent-ring)",
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
                  color: "var(--success)",
                  background: "var(--success-soft)",
                  padding: "3px 9px",
                  borderRadius: "6px",
                  border: "1px solid var(--success-ring)",
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
              style={{ width: "100%", accentColor: "var(--success)", cursor: "pointer" }}
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

      {mode === "loading" ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>
          <div style={{ width: "54px", height: "54px", borderRadius: "50%", background: "var(--surface-3)", color: "var(--muted)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Icon name="refresh" size={24} />
          </div>
          <h3 style={{ margin: "0 0 6px", color: "var(--navy)", fontSize: "17px" }}>Nomzodlar qidirilmoqda…</h3>
          <p style={{ margin: 0, fontSize: "13.5px" }}>Mezonlar bo‘yicha tasdiqlangan profillar tekshirilmoqda.</p>
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>
          <div style={{ width: "54px", height: "54px", borderRadius: "50%", background: "var(--surface-3)", color: "var(--muted)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Icon name={isLive && liveMatches.length === 0 ? "lock" : "search"} size={24} />
          </div>
          <h3 style={{ margin: "0 0 6px", color: "var(--navy)", fontSize: "17px" }}>Mos nomzod topilmadi</h3>
          {isLive && liveMatches.length === 0 ? (
            <p style={{ margin: 0, fontSize: "13.5px", maxWidth: "480px", marginLeft: "auto", marginRight: "auto" }}>
              Bu yerda faqat o‘z profilini ish beruvchilar bilan ulashishga rozilik bergan talabalar ko‘rinadi
              (maxfiylik qoidasi). Hozircha bu mezonlarga mos va rozilik bergan nomzod yo‘q — ball yoki ishonchlilik
              chegarasini pasaytirib ko‘ring.
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: "13.5px", maxWidth: "420px", marginLeft: "auto", marginRight: "auto" }}>
              Qidiruv mezonlarini yoki ball chegaralarini biroz pasaytirib ko‘ring.
            </p>
          )}
        </div>
      ) : (
        <div className={`candidates-grid ${filteredCandidates.length === 1 ? "single-item" : ""}`}>
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
                      background: "linear-gradient(160deg, #2b4fa8, #1e3a8a 45%, #0f2744)",
                      color: "#ffffff",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 800,
                      fontSize: "16px",
                      boxShadow: "0 4px 14px rgba(9, 9, 11, 0.22)",
                      border: "1.5px solid rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    {initials(cand.name)}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "17.5px", fontWeight: 700, color: "var(--navy)" }}>{cand.name}</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", marginTop: "3px" }}>
                      <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 500 }}>{cand.directionName}</span>
                      {cand.levelLabel && (
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "6px",
                            background: "var(--accent-soft)",
                            color: "var(--royal)",
                            fontSize: "11px",
                            fontWeight: 700,
                            border: "1px solid var(--accent-ring)",
                          }}
                        >
                          {cand.levelLabel}
                        </span>
                      )}
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
                      background: "var(--success-soft)",
                      color: "var(--success)",
                      fontWeight: 800,
                      fontSize: "13px",
                      border: "1px solid var(--success-ring)",
                      boxShadow: "0 2px 6px rgba(5, 150, 105, 0.1)",
                    }}
                  >
                    <span className="live-pulse-indicator" />
                    <span>{cand.matchScore}% moslik</span>
                  </div>
                  <div className="progress-track" style={{ height: "6px", margin: "7px 0 0", background: "var(--border)", borderRadius: "10px" }}>
                    <div
                      style={{
                        width: `${cand.matchScore}%`,
                        height: "100%",
                        borderRadius: "10px",
                        background: "linear-gradient(90deg, var(--success), var(--success-400))",
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
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderLeft: "3.5px solid var(--royal)",
                  marginBottom: "16px",
                  fontSize: "12.5px",
                  color: "var(--text-2)",
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
                        background: "var(--surface-3)",
                        color: "var(--navy)",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        border: "1px solid var(--border)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      {sk.name}: <strong style={{ color: "var(--royal)" }}>{sk.score}</strong>
                    </span>
                  ))}
                  {cand.topSkills.length === 0 && <span style={{ fontSize: "12px", color: "var(--muted)" }}>—</span>}
                  {cand.verifiedBadges !== null && (
                    <span
                      style={{
                        padding: "5px 10px",
                        borderRadius: "8px",
                        background: "var(--warning-soft)",
                        color: "var(--warning-fg)",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        border: "1px solid var(--warning-ring)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <Icon name="award" size={13} />
                      {cand.verifiedBadges} ta OB 3.0 sertifikat
                    </span>
                  )}
                </div>
              </div>

              {inviteError?.id === cand.id && (
                <div style={{ marginBottom: "10px", fontSize: "12px", color: "var(--rose)", fontWeight: 600 }}>{inviteError.message}</div>
              )}

              {/* Actions Row (Both buttons perfectly aligned on the same row with equal height) */}
              <div className="candidate-actions-row">
                <button
                  type="button"
                  className="candidate-evidence-btn"
                  onClick={() => openEvidence(cand)}
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
            <div className="modal-symbol" style={{ background: "linear-gradient(160deg, #2b4fa8, #1e3a8a 45%, #0f2744)", color: "white" }}>
              <Icon name="shieldCheck" size={30} />
            </div>
            <p className="eyebrow" style={{ color: "var(--royal)" }}>VERIFIED CANDIDATE EVIDENCE · OB 3.0</p>
            <h2 style={{ fontSize: "22px", margin: "4px 0" }}>{selectedCandidate.name} · Dalillar zanjiri</h2>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "18px" }}>
              Nomzod tomonidan berilgan rasmiy rozilik (Consent) asosida ochiqlangan tekshirilgan ko‘nikmalar dalillari.
            </p>

            {!selectedCandidate.demo ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", textAlign: "left", marginBottom: "22px", maxHeight: "52vh", overflowY: "auto" }}>
                {profileLoading && (
                  <div style={{ padding: "18px", textAlign: "center", fontSize: "13px", color: "var(--muted)" }}>Dalillar yuklanmoqda…</div>
                )}
                {profileError && (
                  <div style={{ padding: "13px 15px", borderRadius: "12px", background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: "12.5px", color: "var(--rose)", display: "flex", alignItems: "center", gap: "10px" }}>
                    <Icon name="alertTriangle" size={18} />
                    <span>{profileError}</span>
                  </div>
                )}
                {profile && (
                  <>
                    <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                      {profile.direction ?? "—"} · {profile.course ?? "—"}
                    </div>
                    {profile.skills.length === 0 && (
                      <div style={{ padding: "14px 16px", borderRadius: "12px", background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: "13px", color: "var(--muted)" }}>
                        Tasdiqlangan ko‘nikmalar hali mavjud emas.
                      </div>
                    )}
                    {profile.skills.map((sk) => (
                      <div key={sk.code} style={{ padding: "14px 16px", borderRadius: "12px", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", gap: "10px" }}>
                          <div>
                            <strong style={{ fontSize: "13.5px", color: "var(--navy)" }}>{sk.name}</strong>
                            <div style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: "2px" }}>
                              {sk.code}
                              {sk.level ? ` · ${sk.level}` : ""}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: "17px", fontWeight: 800, color: "var(--royal)" }}>{fmt(sk.score)}/100</span>
                            <div style={{ fontSize: "11.5px", color: "var(--success)", fontWeight: 700 }}>{fmt(sk.confidence)}% Ishonchlilik</div>
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px", textAlign: "center" }}>
                          {LAYERS.map((layer) => {
                            const v = sk.layers?.[layer];
                            return (
                              <div key={layer} style={{ padding: "6px 4px", borderRadius: "8px", background: "#ffffff", border: "1px solid var(--border)" }}>
                                <div style={{ fontSize: "10px", color: "var(--muted)", fontWeight: 700 }}>{layer}</div>
                                <strong style={{ fontSize: "13px", color: v === null || v === undefined ? "var(--muted)" : LAYER_COLORS[layer] }}>
                                  {v === null || v === undefined ? "—" : `${fmt(v)}%`}
                                </strong>
                              </div>
                            );
                          })}
                        </div>
                        {sk.evidence.length > 0 && (
                          <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "flex", flexDirection: "column", gap: "5px" }}>
                            {sk.evidence.map((ev, i) => (
                              <li key={`${ev.layer}-${i}`} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-2)" }}>
                                <span style={{ minWidth: "52px", fontSize: "10px", fontWeight: 800, color: LAYER_COLORS[ev.layer] ?? "var(--muted)" }}>{ev.layer}</span>
                                <span style={{ flex: 1 }}>{ev.title}</span>
                                {ev.human_verified && (
                                  <span title="Inson tomonidan tasdiqlangan" style={{ color: "var(--success)", display: "inline-flex" }}>
                                    <Icon name="userCheck" size={13} />
                                  </span>
                                )}
                                <span style={{ color: "var(--muted)", fontSize: "11px" }}>{ev.date}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                    <div style={{ padding: "13px 15px", borderRadius: "12px", background: "var(--success-soft)", border: "1px solid var(--success-ring)", fontSize: "12.5px", color: "var(--success-fg)", display: "flex", alignItems: "center", gap: "10px" }}>
                      <Icon name="checkCircle" size={18} />
                      <span>
                        <strong>Tasdiqlangan dalillar:</strong>{" "}
                        {profile.skills.reduce((acc, sk) => acc + sk.evidence.length, 0)} ta, shundan {humanVerifiedCount} tasi inson
                        tomonidan tekshirilgan.
                      </span>
                    </div>
                    {profile.notice && (
                      <div style={{ padding: "13px 15px", borderRadius: "12px", background: "var(--warning-soft)", border: "1px solid var(--warning-ring)", fontSize: "12.5px", color: "var(--warning-fg)", display: "flex", alignItems: "center", gap: "10px" }}>
                        <Icon name="alertTriangle" size={18} />
                        <span>{profile.notice}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", textAlign: "left", marginBottom: "22px" }}>
              <div style={{ padding: "14px 16px", borderRadius: "12px", background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: "13.5px", color: "var(--navy)" }}>Umumiy Skill Score:</strong>
                  <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>5 qatlamli tekshirilgan indeks</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "18px", fontWeight: 800, color: "var(--royal)" }}>{selectedCandidate.demo.overallScore}/100</span>
                  <div style={{ fontSize: "11.5px", color: "var(--success)", fontWeight: 700 }}>{selectedCandidate.demo.confidence}% Ishonchlilik</div>
                </div>
              </div>

              <div style={{ padding: "14px 16px", borderRadius: "12px", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <strong style={{ fontSize: "13.5px", color: "var(--navy)" }}>Qatlamlar bo‘yicha tekshiruv:</strong>
                  <span style={{ padding: "3px 8px", borderRadius: "6px", background: "var(--accent-soft)", color: "var(--royal)", fontSize: "11px", fontWeight: 800 }}>
                    {selectedCandidate.demo.level} MUTAXASSIS
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px", textAlign: "center" }}>
                  <div style={{ padding: "6px 4px", borderRadius: "8px", background: "#ffffff", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "10px", color: "var(--muted)", fontWeight: 700 }}>KNOW</div>
                    <strong style={{ fontSize: "13px", color: "var(--accent)" }}>88%</strong>
                  </div>
                  <div style={{ padding: "6px 4px", borderRadius: "8px", background: "#ffffff", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "10px", color: "var(--muted)", fontWeight: 700 }}>DO</div>
                    <strong style={{ fontSize: "13px", color: "var(--success)" }}>85%</strong>
                  </div>
                  <div style={{ padding: "6px 4px", borderRadius: "8px", background: "#ffffff", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "10px", color: "var(--muted)", fontWeight: 700 }}>ADAPT</div>
                    <strong style={{ fontSize: "13px", color: "var(--violet)" }}>78%</strong>
                  </div>
                  <div style={{ padding: "6px 4px", borderRadius: "8px", background: "#ffffff", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "10px", color: "var(--muted)", fontWeight: 700 }}>DEFEND</div>
                    <strong style={{ fontSize: "13px", color: "var(--warning)" }}>82%</strong>
                  </div>
                  <div style={{ padding: "6px 4px", borderRadius: "8px", background: "#ffffff", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "10px", color: "var(--muted)", fontWeight: 700 }}>PROVE</div>
                    <strong style={{ fontSize: "13px", color: "var(--rose)" }}>80%</strong>
                  </div>
                </div>
              </div>

              <div style={{ padding: "13px 15px", borderRadius: "12px", background: "var(--success-soft)", border: "1px solid var(--success-ring)", fontSize: "12.5px", color: "var(--success-fg)", display: "flex", alignItems: "center", gap: "10px" }}>
                <Icon name="checkCircle" size={18} />
                <span>
                  <strong>AI Integrity tekshiruvi:</strong> Viva transkripti, GitHub kodi va autotestlar to‘liq tasdiqlangan. Shubhali yoki plagiat dalillar mavjud emas.
                </span>
              </div>
            </div>
            )}

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
                  void handleInvite(selectedCandidate);
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
