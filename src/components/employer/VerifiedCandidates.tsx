import { useEffect, useMemo, useState } from "react";
import { Icon } from "../common/Icons";
import type { IconName } from "../common/Icons";
import { employerCandidates } from "../../data/ontology";
import type { DirectionCode } from "../../types";
import { api, hasSession } from "../../services/api";

type DataMode = "loading" | "live" | "demo";

interface PoolSkill {
  code: string;
  name: string;
  score: number | null;
  confidence: number | null;
  level: string | null;
}

interface PoolCandidate {
  id: string;
  name: string;
  direction: string | null;
  direction_code: string | null;
  course: string | null;
  skills: PoolSkill[];
  best_level: string;
  evidence_verified: number;
  human_verified: number | null;
  credentials: number | null;
}

const LEVEL_OPTIONS = [
  { value: 1, label: "L1+ (barchasi)" },
  { value: 2, label: "L2+ APPLY" },
  { value: 3, label: "L3+ ADAPT" },
  { value: 4, label: "L4+ CREATE" },
];

const DIRECTION_OPTIONS: { key: DirectionCode | "all"; label: string; icon: IconName }[] = [
  { key: "all", label: "Barcha yo‘nalishlar", icon: "grid" },
  { key: "software", label: "Dasturiy injiniring", icon: "code" },
  { key: "computer", label: "Kompyuter injiniringi", icon: "cpu" },
  { key: "ai", label: "Sun’iy intellekt", icon: "sparkles" },
];

const levelRank = (level: string | null) => Number((level || "L0")[1]) || 0;
const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "—" : String(Math.round(v)));
const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 3) || "?";

// Sample pool for viewers who aren't signed in as an employer (role switcher, offline)
const DEMO_POOL: PoolCandidate[] = employerCandidates.map((c) => ({
  id: c.id,
  name: c.name,
  direction: c.directionName,
  direction_code: c.direction,
  course: null,
  skills: c.topSkills.map((s) => ({ code: s.name, name: s.name, score: s.score, confidence: c.confidence, level: c.level })),
  best_level: c.level,
  evidence_verified: c.verifiedBadges * 3,
  human_verified: null,
  credentials: c.verifiedBadges,
}));

export default function VerifiedCandidates() {
  const [mode, setMode] = useState<DataMode>(() => (hasSession() ? "loading" : "demo"));
  const [pool, setPool] = useState<PoolCandidate[]>([]);
  const [direction, setDirection] = useState<DirectionCode | "all">("all");
  const [minLevel, setMinLevel] = useState(1);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSession()) return;
    let cancelled = false;
    api
      .getVerifiedCandidates()
      .then((rows) => {
        if (cancelled) return;
        setPool(rows as PoolCandidate[]);
        setMode("live");
      })
      .catch(() => {
        // 403 for non-employers using the role switcher, or no backend: show the sample pool
        if (!cancelled) setMode("demo");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isLive = mode === "live";
  const source = isLive ? pool : mode === "demo" ? DEMO_POOL : [];
  const q = query.trim().toLowerCase();

  const shown = useMemo(
    () =>
      source.filter((c) => {
        if (direction !== "all" && c.direction_code !== direction) return false;
        if (levelRank(c.best_level) < minLevel) return false;
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          (c.direction ?? "").toLowerCase().includes(q) ||
          c.skills.some((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
        );
      }),
    [source, direction, minLevel, q],
  );

  const stats = {
    total: shown.length,
    advanced: shown.filter((c) => levelRank(c.best_level) >= 3).length,
    humanVerified: isLive ? shown.reduce((a, c) => a + (c.human_verified ?? 0), 0) : null,
    credentials: shown.reduce((a, c) => a + (c.credentials ?? 0), 0),
  };

  return (
    <div className="page">
      <section className="welcome-row">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <p className="eyebrow" style={{ margin: 0 }}>VERIFIED TALENT POOL</p>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 9px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                background: isLive ? "var(--success-soft)" : "var(--surface-3)",
                color: isLive ? "var(--success)" : "var(--muted)",
                border: isLive ? "1px solid var(--success-ring)" : "1px solid var(--border)",
              }}
            >
              {isLive && <span className="live-pulse-indicator" />}
              {mode === "loading" ? "Yuklanmoqda…" : isLive ? "Jonli ma’lumot" : "Demo ma’lumot"}
            </span>
          </div>
          <h1>Tasdiqlangan nomzodlar</h1>
          <p className="subtitle">
            Profilini ulashishga rozilik bergan va kamida bitta ko‘nikmasi dalillar bilan tasdiqlangan (L1+) talabalar —
            eng yuqori darajadagilar birinchi.
          </p>
        </div>
      </section>

      <section className="employer-stats-row">
        {[
          { icon: "users" as IconName, label: "Nomzodlar", value: `${stats.total} ta`, tone: "var(--accent)", soft: "var(--accent-soft)" },
          { icon: "trophy" as IconName, label: "L3+ darajali", value: `${stats.advanced} ta`, tone: "var(--success)", soft: "var(--success-soft)" },
          {
            icon: "userCheck" as IconName,
            label: "Inson tasdiqlagan dalil",
            value: stats.humanVerified === null ? "—" : `${stats.humanVerified} ta`,
            tone: "var(--violet)",
            soft: "var(--surface-3)",
          },
          { icon: "award" as IconName, label: "OB 3.0 sertifikatlar", value: `${stats.credentials} ta`, tone: "var(--warning-fg)", soft: "var(--warning-soft)" },
        ].map((s) => (
          <div className="employer-stat-pill" key={s.label}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: s.soft, color: s.tone, display: "grid", placeItems: "center" }}>
              <Icon name={s.icon} size={20} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>{s.label}</div>
              <strong style={{ fontSize: 19, color: "var(--navy)" }}>{s.value}</strong>
            </div>
          </div>
        ))}
      </section>

      <section className="employer-filter-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "1 1 260px", position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}>
              <Icon name="search" size={16} />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ism, yo‘nalish yoki ko‘nikma bo‘yicha qidirish"
              style={{
                width: "100%",
                padding: "11px 14px 11px 38px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                font: "500 14px Geist, sans-serif",
                color: "var(--ink)",
                outline: "none",
              }}
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--text-3)" }}>
            Minimal daraja
            <select
              value={minLevel}
              onChange={(e) => setMinLevel(Number(e.target.value))}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", fontWeight: 600 }}
            >
              {LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {DIRECTION_OPTIONS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setDirection(d.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 13px",
                borderRadius: 10,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                border: direction === d.key ? "1px solid var(--accent-ring)" : "1px solid var(--border)",
                background: direction === d.key ? "var(--accent-soft)" : "var(--surface-2)",
                color: direction === d.key ? "var(--royal)" : "var(--text-2)",
              }}
            >
              <Icon name={d.icon} size={14} /> {d.label}
            </button>
          ))}
        </div>
      </section>

      {mode === "loading" ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Nomzodlar yuklanmoqda…</div>
      ) : shown.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>
          <div style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--surface-3)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Icon name={isLive && pool.length === 0 ? "lock" : "search"} size={24} />
          </div>
          <h3 style={{ margin: "0 0 6px", color: "var(--navy)", fontSize: 17 }}>Nomzod topilmadi</h3>
          <p style={{ margin: "0 auto", fontSize: 13.5, maxWidth: 480 }}>
            {isLive && pool.length === 0
              ? "Hozircha profilini ulashishga rozilik bergan va tasdiqlangan ko‘nikmaga ega talaba yo‘q."
              : "Filtrlarni yumshatib ko‘ring: minimal darajani pasaytiring yoki boshqa yo‘nalishni tanlang."}
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {shown.map((c, i) => {
            const open = expanded === c.id;
            return (
              <div key={c.id} style={{ padding: "14px 18px", borderTop: i === 0 ? 0 : "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      minWidth: 40,
                      borderRadius: 12,
                      background: "linear-gradient(160deg, #2b4fa8, #1e3a8a 45%, #0f2744)",
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 800,
                      fontSize: 14,
                    }}
                  >
                    {initials(c.name)}
                  </div>
                  <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "var(--navy)" }}>{c.name}</h3>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {c.direction ?? "—"}
                      {c.course ? ` · ${c.course}` : ""}
                    </div>
                  </div>
                  <span
                    title="Eng yuqori tasdiqlangan daraja"
                    style={{
                      padding: "5px 10px",
                      borderRadius: 8,
                      background: "var(--success-soft)",
                      color: "var(--success)",
                      border: "1px solid var(--success-ring)",
                      fontSize: 12,
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.best_level}
                  </span>
                  <span className="vc-chip">
                    <Icon name="checkCircle" size={13} /> {c.evidence_verified} ta dalil
                  </span>
                  {(c.credentials ?? 0) > 0 && (
                    <span className="vc-chip vc-chip-warn">
                      <Icon name="award" size={13} /> {c.credentials} ta sertifikat
                    </span>
                  )}
                  <button
                    type="button"
                    className="candidate-evidence-btn"
                    style={{ flex: "0 0 auto" }}
                    aria-expanded={open}
                    onClick={() => setExpanded(open ? null : c.id)}
                  >
                    <Icon name="shieldCheck" size={16} />
                    <span>{open ? "Yopish" : "Dalillarni ko‘rish"}</span>
                  </button>
                </div>
                {open && (
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12, paddingLeft: 52 }}>
                    {c.skills.map((s) => (
                      <span
                        key={s.code}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 8,
                          background: "var(--surface-3)",
                          color: "var(--navy)",
                          fontSize: 11.5,
                          fontWeight: 600,
                          border: "1px solid var(--border)",
                        }}
                      >
                        {s.name}: <strong style={{ color: "var(--royal)" }}>{fmt(s.score)}</strong> · {fmt(s.confidence)}% ·{" "}
                        {(s.level || "").split(" ")[0]}
                      </span>
                    ))}
                    {c.human_verified !== null && c.human_verified > 0 && (
                      <span className="vc-chip">
                        <Icon name="userCheck" size={13} /> {c.human_verified} tasini o‘qituvchi tasdiqlagan
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
